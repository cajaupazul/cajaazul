import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_ACTIONS = ['buy_item', 'equip_frame', 'checkout'];

// Simple In-memory rate limiting
const rateLimitMap = new Map<string, { count: number, lastReset: number }>();
const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS = 15;

function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userData = rateLimitMap.get(userId) || { count: 0, lastReset: now };
    if (now - userData.lastReset > RATE_LIMIT_WINDOW) {
        userData.count = 1;
        userData.lastReset = now;
    } else {
        userData.count++;
    }
    rateLimitMap.set(userId, userData);
    return userData.count <= MAX_REQUESTS;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const authHeader = req.headers.get('Authorization')!;
        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (!checkRateLimit(user.id)) {
            return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { action, ...payload } = await req.json();

        if (!ALLOWED_ACTIONS.includes(action)) {
            return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        switch (action) {
            case 'buy_item': {
                const { item_id } = payload;
                const { data: item } = await supabase.from('shop_items').select('*').eq('id', item_id).eq('is_active', true).single();
                if (!item) throw new Error('Item not found');

                const { data: existing } = await supabase.from('user_inventory').select('id').eq('user_id', user.id).eq('item_id', item_id).single();
                if (existing) throw new Error('Already owned');

                const { data: profile } = await supabase.from('profiles').select('monedas').eq('id', user.id).single();
                if (!profile || profile.monedas < item.price_coins) throw new Error('Insufficient coins');

                const newBalance = profile.monedas - item.price_coins;
                await supabase.from('profiles').update({ monedas: newBalance }).eq('id', user.id);

                const { error: invErr } = await supabase.from('user_inventory').insert({ user_id: user.id, item_id, is_equipped: false });
                if (invErr) {
                    await supabase.from('profiles').update({ monedas: profile.monedas }).eq('id', user.id); // Rollback coins
                    throw invErr;
                }

                return new Response(JSON.stringify({ success: true, new_balance: newBalance }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            case 'equip_frame': {
                const { item_id } = payload;
                const { data: invItem } = await supabase.from('user_inventory').select('*, shop_items(frame_key)').eq('user_id', user.id).eq('item_id', item_id).single();
                if (!invItem || !invItem.shop_items?.frame_key) throw new Error('Frame not owned or invalid');

                await supabase.from('user_inventory').update({ is_equipped: false }).eq('user_id', user.id);
                await supabase.from('user_inventory').update({ is_equipped: true }).eq('user_id', user.id).eq('item_id', item_id);
                await supabase.from('profiles').update({ active_frame_key: invItem.shop_items.frame_key }).eq('id', user.id);

                return new Response(JSON.stringify({ success: true, frame_key: invItem.shop_items.frame_key }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            case 'checkout': {
                const { productId, origin } = payload;
                const { data: product } = await supabase.from('store_products').select('*').eq('id', productId).eq('active', true).single();
                if (!product) throw new Error('Product not found');

                const MP_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')!;
                const WEBHOOK_URL = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

                const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: [{ id: product.id, title: product.name, quantity: 1, unit_price: Number(product.price), currency_id: 'PEN' }],
                        metadata: { user_id: user.id, product_id: product.id, type: product.type, amount: product.amount },
                        back_urls: { success: `${origin}/dashboard?payment=success`, failure: `${origin}/dashboard?payment=failure`, pending: `${origin}/dashboard?payment=pending` },
                        auto_return: 'approved',
                        notification_url: WEBHOOK_URL,
                    }),
                });

                if (!mpRes.ok) throw new Error('Mercado Pago preference creation failed');
                const preference = await mpRes.json();
                return new Response(JSON.stringify({ id: preference.id, init_point: preference.init_point }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        }
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
})
