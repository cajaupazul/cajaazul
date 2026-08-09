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
    
    const body = await req.json();
    console.log('[create-yape-payment] Payload recibido:', JSON.stringify(body));

    const { token, amount, product_id, user_id, description, userEmail, email, isTest } = body;
    
    // Seleccionar token según entorno test/prod o flag enviado
    let MP_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || 'APP_USR-8919084992296803-080917-7445864cf7f14745456c6bc4f76ec2fb-2915256654';

    if (isTest || Deno.env.get('MP_ENV') === 'test') {
      const testToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN_TEST');
      if (testToken) MP_ACCESS_TOKEN = testToken;
    }

    console.log('[create-yape-payment] Token prefix:', MP_ACCESS_TOKEN?.substring(0, 8));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payerEmail = userEmail || email || 'cliente@campuslink.pe';

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
    const WEBHOOK_URL = 'https://mevfhlhwrrkbhppgeyaj.supabase.co/functions/v1/mercadopago-webhook';

    console.log('[create-yape-payment] Creando pago Yape en MP API con token:', token);

    // Crear el pago con el token de Yape que se generó en el frontend
    const paymentPayload = {
      token: token,
      transaction_amount: finalAmount,
      installments: 1, // OBLIGATORIO para Yape
      payment_method_id: 'yape', // OBLIGATORIO
      description: description || `CampusLink: ${producto.name}`,
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
    };

    console.log('[create-yape-payment] Request payload to MP:', JSON.stringify(paymentPayload));

    const paymentResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(paymentPayload)
    });

    const paymentData = await paymentResponse.json();
    console.log('[create-yape-payment] Payment response:', JSON.stringify(paymentData));

    if (paymentData.status !== 'approved') {
      const msg = paymentData.status_detail || paymentData.message || 'Pago con Yape no fue aprobado';
      console.warn('[create-yape-payment] Pago no aprobado:', paymentData.status, msg);
      return new Response(
        JSON.stringify({ success: false, status: paymentData.status, message: msg, details: paymentData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pago aprobado → actualizar perfil inmediatamente
    try {
      if (producto.type === 'coins') {
        const { data: userProf } = await supabase.from('profiles').select('monedas').eq('id', user_id).single();
        await supabase.from('profiles')
          .update({ monedas: (userProf?.monedas || 0) + Number(producto.amount) })
          .eq('id', user_id);
        console.log('[create-yape-payment] Monedas actualizadas para user:', user_id);
      } else if (producto.type === 'vip') {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (Number(producto.amount) || 30));
        await supabase.from('profiles')
          .update({
            es_vip: true,
            vip_hasta: expiresAt.toISOString(),
            active_frame_key: 'vip_exclusive',
            subscription_tier: 'premium',
          })
          .eq('id', user_id);
        console.log('[create-yape-payment] VIP activado hasta:', expiresAt.toISOString());
      }
    } catch (profErr) {
      console.warn('[create-yape-payment] Error al actualizar perfil:', profErr);
    }

    return new Response(
      JSON.stringify({ success: true, payment_id: paymentData.id, status: paymentData.status }),
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
