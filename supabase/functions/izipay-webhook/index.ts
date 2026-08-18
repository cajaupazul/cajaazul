import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  getEnvironmentSecret,
  getIzipayEnvironment,
  parseIzipayAnswer,
  processIzipayAnswer,
  verifyIzipayHash,
} from '../_shared/izipay.ts';

const MAX_BODY_BYTES = 1_000_000;

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const rawBody = await req.text();
    if (rawBody.length === 0 || rawBody.length > MAX_BODY_BYTES) {
      return new Response('Invalid body', { status: 400 });
    }

    const form = new URLSearchParams(rawBody);
    const rawAnswer = form.get('kr-answer') ?? '';
    const receivedHash = form.get('kr-hash') ?? '';
    const hashAlgorithm = form.get('kr-hash-algorithm')?.toLowerCase();
    const hashKey = form.get('kr-hash-key')?.toLowerCase();

    if (hashAlgorithm !== 'sha256_hmac' || hashKey !== 'password') {
      return new Response('Invalid signature metadata', { status: 401 });
    }

    const environment = getIzipayEnvironment();
    const apiPassword = getEnvironmentSecret('IZIPAY_API_PASSWORD', environment);
    if (!(await verifyIzipayHash(rawAnswer, receivedHash, apiPassword))) {
      return new Response('Invalid signature', { status: 401 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('supabase_configuration_incomplete');

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const answer = parseIzipayAnswer(rawAnswer);
    const result = await processIzipayAnswer(admin, answer, environment);

    return new Response(`OK! Order Status: ${result.status}`, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[izipay-webhook]', error instanceof Error ? error.message : 'unknown_error');
    return new Response('Temporary processing error', { status: 500 });
  }
});
