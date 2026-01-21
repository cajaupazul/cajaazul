import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Mercado Pago only works with standard Node runtime comfortably if using their SDK
// But we want Edge compatibility for Cloudflare Pages.
// We'll use the REST API of Mercado Pago to avoid SDK dependency issues on Edge.
export const runtime = 'edge';

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

export async function POST(req: NextRequest) {
    try {
        // Initialize Supabase Admin inside function for Edge compatibility
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { productId, userId } = await req.json();

        if (!productId || !userId) {
            return NextResponse.json({ error: 'Faltan datos obligatorios (productId, userId)' }, { status: 400 });
        }

        // 1. Fetch REAL price and details from DB (Secure)
        const { data: product, error: productError } = await supabaseAdmin
            .from('store_products')
            .select('*')
            .eq('id', productId)
            .eq('active', true)
            .single();

        if (productError || !product) {
            console.error('Product fetch error:', productError);
            return NextResponse.json({ error: 'Producto no encontrado o inactivo' }, { status: 404 });
        }

        // 2. Prepare Mercado Pago Preference Data
        const preferenceData = {
            items: [
                {
                    id: product.id,
                    title: product.name,
                    quantity: 1,
                    unit_price: Number(product.price),
                    currency_id: 'PEN',
                    description: product.type === 'vip' ? `Acceso VIP por ${product.amount} días` : `${product.amount} Monedas`,
                }
            ],
            metadata: {
                user_id: userId,
                product_id: product.id,
                type: product.type,
                amount: product.amount
            },
            back_urls: {
                success: `${req.nextUrl.origin}/dashboard?payment=success`,
                failure: `${req.nextUrl.origin}/dashboard?payment=failure`,
                pending: `${req.nextUrl.origin}/dashboard?payment=pending`,
            },
            auto_return: 'approved',
            notification_url: `${req.nextUrl.origin}/api/webhooks/mercadopago`,
        };

        // 3. Create Preference via Mercado Pago REST API (Edge compatible)
        const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(preferenceData),
        });

        if (!mpResponse.ok) {
            const errorData = await mpResponse.json();
            console.error('Mercado Pago Error:', errorData);
            throw new Error('Error al crear la preferencia de pago');
        }

        const preference = await mpResponse.json();

        // 4. Return the checkout URL
        return NextResponse.json({
            id: preference.id,
            init_point: preference.init_point
        });

    } catch (error: any) {
        console.error('Checkout error:', error);
        return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
    }
}
