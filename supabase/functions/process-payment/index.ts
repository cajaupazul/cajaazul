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
    const MP_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') ||
      'APP_USR-8919084992296803-080917-7445864cf7f14745456c6bc4f76ec2fb-2915256654';


    console.log('[process-payment] Token prefix:', MP_ACCESS_TOKEN?.substring(0, 8));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log('[process-payment] Payload:', JSON.stringify(body));

    const { formData, product_id, user_id, userEmail } = body;

    if (!formData || !product_id || !user_id) {
      throw new Error('Faltan campos requeridos: formData, product_id, user_id');
    }

    // Buscar el producto en la BD para usar el precio real (seguridad)
    const { data: producto, error: dbError } = await supabase
      .from('store_products')
      .select('*')
      .eq('id', product_id)
      .single();

    if (dbError || !producto) {
      console.error('[process-payment] Producto no encontrado:', dbError);
      throw new Error(`Producto no encontrado: ${product_id}`);
    }

    const finalAmount = Number(producto.price);
    const WEBHOOK_URL = 'https://mevfhlhwrrkbhppgeyaj.supabase.co/functions/v1/mercadopago-webhook';

    console.log('[process-payment] Creando pago en MP | monto:', finalAmount, '| método:', formData.payment_method_id);

    // Construir el body del pago combinando el formData del Brick con nuestros datos seguros
    const paymentBody: Record<string, any> = {
      ...formData,                          // token, payment_method_id, installments, payer, etc.
      transaction_amount: finalAmount,       // precio desde BD (no del frontend)
      description: `CampusLink: ${producto.name}`,
      external_reference: `user_id:${user_id}|product_id:${producto.id}|timestamp:${Date.now()}`,
      metadata: {
        user_id,
        product_id: producto.id,
        type: producto.type,
        amount: producto.amount,
      },
      notification_url: WEBHOOK_URL,
    };

    // Asegurar que el payer tenga email aunque no lo mande el Brick
    if (!paymentBody.payer) paymentBody.payer = {};
    if (!paymentBody.payer.email) {
      paymentBody.payer.email = userEmail || 'cliente@campuslink.pe';
    }

    console.log('[process-payment] Body hacia MP:', JSON.stringify(paymentBody));

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(paymentBody),
    });

    const payment = await mpRes.json();
    console.log('[process-payment] Respuesta MP:', JSON.stringify(payment));

    if (payment.status !== 'approved') {
      const msg = payment.status_detail || payment.message || `Pago ${payment.status || 'rechazado'}`;
      console.warn('[process-payment] Pago no aprobado:', payment.status, msg);
      return new Response(
        JSON.stringify({ success: false, status: payment.status, message: msg }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ Pago aprobado → actualizar perfil inmediatamente
    try {
      if (producto.type === 'coins') {
        const { data: userProf } = await supabase
          .from('profiles').select('monedas').eq('id', user_id).single();
        await supabase.from('profiles')
          .update({ monedas: (userProf?.monedas || 0) + Number(producto.amount) })
          .eq('id', user_id);
        console.log('[process-payment] Monedas actualizadas para:', user_id);

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
        console.log('[process-payment] VIP activado hasta:', expiresAt.toISOString());
      }
    } catch (profileErr) {
      // No fallar si la actualización del perfil falla — el webhook lo reintentará
      console.warn('[process-payment] Error actualizando perfil (no crítico):', profileErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: payment.id,
        status: payment.status,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[process-payment] Error:', err.message || err);
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Error interno al procesar el pago' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
