import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

export async function POST(req: NextRequest) {
    try {
        // Initialize Supabase Admin client inside function (not at module level) for Edge compatibility
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type') || searchParams.get('topic');
        const id = searchParams.get('data.id') || searchParams.get('id');

        if (type === 'payment' && id) {
            // Get payment details via Fetch API (Edge Compatible)
            const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
                headers: {
                    'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                },
            });

            if (!mpResponse.ok) {
                throw new Error('Failed to fetch payment details from Mercado Pago');
            }

            const paymentData = await mpResponse.json();

            if (paymentData.status === 'approved') {
                const { user_id, type: productType, amount } = paymentData.metadata;
                const monto = paymentData.transaction_amount;

                console.log(`Payment approved for user ${user_id}. Type: ${productType}, Amount: ${amount}`);

                if (productType === 'vip') {
                    const now = new Date();
                    const vipUntil = new Date(now.setDate(now.getDate() + 30));

                    await supabaseAdmin
                        .from('profiles')
                        .update({
                            es_vip: true,
                            vip_hasta: vipUntil.toISOString()
                        })
                        .eq('id', user_id);
                } else if (productType === 'coins' && amount) {
                    // Increment coins using standard Supabase update
                    // Note: In Edge runtime we want to minimize complex logic
                    const { data: profile } = await supabaseAdmin
                        .from('profiles')
                        .select('monedas')
                        .eq('id', user_id)
                        .single();

                    const currentCoins = profile?.monedas || 0;

                    await supabaseAdmin
                        .from('profiles')
                        .update({
                            monedas: currentCoins + Number(amount)
                        })
                        .eq('id', user_id);
                }

                // Record transaction
                await supabaseAdmin
                    .from('transacciones_tienda')
                    .insert({
                        user_id,
                        payment_id: id.toString(),
                        status: 'approved',
                        monto,
                        monedas_compradas: productType === 'coins' ? amount : 0,
                        es_vip_compra: productType === 'vip',
                    });
            }
        }

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error('Error processing MP webhook:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
