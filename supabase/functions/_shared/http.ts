const allowedProductionOrigins = new Set([
  'https://cajaazul.pages.dev',
]);

export function isAllowedOrigin(origin: string | null) {
  if (!origin) return false;
  if (allowedProductionOrigins.has(origin)) return true;

  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

export function corsHeaders(origin: string | null) {
  const allowedOrigin = isAllowedOrigin(origin) ? origin! : 'https://cajaazul.pages.dev';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
