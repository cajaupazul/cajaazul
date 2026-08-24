const INSTITUTIONAL_SUFFIX = '@alum.up.edu.pe';
const FALLBACK_API_URL = 'https://campuslink-api.cajaupazul.workers.dev';

export type AccountAccessResult = {
  allowed: boolean;
  source?: 'institutional' | 'exception' | 'anonymous';
  reason?: 'missing_email' | 'not_approved' | 'expired' | 'revoked' | 'unavailable';
};

export function isInstitutionalEmail(email: string | null | undefined) {
  return Boolean(email?.trim().toLowerCase().endsWith(INSTITUTIONAL_SUFFIX));
}

export async function verifyAccountAccess(
  accessToken: string,
  email: string | null | undefined,
): Promise<AccountAccessResult> {
  if (isInstitutionalEmail(email)) return { allowed: true, source: 'institutional' };
  if (!email) return { allowed: false, reason: 'missing_email' };

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || FALLBACK_API_URL).replace(/\/$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);

  try {
    const response = await fetch(`${apiUrl}/auth/access`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (response.status === 403) {
      const body = await response.json().catch(() => ({})) as { reason?: AccountAccessResult['reason'] };
      return { allowed: false, reason: body.reason || 'not_approved' };
    }
    if (!response.ok) return { allowed: false, reason: 'unavailable' };
    return await response.json() as AccountAccessResult;
  } catch {
    return { allowed: false, reason: 'unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}
