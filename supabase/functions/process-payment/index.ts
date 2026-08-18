import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import {
  amountToCents,
  createAdminClient,
  getAccessToken,
  getCorsHeaders,
  getMercadoPagoEnvironment,
  getWebhookUrl,
  jsonResponse,
  requireUser,
  safePaymentSummary,
} from '../_shared/mercadopago.ts'

const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ success: false, message: 'Método no permitido.' }, 405, corsHeaders)

  try {
    const admin = createAdminClient()
    const user = await requireUser(req, admin)
    const { formData, product_id: productId, request_id: requestId } = await req.json()

    if (!formData || !productId || !REQUEST_ID_PATTERN.test(String(requestId ?? ''))) {
      return jsonResponse({ success: false, message: 'La solicitud de pago no es válida.' }, 400, corsHeaders)
    }

    const { data: product, error: productError } = await admin
      .from('store_products')
      .select('id, name, type, amount, price, active')
      .eq('id', productId)
      .eq('active', true)
      .single()

    if (productError || !product || !['coins', 'vip'].includes(product.type)) {
      return jsonResponse({ success: false, message: 'El producto ya no está disponible.' }, 404, corsHeaders)
    }

    const amountCents = amountToCents(product.price)
    const environment = getMercadoPagoEnvironment()
    const orderId = String(requestId)

    const { data: existingOrder } = await admin
      .from('payment_orders')
      .select('id, user_id, product_id, amount_cents, status, provider_payment_id')
      .eq('provider', 'mercadopago')
      .eq('provider_order_id', orderId)
      .maybeSingle()

    if (existingOrder && (
      existingOrder.user_id !== user.id
      || existingOrder.product_id !== product.id
      || existingOrder.amount_cents !== amountCents
    )) {
      return jsonResponse({ success: false, message: 'El intento de pago no coincide con la compra.' }, 409, corsHeaders)
    }

    if (existingOrder?.status === 'paid') {
      return jsonResponse({ success: true, status: 'approved', payment_id: existingOrder.provider_payment_id }, 200, corsHeaders)
    }

    if (!existingOrder) {
      const { error: insertError } = await admin.from('payment_orders').insert({
        user_id: user.id,
        product_id: product.id,
        provider: 'mercadopago',
        provider_order_id: orderId,
        status: 'created',
        currency: 'PEN',
        amount_cents: amountCents,
        product_type: product.type,
        product_amount: Number(product.amount),
        environment,
      })
      if (insertError && insertError.code !== '23505') throw insertError
    }

    const payer = typeof formData.payer === 'object' && formData.payer ? formData.payer : {}
    const installments = Number(formData.installments ?? 1)
    const paymentBody = {
      ...(typeof formData.token === 'string' ? { token: formData.token } : {}),
      ...(typeof formData.issuer_id === 'string' || typeof formData.issuer_id === 'number'
        ? { issuer_id: String(formData.issuer_id) }
        : {}),
      payment_method_id: String(formData.payment_method_id ?? ''),
      installments: Number.isInteger(installments) && installments > 0 ? installments : 1,
      transaction_amount: amountCents / 100,
      description: `CampusLink: ${product.name}`,
      external_reference: orderId,
      metadata: { order_id: orderId },
      notification_url: getWebhookUrl(),
      payer: {
        email: user.email,
        ...(payer.identification && typeof payer.identification === 'object'
          ? { identification: payer.identification }
          : {}),
      },
    }

    if (!paymentBody.payment_method_id || !paymentBody.payer.email) {
      return jsonResponse({ success: false, message: 'Faltan datos necesarios para procesar el pago.' }, 400, corsHeaders)
    }

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAccessToken()}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': orderId,
      },
      body: JSON.stringify(paymentBody),
    })
    const payment = await mpResponse.json()

    if (!mpResponse.ok || !payment.id) {
      await admin.from('payment_orders').update({
        status: 'failed',
        provider_summary: {
          status: payment.status ?? null,
          status_detail: payment.status_detail ?? payment.error ?? null,
        },
        updated_at: new Date().toISOString(),
      }).eq('provider', 'mercadopago').eq('provider_order_id', orderId).neq('status', 'paid')

      return jsonResponse({
        success: false,
        status: payment.status ?? 'rejected',
        message: payment.message ?? payment.status_detail ?? 'Mercado Pago no pudo procesar el cobro.',
      }, 200, corsHeaders)
    }

    const summary = safePaymentSummary(payment)
    const paymentMethod = payment.payment_type_id ?? payment.payment_method_id ?? 'unknown'

    if (payment.status === 'approved') {
      const { error: fulfillmentError } = await admin.rpc('fulfill_payment_order', {
        p_provider: 'mercadopago',
        p_provider_order_id: orderId,
        p_provider_payment_id: String(payment.id),
        p_amount_cents: amountToCents(payment.transaction_amount),
        p_currency: payment.currency_id,
        p_environment: environment,
        p_payment_method: paymentMethod,
        p_provider_summary: summary,
      })

      if (fulfillmentError) {
        console.error('[process-payment] fulfillment_failed', fulfillmentError.message)
        return jsonResponse({
          success: false,
          status: 'pending',
          payment_id: payment.id,
          message: 'El pago fue recibido y estamos terminando de acreditarlo.',
        }, 200, corsHeaders)
      }

      return jsonResponse({ success: true, status: 'approved', payment_id: payment.id }, 200, corsHeaders)
    }

    const nextStatus = ['pending', 'in_process', 'authorized'].includes(payment.status) ? 'pending' : 'failed'
    await admin.from('payment_orders').update({
      provider_payment_id: String(payment.id),
      payment_method: paymentMethod,
      status: nextStatus,
      provider_summary: summary,
      updated_at: new Date().toISOString(),
    }).eq('provider', 'mercadopago').eq('provider_order_id', orderId).neq('status', 'paid')

    return jsonResponse({
      success: false,
      status: nextStatus,
      payment_id: payment.id,
      external_resource_url: typeof payment.transaction_details?.external_resource_url === 'string'
        ? payment.transaction_details.external_resource_url
        : undefined,
      message: nextStatus === 'pending'
        ? 'Mercado Pago está confirmando el pago. Te avisaremos cuando se acredite.'
        : payment.status_detail ?? 'El pago fue rechazado. Revisa los datos e intenta nuevamente.',
    }, 200, corsHeaders)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    const status = message === 'unauthorized' ? 401 : 500
    console.error('[process-payment]', message)
    return jsonResponse({
      success: false,
      message: status === 401 ? 'Tu sesión venció. Inicia sesión nuevamente.' : 'No pudimos procesar el pago. Intenta nuevamente.',
    }, status, corsHeaders)
  }
})
