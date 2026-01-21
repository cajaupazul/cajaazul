import { supabase } from './supabase';

/**
 * Performs a comprehensive logout:
 * 1. Signs out from Supabase Auth
 * 2. Clears localStorage and sessionStorage
 * 3. Clears authentication-related cookies
 * 4. Force redirects to login page with an optional message
 */
export async function handleDeepLogout(message?: string) {
    try {
        // 1. Supabase SignOut
        await supabase.auth.signOut();

        // 2. Clear browser storage
        if (typeof window !== 'undefined') {
            window.localStorage.clear();
            window.sessionStorage.clear();

            // 3. Clear auth cookies (best effort)
            document.cookie.split(";").forEach((c) => {
                document.cookie = c
                    .replace(/^ +/, "")
                    .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });

            // 4. Force hard redirect to login
            const baseUrl = window.location.origin;
            let targetUrl = `${baseUrl}/auth/login`;
            if (message) {
                targetUrl += `?error=${encodeURIComponent(message)}`;
            }

            console.log('[DEEP_LOGOUT] Redirecting to:', targetUrl);
            window.location.replace(targetUrl);
        }
    } catch (error) {
        console.error('[DEEP_LOGOUT_ERROR]', error);
        if (typeof window !== 'undefined') {
            window.location.replace('/auth/login');
        }
    }
}
