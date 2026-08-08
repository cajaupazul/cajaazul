import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[create-yape-payment] Invocado');
    const MP_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || 'APP_USR-4922371222532387-011017-25a8fdc92b392d510fa3ddcc55aec975-2624882322';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log('[create-yape-payment] Payload recibido:', body);

    const { token, amount, product_id, user_id, description, email } = body;

    if (!token || !product_id || !user_id) {
      throw new Error('Faltan campos requeridos: token, product_id o user_id');
    }

    // Buscar producto en DB para verificar precio seguro
    const { data: producto, error: dbError } = await supabase
      .from('store_products')
      .select('*')
      .eq('id', product_id)
      .single();

    if (dbError || !producto) {
      console.error('[create-yape-payment] Producto no encontrado:', dbError);
      throw new Error(`Producto no encontrado: ${product_id}`);
    }

    const finalAmount = Number(producto.price);
    const WEBHOOK_URL = `${supabaseUrl}/functions/v1/mercadopago-webhook`;
    const payerEmail = email || 'cliente@campuslink.pe';

    console.log('[create-yape-payment] Procesando pago Yape en Mercado Pago API...');

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `yape_${user_id}_${Date.now()}`
      },
      body: JSON.stringify({
        transaction_amount: finalAmount,
        token: token,
        description: description || `CampusLink: ${producto.name}`,
        payment_method_id: 'yape',
        payer: {
          email: payerEmail,
        },
        external_reference: `user_id:${user_id}|product_id:${producto.id}|timestamp:${Date.now()}`,
        metadata: {
          user_id: user_id,
          product_id: producto.id,
          type: producto.type,
          amount: producto.amount,
        },
        notification_url: WEBHOOK_URL,
      }),
    });

    const payment = await mpRes.json();
    console.log('[create-yape-payment] Respuesta MP API:', payment);

    if (!mpRes.ok || payment.status !== 'approved') {
      const msg = payment.status_detail || payment.message || 'Pago con Yape fue rechazado o no fue aprobado';
      return new Response(
        JSON.stringify({ success: false, status: payment.status, message: msg, details: payment }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Si el pago está aprobado, también actualizamos el perfil de forma inmediata para mejor UX
    try {
      if (producto.type === 'coins') {
        const { data: userProf } = await supabase.from('profiles').select('monedas').eq('id', user_id).single();
        await supabase.from('profiles').update({ monedas: (userProf?.monedas || 0) + producto.amount }).eq('id', user_id);
      } else if (producto.type === 'vip') {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (producto.amount || 30));
        await supabase.from('profiles').update({ es_vip: true, vip_hasta: expiresAt.toISOString(), active_frame_key: 'vip_exclusive' }).eq('id', user_id);
      }
    } catch (profErr) {
      console.warn('[create-yape-payment] Error al actualizar perfil directamente:', profErr);
    }

    return new Response(
      JSON.stringify({ success: true, payment_id: payment.id, status: payment.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[create-yape-payment] Error:', err.message || err);
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Error interno al procesar pago Yape' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
