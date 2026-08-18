import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders, isAllowedOrigin, jsonResponse } from '../_shared/http.ts';
import {
  allowedRedirectOrigin,
  getEnvironmentSecret,
  getIzipayEnvironment,
} from '../_shared/izipay.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido.' }, 405, headers);
  }
  if (origin && !isAllowedOrigin(origin)) {
    return jsonResponse({ error: 'Origen no permitido.' }, 403, headers);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = req.headers.get('Authorization');

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
      return jsonResponse({ error: 'Sesión no válida.' }, 401, headers);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData.user;

    if (userError || !user || user.is_anonymous) {
      return jsonResponse({ error: 'Debes iniciar sesión para pagar.' }, 401, headers);
    }

    const body = await req.json().catch(() => ({}));
    const productId = typeof body.product_id === 'string' ? body.product_id.trim() : '';
    if (!UUID_PATTERN.test(productId)) {
      return jsonResponse({ error: 'Producto no válido.' }, 400, headers);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: product, error: productError } = await admin
      .from('store_products')
      .select('id,name,type,price,amount,active')
      .eq('id', productId)
      .eq('active', true)
      .single();

    if (productError || !product || !['coins', 'vip'].includes(product.type)) {
      return jsonResponse({ error: 'El producto no está disponible.' }, 404, headers);
    }

    const amountCents = Math.round(Number(product.price) * 100);
    const productAmount = Number(product.amount);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || !Number.isSafeInteger(productAmount) || productAmount <= 0) {
      throw new Error('invalid_product_configuration');
    }

    const environment = getIzipayEnvironment();
    const apiUser = Deno.env.get('IZIPAY_API_USER')?.trim();
    const apiPassword = getEnvironmentSecret('IZIPAY_API_PASSWORD', environment);
    const publicKey = getEnvironmentSecret('IZIPAY_PUBLIC_KEY', environment);
    const apiBaseUrl = Deno.env.get('IZIPAY_API_BASE_URL')?.trim().replace(/\/$/, '');
    const jsUrl = Deno.env.get('IZIPAY_JS_URL')?.trim();

    if (!apiUser || !apiBaseUrl || !jsUrl) {
      throw new Error('izipay_configuration_incomplete');
    }

    const orderId = crypto.randomUUID();
    const providerOrderId = `CL-${Date.now()}-${orderId.slice(0, 8)}`;
    const now = new Date().toISOString();
    const { error: orderError } = await admin.from('payment_orders').insert({
      id: orderId,
      user_id: user.id,
      product_id: product.id,
      provider: 'izipay',
      provider_order_id: providerOrderId,
      status: 'created',
      currency: 'PEN',
      amount_cents: amountCents,
      product_type: product.type,
      product_amount: productAmount,
      environment,
      created_at: now,
      updated_at: now,
    });

    if (orderError) throw new Error(`order_creation_failed:${orderError.code ?? 'unknown'}`);

    const apiResponse = await fetch(`${apiBaseUrl}/api-payment/V4/Charge/CreatePayment`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${apiUser}:${apiPassword}`)}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountCents,
        currency: 'PEN',
        customer: {
          email: user.email ?? undefined,
          reference: user.id,
        },
        orderId: providerOrderId,
      }),
    });

    const apiPayload = await apiResponse.json().catch(() => null);
    const formToken = apiPayload?.answer?.formToken;
    if (!apiResponse.ok || apiPayload?.status !== 'SUCCESS' || typeof formToken !== 'string') {
      await admin
        .from('payment_orders')
        .update({
          status: 'failed',
          provider_summary: {
            error_code: apiPayload?.answer?.errorCode ?? apiPayload?.ticket ?? 'create_payment_failed',
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);
      throw new Error('izipay_form_token_failed');
    }

    await admin
      .from('payment_orders')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', orderId);

    const redirectOrigin = allowedRedirectOrigin(origin);
    const postUrlSuccess = `${supabaseUrl}/functions/v1/izipay-return?redirect_origin=${encodeURIComponent(redirectOrigin)}`;

    return jsonResponse({
      order_id: orderId,
      form_token: formToken,
      public_key: publicKey,
      js_url: jsUrl,
      css_url: 'https://static.micuentaweb.pe/static/js/krypton-client/V4.0/ext/classic.css',
      theme_url: 'https://static.micuentaweb.pe/static/js/krypton-client/V4.0/ext/classic.js',
      post_url_success: postUrlSuccess,
      environment,
    }, 200, headers);
  } catch (error) {
    console.error('[izipay-create-payment]', error instanceof Error ? error.message : 'unknown_error');
    return jsonResponse({ error: 'No se pudo iniciar el pago con Izipay. Intenta nuevamente.' }, 500, headers);
  }
});
