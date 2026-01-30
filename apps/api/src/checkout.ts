// apps/api/src/checkout.ts
import { Hono } from 'hono'

type Env = {
    MP_ACCESS_TOKEN: string
}

export const checkout = new Hono<{ Bindings: Env }>()

checkout.post('/', async (c) => {
    const body = await c.req.json()

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
                    success: 'https://campuslink.pages.dev/success',
                    failure: 'https://campuslink.pages.dev/failure',
                    pending: 'https://campuslink.pages.dev/success',
                },
                auto_return: 'approved',
                payment_methods: {
                    installments: 1,
                    default_installments: 1
                },
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

