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
    const apiBase = c.env.WEBHOOK_URL_BASE || 'https://campuslink-api.cajaupazul.workers.dev'

    if (!user) return c.json({ error: 'Unauthorized' }, 401)

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
                    // NEW: Safe public landing page (no auth guards, no SSR, no timeouts)
                    success: 'https://campuslink.pages.dev/checkout/result?status=success',
                    failure: 'https://campuslink.pages.dev/checkout/result?status=failure',
                    pending: 'https://campuslink.pages.dev/checkout/result?status=pending',
                },
                auto_return: 'approved',
                payment_methods: {
                    installments: 1,
                    default_installments: 1
                    // REMOVED ALL EXCLUSIONS TO RESTORE YAPE/PLIN
                },
                external_reference: `user_id:${user.id}|timestamp:${Date.now()}`,
                notification_url: `${apiBase}/checkout/webhook`,
                binary_mode: true,
                expires: false
            }),
        }
    )

    const data = await response.json() as any

    if (!response.ok) {
        return c.json({ error: data }, 500)
    }

    return c.json({
        init_point: data.init_point,
    })
})

// 2. Stable HTML Landing Handlers (To avoid 522 on main domain during MP redirect)
const getSuccessHTML = (status: string) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>¡Pago Exitoso! - CampusLink</title>
    <style>
        body { font-family: sans-serif; background: #0b0e14; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
        .card { background: #151921; padding: 2.5rem; border-radius: 2rem; border: 1px solid #1e242e; box-shadow: 0 20px 50px rgba(0,0,0,0.5); max-width: 400px; width: 90%; }
        h1 { color: #22c55e; margin: 0 0 1rem; font-size: 1.8rem; }
        p { color: #94a3b8; font-size: 1.1rem; line-height: 1.5; margin-bottom: 2rem; }
        .btn { background: #3b82f6; color: white; text-decoration: none; padding: 1rem 2rem; border-radius: 1rem; font-weight: bold; display: inline-block; transition: transform 0.2s; }
        .btn:active { transform: scale(0.95); }
    </style>
</head>
<body>
    <div class="card">
        <h1>¡Pago ${status === 'success' ? 'Exitoso' : 'Pendiente'}!</h1>
        <p>Tu transacción ha sido procesada. Ya puedes volver a la aplicación para ver tus beneficios.</p>
        <a href="https://campuslink.pages.dev/dashboard/store?status=${status}" class="btn">Volver a CampusLink</a>
    </div>
</body>
</html>
`;

// 2. Client-Side Confirmation Endpoint (Asynchronous Verification)
checkout.get('/confirm', async (c) => {
    const paymentId = c.req.query('id')
    if (!paymentId) return c.json({ error: 'Missing payment ID' }, 400)

    try {
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${c.env.MP_ACCESS_TOKEN}` }
        })

        if (!mpRes.ok) return c.json({ error: 'MP Verification Failed' }, mpRes.status)

        const payment = await mpRes.json() as any
        return c.json({
            status: payment.status,
            status_detail: payment.status_detail,
            id: payment.id,
            external_reference: payment.external_reference
        })
    } catch (err) {
        return c.json({ error: 'Internal Verification Error' }, 500)
    }
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

