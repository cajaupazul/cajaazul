import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

export type MercadoPagoEnvironment = 'test' | 'production'

const DEFAULT_ALLOWED_ORIGINS = [
  'https://cajaazul.pages.dev',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const configured = (Deno.env.get('CAMPUSLINK_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const allowed = new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured])

  return {
    'Access-Control-Allow-Origin': allowed.has(origin) ? origin : DEFAULT_ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function getAdminKey() {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  if (legacyKey) return legacyKey

  const rawKeys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (rawKeys) {
    const parsed = JSON.parse(rawKeys) as Record<string, string>
    const key = parsed.default ?? Object.values(parsed)[0]
    if (key) return key
  }

  throw new Error('supabase_admin_key_missing')
}

export function createAdminClient() {
  const url = Deno.env.get('SUPABASE_URL')?.trim()
  if (!url) throw new Error('supabase_url_missing')
  return createClient(url, getAdminKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function requireUser(req: Request, admin = createAdminClient()) {
  const authorization = req.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) throw new Error('unauthorized')

  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) throw new Error('unauthorized')
  return user
}

export function getAccessToken() {
  const token = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')?.trim()
  if (!token) throw new Error('mercadopago_access_token_missing')
  return token
}

export function getMercadoPagoEnvironment(): MercadoPagoEnvironment {
  return Deno.env.get('MERCADOPAGO_ENVIRONMENT')?.trim().toLowerCase() === 'test'
    ? 'test'
    : 'production'
}

export function getWebhookUrl() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim().replace(/\/$/, '')
  if (!supabaseUrl) throw new Error('supabase_url_missing')
  return `${supabaseUrl}/functions/v1/mercadopago-webhook`
}

export function amountToCents(value: unknown) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('invalid_amount')
  return Math.round(amount * 100)
}

export function safePaymentSummary(payment: Record<string, any>) {
  return {
    status: payment.status ?? null,
    status_detail: payment.status_detail ?? null,
    payment_method_id: payment.payment_method_id ?? null,
    payment_type_id: payment.payment_type_id ?? null,
    date_approved: payment.date_approved ?? null,
    live_mode: payment.live_mode ?? null,
  }
}

function hexToBytes(value: string) {
  if (!/^[a-f0-9]{64}$/i.test(value)) return null
  return new Uint8Array(value.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)))
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index]
  }
  return difference === 0
}

export async function verifyWebhookSignature(req: Request, dataId: string) {
  const secret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET')?.trim()
  const signature = req.headers.get('x-signature') ?? ''
  const requestId = req.headers.get('x-request-id') ?? ''
  if (!secret || !signature || !requestId || !dataId) return false

  const parts = Object.fromEntries(
    signature.split(',').map((part) => {
      const [key, ...value] = part.trim().split('=')
      return [key, value.join('=')]
    }),
  )
  const timestamp = parts.ts
  const receivedHex = parts.v1
  const received = receivedHex ? hexToBytes(receivedHex) : null
  if (!timestamp || !received) return false

  const normalizedDataId = /[a-z]/i.test(dataId) ? dataId.toLowerCase() : dataId
  const manifest = `id:${normalizedDataId};request-id:${requestId};ts:${timestamp};`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const calculated = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest)),
  )
  return constantTimeEqual(calculated, received)
}

export function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}
