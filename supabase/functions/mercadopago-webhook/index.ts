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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || searchParams.get('topic');
    const id = searchParams.get('data.id') || searchParams.get('id');

    console.log('[mercadopago-webhook] type:', type, '| id:', id);

    if (type !== 'payment' || !id) {
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const MP_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
      || 'APP_USR-4922371222532387-011017-25a8fdc92b392d510fa3ddcc55aec975-2624882322';

    // 1. Fetch pago desde Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
    });

    if (!mpResponse.ok) {
      console.error('[webhook] MP fetch failed:', mpResponse.status);
      throw new Error(`MP fetch failed: ${mpResponse.status}`);
    }

    const paymentData = await mpResponse.json();
    console.log('[webhook] payment status:', paymentData.status, '| method:', paymentData.payment_type_id);
    console.log('[webhook] metadata:', JSON.stringify(paymentData.metadata));
    console.log('[webhook] external_reference:', paymentData.external_reference);

    // 2. Extraer metadata — soporta tanto metadata.* como external_reference
    let user_id: string | null = paymentData.metadata?.user_id ?? null;
    let product_id: string | null = paymentData.metadata?.product_id ?? null;
    let productType: string | null = paymentData.metadata?.type ?? null;
    let coinsAmount: number = Number(paymentData.metadata?.amount ?? 0);

    // Fallback: parsear external_reference si metadata viene vacío
    if (!user_id && paymentData.external_reference) {
      const ref = paymentData.external_reference as string;
      const pairs: Record<string, string> = {};
      ref.split('|').forEach((part: string) => {
        const [k, v] = part.split(':');
        if (k && v) pairs[k.trim()] = v.trim();
      });
      user_id = pairs['user_id'] ?? null;
      product_id = pairs['product_id'] ?? null;
    }

    // Si falta user_id no podemos procesar
    if (!user_id) {
      console.warn('[webhook] No user_id encontrado en metadata ni external_reference — abortando');
      return new Response(JSON.stringify({ received: true, error: 'no user_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Si falta product_type, buscarlo en store_products usando product_id
    if (!productType && product_id) {
      const { data: prod } = await supabase
        .from('store_products')
        .select('type, amount')
        .eq('id', product_id)
        .single();
      if (prod) {
        productType = prod.type;
        if (!coinsAmount) coinsAmount = Number(prod.amount);
      }
    }

    const paymentStatus = paymentData.status as string;
    const paymentMethod = (paymentData.payment_type_id ?? paymentData.payment_method_id ?? 'unknown') as string;

    // 3. Registrar transacción (ON CONFLICT payment_id → ignorar duplicados)
    const { error: insertError } = await supabase
      .from('transacciones_tienda')
      .insert({
        user_id,
        payment_id:         id.toString(),
        preference_id:      paymentData.order?.id?.toString() ?? null,
        status:             paymentStatus,
        monto:              paymentData.transaction_amount ?? 0,
        monedas_compradas:  productType === 'coins' ? coinsAmount : 0,
        es_vip_compra:      productType === 'vip',
        product_id:         product_id ?? null,
        payment_method:     paymentMethod,
        product_type:       productType ?? null,
        currency:           'PEN',
      })
      .select()
      // Deduplicación: si payment_id ya existe, no volvemos a procesar
      .single();

    if (insertError) {
      // Código 23505 = unique_violation (ya procesado)
      if (insertError.code === '23505') {
        console.log('[webhook] Pago ya procesado anteriormente:', id);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      console.warn('[webhook] Error al insertar transacción:', insertError.message);
    }

    // 4. Si el pago fue aprobado → actualizar perfil
    if (paymentStatus === 'approved') {
      console.log('[webhook] Pago aprobado → actualizando perfil user_id:', user_id);

      if (productType === 'vip') {
        // Calcular días de VIP (usa amount del producto o 30 por defecto)
        const days = coinsAmount > 0 ? coinsAmount : 30;
        const vipUntil = new Date();
        vipUntil.setDate(vipUntil.getDate() + days);

        const { error: vipErr } = await supabase
          .from('profiles')
          .update({
            es_vip:            true,
            vip_hasta:         vipUntil.toISOString(),
            subscription_tier: 'vip',
            active_frame_key:  'vip_exclusive',
          })
          .eq('id', user_id);

        if (vipErr) console.error('[webhook] Error actualizando VIP:', vipErr.message);
        else console.log('[webhook] VIP activado hasta:', vipUntil.toISOString());

      } else if (productType === 'coins' && coinsAmount > 0) {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('monedas')
          .eq('id', user_id)
          .single();

        if (profileErr) {
          console.error('[webhook] Error leyendo monedas:', profileErr.message);
        } else {
          const newTotal = (profile?.monedas ?? 0) + coinsAmount;
          const { error: coinsErr } = await supabase
            .from('profiles')
            .update({ monedas: newTotal })
            .eq('id', user_id);

          if (coinsErr) console.error('[webhook] Error actualizando monedas:', coinsErr.message);
          else console.log('[webhook] Monedas actualizadas:', newTotal, 'para user:', user_id);
        }
      }
    } else {
      console.log('[webhook] Pago NO aprobado (status:', paymentStatus, ') — sin cambios en perfil');
    }

    return new Response(JSON.stringify({ received: true, status: paymentStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('[mercadopago-webhook] Error:', err.message || err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
