export type IzipayEnvironment = 'test' | 'production';

export type IzipayAnswer = {
  shopId?: string;
  orderStatus?: string;
  orderDetails?: {
    orderTotalAmount?: number;
    orderPaidAmount?: number;
    orderCurrency?: string;
    mode?: string;
    orderId?: string;
  };
  transactions?: Array<{
    uuid?: string;
    amount?: number;
    currency?: string;
    status?: string;
    detailedStatus?: string;
    paymentMethodType?: string;
  }>;
};

const encoder = new TextEncoder();

export function getIzipayEnvironment(): IzipayEnvironment {
  return Deno.env.get('IZIPAY_ENVIRONMENT')?.trim().toLowerCase() === 'production'
    ? 'production'
    : 'test';
}

export function getEnvironmentSecret(baseName: string, environment: IzipayEnvironment): string {
  const suffix = environment === 'production' ? 'PRODUCTION' : 'TEST';
  const value = Deno.env.get(`${baseName}_${suffix}`)?.trim();

  if (!value) {
    throw new Error(`${baseName}_${suffix} is not configured`);
  }

  return value;
}

export async function verifyIzipayHash(
  answer: string,
  receivedHash: string,
  secret: string,
): Promise<boolean> {
  if (!answer || !receivedHash || !secret || !/^[a-f0-9]{64}$/i.test(receivedHash)) {
    return false;
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(answer));
  const expectedHash = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  const expected = encoder.encode(expectedHash.toLowerCase());
  const received = encoder.encode(receivedHash.toLowerCase());
  if (expected.length !== received.length) return false;

  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected[index] ^ received[index];
  }

  return difference === 0;
}

export function parseIzipayAnswer(rawAnswer: string): IzipayAnswer {
  const parsed = JSON.parse(rawAnswer) as IzipayAnswer;

  if (!parsed || typeof parsed !== 'object' || !parsed.orderDetails?.orderId) {
    throw new Error('invalid_izipay_answer');
  }

  return parsed;
}

export function sanitizeIzipaySummary(answer: IzipayAnswer) {
  const transaction = answer.transactions?.[0];
  return {
    order_status: answer.orderStatus ?? null,
    transaction_status: transaction?.status ?? null,
    detailed_status: transaction?.detailedStatus ?? null,
    payment_method: transaction?.paymentMethodType ?? null,
  };
}

export function mapIzipayStatus(orderStatus?: string) {
  switch (orderStatus?.toUpperCase()) {
    case 'PAID':
      return 'paid';
    case 'UNPAID':
    case 'FAILED':
      return 'failed';
    case 'CANCELLED':
    case 'ABANDONED':
      return 'cancelled';
    default:
      return 'pending';
  }
}

export async function processIzipayAnswer(
  supabaseAdmin: any,
  answer: IzipayAnswer,
  environment: IzipayEnvironment,
) {
  const expectedMode = environment === 'production' ? 'PRODUCTION' : 'TEST';
  const order = answer.orderDetails;
  const providerOrderId = order?.orderId?.trim();
  const amountCents = Number(order?.orderTotalAmount);
  const currency = order?.orderCurrency?.toUpperCase();
  const mode = order?.mode?.toUpperCase();
  const shopId = answer.shopId?.trim();
  const expectedShopId = Deno.env.get('IZIPAY_API_USER')?.trim();

  if (!providerOrderId || !Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error('invalid_order_details');
  }
  if (currency !== 'PEN' || mode !== expectedMode || !expectedShopId || shopId !== expectedShopId) {
    throw new Error('izipay_context_mismatch');
  }

  const summary = sanitizeIzipaySummary(answer);
  const mappedStatus = mapIzipayStatus(answer.orderStatus);
  const transaction = answer.transactions?.[0];

  if (mappedStatus === 'paid') {
    if (
      !transaction?.uuid ||
      transaction.status?.toUpperCase() !== 'PAID' ||
      Number(transaction.amount) !== amountCents ||
      transaction.currency?.toUpperCase() !== currency
    ) {
      throw new Error('paid_transaction_mismatch');
    }

    const { data, error } = await supabaseAdmin.rpc('fulfill_payment_order', {
      p_provider: 'izipay',
      p_provider_order_id: providerOrderId,
      p_provider_payment_id: transaction.uuid,
      p_amount_cents: amountCents,
      p_currency: currency,
      p_environment: environment,
      p_payment_method: transaction.paymentMethodType ?? null,
      p_provider_summary: summary,
    });

    if (error) throw new Error(`fulfillment_failed:${error.code ?? 'unknown'}`);
    return { status: 'paid', order: data };
  }

  const { data: currentOrder, error: readError } = await supabaseAdmin
    .from('payment_orders')
    .select('id,status')
    .eq('provider', 'izipay')
    .eq('provider_order_id', providerOrderId)
    .single();

  if (readError || !currentOrder) throw new Error('payment_order_not_found');

  if (currentOrder.status !== 'paid') {
    const { error: updateError } = await supabaseAdmin
      .from('payment_orders')
      .update({
        status: mappedStatus,
        provider_payment_id: transaction?.uuid ?? null,
        payment_method: transaction?.paymentMethodType ?? null,
        provider_summary: summary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentOrder.id)
      .neq('status', 'paid');

    if (updateError) throw new Error(`order_update_failed:${updateError.code ?? 'unknown'}`);
  }

  return { status: currentOrder.status === 'paid' ? 'paid' : mappedStatus, order: currentOrder };
}

export function allowedRedirectOrigin(candidate: string | null): string {
  const productionOrigin = 'https://cajaazul.pages.dev';
  if (!candidate) return productionOrigin;

  try {
    const parsed = new URL(candidate);
    const isLocal = parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
    if (parsed.origin === productionOrigin || isLocal) return parsed.origin;
  } catch {
    // Use the production origin below.
  }

  return productionOrigin;
}
