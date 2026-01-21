import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!MP_ACCESS_TOKEN) {
        return NextResponse.json(
            { error: "MERCADOPAGO_ACCESS_TOKEN no está definido." },
            { status: 500 }
        );
    }

    try {
        const { title, price, type, amount, userId } = await req.json();
        const origin = req.nextUrl.origin;

        const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                items: [
                    {
                        id: type === 'vip' ? 'vip_membership' : `coins_${amount}`,
                        title: title,
                        quantity: 1,
                        unit_price: Number(price),
                        currency_id: "PEN",
                    },
                ],
                // REQUISITO: Forzar exactamente 1 cuotas
                payment_methods: {
                    installments: 1,
                    default_installments: 1
                },
                back_urls: {
                    success: `${origin}/dashboard/store?status=success`,
                    failure: `${origin}/dashboard/store?status=failure`,
                    pending: `${origin}/dashboard/store?status=pending`,
                },
                auto_return: "approved",
                notification_url: `${origin}/api/webhooks/mercadopago`,
                metadata: {
                    type,
                    amount,
                    user_id: userId
                }
            }),
        });

        const result = await mpResponse.json();

        if (!mpResponse.ok) {
            throw new Error(result.message || "Error al crear la preferencia");
        }

        return NextResponse.json({ id: result.id });

    } catch (error: any) {
        console.error("Error en API crear-preferencia:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
