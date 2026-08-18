import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getCorsHeaders, jsonResponse } from '../_shared/mercadopago.ts'

// Checkout Pro was replaced by the embedded Mercado Pago Payment Brick.
// Keeping this authenticated endpoint as an explicit tombstone prevents old
// clients from creating payment preferences through the retired flow.
serve((req) => {
  const headers = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  return jsonResponse({
    error: 'checkout_flow_retired',
    message: 'Actualiza la página para utilizar el pago integrado de Mercado Pago.',
  }, 410, headers)
})
