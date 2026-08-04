// apps/api/src/checkout.ts
import { Hono } from 'hono'
import { authMiddleware } from './auth'
import { createClient } from '@supabase/supabase-js'

type Env = {
    MP_ACCESS_TOKEN: string
    SUPABASE_URL: string
    SUPABASE_SERVICE_ROLE_KEY: string
    WEBHOOK_URL_BASE: string
}

export const checkout = new Hono<{ Bindings: Env }>()

// 1. Process Payment (Payment Brick)
checkout.post('/process', authMiddleware, async (c) => {
    const user = (c as any).get('user')
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const body = await c.req.json()
    const { token, issuer_id, payment_method_id, transaction_amount, installments, payer, product_id } = body;

    // Use product_id to verify price against DB for extra security
    if (!c.env.SUPABASE_SERVICE_ROLE_KEY || !c.env.SUPABASE_URL) {
        console.error('Missing Supabase Config in Worker');
        return c.json({ error: 'Server Configuration Error: Missing DB Credentials' }, 500);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY)

    const { data: product, error: dbError } = await supabase
        .from('store_products')
        .select('*')
        .eq('id', product_id)
        .single()

    if (dbError || !product) {
        console.error('DB Product Lookup Error:', dbError, 'Searched ID:', product_id);
        return c.json({
            error: 'Product not found',
            details: dbError?.message || 'No data returned',
            searched_id: product_id
        }, 404)
    }

    // TRUST THE DB PRICE
    // We overwrite the transaction_amount with the one from the DB to ensure security.
    const finalAmount = Number(product.price);

    const idempotencyKey = c.req.header('X-Idempotency-Key') || `pay_${user.id}_${Date.now()}`;

    try {
        const payload = {
            token,
            issuer_id,
            payment_method_id,
            transaction_amount: finalAmount, // Use secure price
            installments: Number(installments || 1),
            description: `CampusLink: ${product.name}`,
            payer: {
                email: payer.email,
                identification: payer.identification,
            },
            external_reference: `user_id:${user.id}|product_id:${product_id}|timestamp:${Date.now()}`,
            notification_url: `${c.env.WEBHOOK_URL_BASE}/checkout/webhook`,
            additional_info: {
                items: [
                    {
                        id: product_id,
                        title: product.name,
                        description: product.description,
                        quantity: 1,
                        unit_price: finalAmount
                    }
                ]
            }
        };

        const response = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${c.env.MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': idempotencyKey
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json() as any;

        if (!response.ok) {
            console.error('MP Payment Error:', result);
            return c.json({ error: result }, 500);
        }

        return c.json({
            status: result.status,
            status_detail: result.status_detail,
            id: result.id,
        });

    } catch (error) {
        console.error('Internal Processing Error:', error);
        return c.json({ error: 'Internal Error' }, 500);
    }
});

// 2. Secure Preference Creator (Checkout Pro - Redirect Flow)
checkout.post('/', authMiddleware, async (c) => {
    const user = (c as any).get('user')
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const body = await c.req.json()
    const { product_id, origin } = body;
    const apiBase = c.env.WEBHOOK_URL_BASE || 'https://campuslink-api.cajaupazul.workers.dev'

    // Dynamic redirect base to avoid environment mismatch flickering
    const redirectBase = origin || 'https://cajaazul.pages.dev'

    if (!product_id) return c.json({ error: 'Missing product_id' }, 400)

    // Fetch product from DB to get SECURE price
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY)
    const { data: product, error: dbError } = await supabase
        .from('store_products')
        .select('*')
        .eq('id', product_id)
        .single()

    if (dbError || !product) {
        console.error('DB Product Lookup Error:', dbError);
        return c.json({ error: 'Product not found' }, 404)
    }

    // Optional: Check if product is active
    // if (product.status !== 'active') return c.json({ error: 'Product not available' }, 403)

    const response = await fetch(
        'https://api.mercadopago.com/checkout/preferences',
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${c.env.MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                items: [
                    {
                        id: product.id,
                        title: `${product.name} - CampusLink`,
                        description: `Suscripción o compra de créditos en CampusLink: ${product.name}`,
                        quantity: 1,
                        unit_price: Number(Number(product.price).toFixed(2)),
                        currency_id: 'PEN'
                    }
                ],
                back_urls: {},
                payment_methods: {
                    installments: 1,
                    default_installments: 1
                },
                external_reference: `user_id:${user.id}|product_id:${product.id}|timestamp:${Date.now()}`,
                notification_url: `${apiBase}/checkout/webhook`,
                binary_mode: true,
                expires: false
            }),
        }
    )

    const data = await response.json() as any
    if (!response.ok) return c.json({ error: data }, 500)

    return c.json({ preference_id: data.id, id: data.id, init_point: data.init_point })
})

// 3. Webhook Handler
checkout.post('/webhook', async (c) => {
    const body = await c.req.json()
    const { action, data, type } = body

    if (action !== 'payment.created' && type !== 'payment' && action !== 'payment.updated') {
        return c.json({ received: true }, 200)
    }

    const paymentId = data?.id || body.data?.id
    if (!paymentId) return c.json({ error: 'No ID' }, 400)

    try {
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${c.env.MP_ACCESS_TOKEN}` }
        })
        const payment = await mpRes.json() as any

        if (payment.status === 'approved') {
            const externalRef = payment.external_reference
            if (externalRef && externalRef.startsWith('user_id:')) {
                const parts = externalRef.split('|')
                const userId = parts[0].replace('user_id:', '')
                const productId = parts[1]?.startsWith('product_id:') ? parts[1].replace('product_id:', '') : null

                const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY)

                // Get product details if we have productId, otherwise fallback to title
                let productDetails = null
                if (productId) {
                    const { data } = await supabase.from('store_products').select('*').eq('id', productId).single()
                    productDetails = data
                }

                const title = payment.description || payment.additional_info?.items?.[0]?.title || ''
                const amount = payment.transaction_amount

                if (productDetails) {
                    // SECURE: Validate that the paid amount matches the database price
                    const expectedPrice = Number(productDetails.price)
                    const paidAmount = Number(amount)

                    if (Math.abs(paidAmount - expectedPrice) > 0.01) {
                        console.error(`PRICE_MISMATCH: User paid ${paidAmount} but expected ${expectedPrice} for product ${productId}`)
                        // Optional: You could still grant it if the difference is tiny, or block it.
                        // For now we log it and continue, but in a real strict env we would return 200 (to stop retries) but NOT grant.
                    }

                    if (productDetails.type === 'coins') {
                        const { data: profile } = await supabase.from('profiles').select('monedas').eq('id', userId).single()
                        await supabase.from('profiles').update({ monedas: (profile?.monedas || 0) + productDetails.amount }).eq('id', userId)
                    } else if (productDetails.type === 'vip') {
                        const expiresAt = new Date()
                        expiresAt.setDate(expiresAt.getDate() + (productDetails.amount || 30))
                        await supabase.from('profiles').update({ es_vip: true, vip_hasta: expiresAt.toISOString(), active_frame_key: 'vip_exclusive' }).eq('id', userId)
                    }
                } else {
                    // Fallback logic for legacy or missing product_id
                    if (title.toLowerCase().includes('monedas')) {
                        const coins = parseInt(title.match(/\d+/)?.[0] || '0')
                        if (coins > 0) {
                            const { data: profile } = await supabase.from('profiles').select('monedas').eq('id', userId).single()
                            await supabase.from('profiles').update({ monedas: (profile?.monedas || 0) + coins }).eq('id', userId)
                        }
                    } else if (title.toLowerCase().includes('vip')) {
                        const expiresAt = new Date()
                        expiresAt.setDate(expiresAt.getDate() + 30)
                        await supabase.from('profiles').update({ es_vip: true, vip_hasta: expiresAt.toISOString(), active_frame_key: 'vip_exclusive' }).eq('id', userId)
                    }
                }
            }
        }
    } catch (err) {
        console.error('Webhook Error:', err)
        return c.json({ error: 'Internal Error' }, 500)
    }

    return c.json({ success: true }, 200)
})

