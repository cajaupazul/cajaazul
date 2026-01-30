// apps/api/src/checkout.ts
import { Hono } from 'hono'
import { authMiddleware } from './auth'
import { createClient } from '@supabase/supabase-js'

type Env = {
    MP_ACCESS_TOKEN: string
    SUPABASE_URL: string
    SUPABASE_SERVICE_ROLE_KEY: string
    WEBHOOK_URL_BASE: string // Set this to https://campuslink-api.workers.dev
}

export const checkout = new Hono<{ Bindings: Env }>()

// 1. Create Preference (Authenticated)
checkout.post('/', authMiddleware, async (c) => {
    const user = (c as any).get('user')
    const body = await c.req.json()

    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    // Enforce stricter installments and reference
    const response = await fetch(
        'https://api.mercadopago.com/checkout/preferences',
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${c.env.MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                items: body.items,
                back_urls: {
                    success: 'https://campuslink.pages.dev/pago-exitoso.html',
                    failure: 'https://campuslink.pages.dev/failure',
                    pending: 'https://campuslink.pages.dev/pago-exitoso.html',
                },
                auto_return: 'approved',
                payment_methods: {
                    installments: 1,
                    default_installments: 1,
                    excluded_payment_types: [
                        { id: "ticket" },
                        { id: "atm" },
                        { id: "debit_card" } // Opcional: restringir a crédito para asegurar 1 cuota si MP web falla
                    ]
                },
                // Crucial for Webhook: Pass User ID
                external_reference: `user_id:${user.id}|timestamp:${Date.now()}`,
                notification_url: `${c.env.WEBHOOK_URL_BASE || 'https://campuslink-api.cajaupazul.workers.dev'}/checkout/webhook`,
                binary_mode: true,
                expires: false
            }),
        }
    )

    const data = await response.json() as any

    if (!response.ok) {
        return c.json({ error: data }, 500)
    }

    c.header('Cache-Control', 'no-store')
    return c.json({
        init_point: data.init_point,
    })
})

// 2. Webhook Handler (Public but validated by MP Token)
checkout.post('/webhook', async (c) => {
    const body = await c.req.json()
    const { action, data, type } = body

    // We only care about payment events
    if (action !== 'payment.created' && type !== 'payment') {
        return c.json({ received: true }, 200)
    }

    const paymentId = data.id
    if (!paymentId) return c.json({ error: 'No ID' }, 400)

    try {
        // Verify payment status with Mercado Pago
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${c.env.MP_ACCESS_TOKEN}` }
        })
        const payment = await mpRes.json() as any

        if (payment.status === 'approved') {
            const externalRef = payment.external_reference
            if (externalRef && externalRef.startsWith('user_id:')) {
                const userId = externalRef.split('|')[0].replace('user_id:', '')

                // Extract amount from items or total_paid_amount
                // For now, let's look at the items to see what was bought
                const firstItem = payment.additional_info?.items?.[0] || {}
                const title = firstItem.title || ''

                // Credit logic based on title or amount
                const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY)

                if (title.toLowerCase().includes('monedas')) {
                    // Example: "Paquete 500 Monedas"
                    const coins = parseInt(title.match(/\d+/)?.[0] || '0')
                    if (coins > 0) {
                        const { data: profile } = await supabase.from('profiles').select('monedas').eq('id', userId).single()
                        const newTotal = (profile?.monedas || 0) + coins
                        await supabase.from('profiles').update({ monedas: newTotal }).eq('id', userId)
                    }
                } else if (title.toLowerCase().includes('vip')) {
                    // Example: "Suscripción VIP"
                    const days = 30 // Hardcoded or extracted
                    const expiresAt = new Date()
                    expiresAt.setDate(expiresAt.getDate() + days)
                    await supabase.from('profiles').update({
                        es_vip: true,
                        vip_hasta: expiresAt.toISOString()
                    }).eq('id', userId)
                }
            }
        }
    } catch (err) {
        console.error('Webhook Error:', err)
        return c.json({ error: 'Internal Error' }, 500)
    }

    return c.json({ success: true }, 200)
})

