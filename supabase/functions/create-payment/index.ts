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
    console.log('create-payment invocado');
    const MP_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    console.log('MERCADOPAGO_ACCESS_TOKEN existe:', !!MP_ACCESS_TOKEN);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log('Body recibido:', body);

    const productId = body.product_id || body.productId;
    const userId = body.user_id || body.userId;

    if (!productId) {
      throw new Error('product_id es requerido');
    }

    // Buscar producto en DB
    const { data: producto, error: dbError } = await supabase
      .from('store_products')
      .select('*')
      .eq('id', productId)
      .single();

    if (dbError || !producto) {
      console.error('Error al buscar producto:', dbError);
      throw new Error(`Producto no encontrado: ${productId}`);
    }

    console.log('Producto encontrado:', producto);

    if (!MP_ACCESS_TOKEN) {
      console.error('Error: MERCADOPAGO_ACCESS_TOKEN no está definido en las variables de entorno de Supabase Edge Functions.');
      throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado en Supabase Secrets');
    }

    console.log('Creando preferencia en MP...');

    const WEBHOOK_URL = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            id: producto.id,
            title: `CampusLink: ${producto.name}`,
            quantity: 1,
            unit_price: Number(producto.price),
            currency_id: 'PEN',
          },
        ],
        metadata: {
          user_id: userId,
          product_id: producto.id,
          type: producto.type,
          amount: producto.amount,
        },
        external_reference: `user_id:${userId}|product_id:${producto.id}|timestamp:${Date.now()}`,
        back_urls: {},
        notification_url: WEBHOOK_URL,
      }),
    });

    const preferenceData = await mpRes.json();

    if (!mpRes.ok) {
      console.error('Error de MP:', preferenceData);
      throw new Error(`Mercado Pago Error: ${JSON.stringify(preferenceData)}`);
    }

    console.log('Preferencia creada exitosamente:', preferenceData.id);

    return new Response(
      JSON.stringify({
        preference_id: preferenceData.id,
        id: preferenceData.id,
        init_point: preferenceData.init_point,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('Error en create-payment:', err.message || err);
    return new Response(
      JSON.stringify({ error: err.message || 'Error al procesar preferencia' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
