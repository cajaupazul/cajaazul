import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import {
  amountToCents,
  createAdminClient,
  getAccessToken,
  getMercadoPagoEnvironment,
  jsonResponse,
  safePaymentSummary,
  verifyWebhookSignature,
} from '../_shared/mercadopago.ts'

serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ received: false }, 405)

  try {
    const url = new URL(req.url)
    const body = await req.json().catch(() => ({}))
    const type = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? body.type
    const dataId = String(
      url.searchParams.get('data.id')
      ?? url.searchParams.get('data_id')
      ?? url.searchParams.get('id')
      ?? body.data?.id
      ?? '',
    )

    if (type !== 'payment' || !dataId) {
      return jsonResponse({ received: true, skipped: true }, 200)
    }

    if (!(await verifyWebhookSignature(req, dataId))) {
      console.warn('[mercadopago-webhook] invalid_signature')
      return jsonResponse({ received: false }, 401)
    }

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
      headers: { 'Authorization': `Bearer ${getAccessToken()}` },
    })
    if (!paymentResponse.ok) {
      console.error('[mercadopago-webhook] payment_fetch_failed', paymentResponse.status)

      // El simulador oficial firma una notificación con un ID ficticio. Mercado Pago
      // responde 404 al consultar ese recurso; confirmamos la recepción porque no hay
      // una operación real que acreditar. Los fallos transitorios sí deben reintentarse.
      if (paymentResponse.status === 400 || paymentResponse.status === 404) {
        return jsonResponse({ received: true, skipped: true }, 200)
      }

      return jsonResponse({ received: false }, 502)
    }

    const payment = await paymentResponse.json()
    const orderId = String(payment.external_reference ?? payment.metadata?.order_id ?? '')
    if (!orderId) return jsonResponse({ received: true, skipped: true }, 200)

    const admin = createAdminClient()
    const { data: order, error: orderError } = await admin
      .from('payment_orders')
      .select('id, amount_cents, currency, environment, status')
      .eq('provider', 'mercadopago')
      .eq('provider_order_id', orderId)
      .maybeSingle()

    if (orderError) throw orderError
    if (!order) return jsonResponse({ received: true, skipped: true }, 200)

    const environment = getMercadoPagoEnvironment()
    const paymentAmountCents = amountToCents(payment.transaction_amount)
    if (
      paymentAmountCents !== order.amount_cents
      || payment.currency_id !== order.currency
      || environment !== order.environment
      || String(payment.external_reference ?? '') !== orderId
    ) {
      console.error('[mercadopago-webhook] payment_context_mismatch', orderId)
      return jsonResponse({ received: false }, 409)
    }

    const summary = safePaymentSummary(payment)
    const paymentMethod = payment.payment_type_id ?? payment.payment_method_id ?? 'unknown'

    if (payment.status === 'approved') {
      const { error: fulfillmentError } = await admin.rpc('fulfill_payment_order', {
        p_provider: 'mercadopago',
        p_provider_order_id: orderId,
        p_provider_payment_id: String(payment.id),
        p_amount_cents: paymentAmountCents,
        p_currency: payment.currency_id,
        p_environment: environment,
        p_payment_method: paymentMethod,
        p_provider_summary: summary,
      })
      if (fulfillmentError) throw fulfillmentError
      return jsonResponse({ received: true, status: 'paid' }, 200)
    }

    const status = ['pending', 'in_process', 'authorized'].includes(payment.status)
      ? 'pending'
      : ['refunded', 'charged_back'].includes(payment.status)
        ? 'refunded'
        : payment.status === 'cancelled'
          ? 'cancelled'
          : 'failed'

    let updateQuery = admin.from('payment_orders').update({
      provider_payment_id: String(payment.id),
      payment_method: paymentMethod,
      status,
      provider_summary: summary,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id)

    if (status !== 'refunded') updateQuery = updateQuery.neq('status', 'paid')
    const { error: updateError } = await updateQuery
    if (updateError) throw updateError

    return jsonResponse({ received: true, status }, 200)
  } catch (error) {
    console.error('[mercadopago-webhook]', error instanceof Error ? error.message : 'unknown_error')
    return jsonResponse({ received: false }, 500)
  }
})
