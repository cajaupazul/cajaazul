import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

serve(async (req) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type') || searchParams.get('topic');
        const id = searchParams.get('data.id') || searchParams.get('id');

        if (type === 'payment' && id) {
            const MP_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
            const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
                headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
            });

            if (!mpResponse.ok) throw new Error('MP fetch failed');

            const paymentData = await mpResponse.json();

            if (paymentData.status === 'approved') {
                const { user_id, type: productType, amount } = paymentData.metadata;

                if (productType === 'vip') {
                    const now = new Date();
                    const vipUntil = new Date(now.setDate(now.getDate() + 30));
                    await supabase.from('profiles').update({ es_vip: true, vip_hasta: vipUntil.toISOString() }).eq('id', user_id);
                } else if (productType === 'coins' && amount) {
                    const { data: profile } = await supabase.from('profiles').select('monedas').eq('id', user_id).single();
                    await supabase.from('profiles').update({ monedas: (profile?.monedas || 0) + Number(amount) }).eq('id', user_id);
                }

                // Record transaction
                await supabase.from('transacciones_tienda').insert({
                    user_id,
                    payment_id: id.toString(),
                    status: 'approved',
                    monto: paymentData.transaction_amount,
                    monedas_compradas: productType === 'coins' ? amount : 0,
                    es_vip_compra: productType === 'vip',
                });
            }
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
})
