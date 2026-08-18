import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  allowedRedirectOrigin,
  getEnvironmentSecret,
  getIzipayEnvironment,
  parseIzipayAnswer,
  processIzipayAnswer,
  verifyIzipayHash,
} from '../_shared/izipay.ts';

function redirect(origin: string, status: string, orderId?: string) {
  const target = new URL('/payment/result', origin);
  target.searchParams.set('provider', 'izipay');
  target.searchParams.set('status', status);
  if (orderId) target.searchParams.set('order_id', orderId);

  return new Response(null, {
    status: 303,
    headers: { Location: target.toString(), 'Cache-Control': 'no-store' },
  });
}

serve(async (req) => {
  const requestUrl = new URL(req.url);
  const redirectOrigin = allowedRedirectOrigin(requestUrl.searchParams.get('redirect_origin'));

  if (req.method !== 'POST') return redirect(redirectOrigin, 'error');

  try {
    const rawBody = await req.text();
    if (rawBody.length === 0 || rawBody.length > 1_000_000) return redirect(redirectOrigin, 'error');

    const form = new URLSearchParams(rawBody);
    const rawAnswer = form.get('kr-answer') ?? '';
    const receivedHash = form.get('kr-hash') ?? '';
    const hashAlgorithm = form.get('kr-hash-algorithm')?.toLowerCase();
    const hashKey = form.get('kr-hash-key')?.toLowerCase();
    const environment = getIzipayEnvironment();

    if (hashAlgorithm !== 'sha256_hmac' || hashKey !== 'sha256_hmac') {
      return redirect(redirectOrigin, 'error');
    }

    const hmacKey = getEnvironmentSecret('IZIPAY_HMAC_KEY', environment);
    if (!(await verifyIzipayHash(rawAnswer, receivedHash, hmacKey))) {
      return redirect(redirectOrigin, 'error');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('supabase_configuration_incomplete');

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const answer = parseIzipayAnswer(rawAnswer);
    const providerOrderId = answer.orderDetails?.orderId;
    await processIzipayAnswer(admin, answer, environment);

    const { data: order } = await admin
      .from('payment_orders')
      .select('id,status')
      .eq('provider', 'izipay')
      .eq('provider_order_id', providerOrderId)
      .single();

    return redirect(redirectOrigin, order?.status ?? 'pending', order?.id);
  } catch (error) {
    console.error('[izipay-return]', error instanceof Error ? error.message : 'unknown_error');
    return redirect(redirectOrigin, 'error');
  }
});
