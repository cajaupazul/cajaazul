'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/lib/profile-context';
import styles from './GoogleButton.module.css';

export function GoogleButton({ text = 'Continuar con Google' }: { text?: string }) {
    const [loading, setLoading] = useState(false);
    const { clearProfile } = useProfile();

    const handleGoogleLogin = async () => {
        // NUCLEAR OPTION: Clear old state before OAuth
        clearProfile();

        setLoading(true);

        // SAFE OAUTH LOGIC:
        // Since signInWithOAuth redirects the user away from the app,
        // we need to handle the case where the user cancels the flow and returns
        // to this page (e.g., via the "Back" button or closing the Google tab).

        const resetLoading = () => setLoading(false);

        // CLEANUP: Remove stale profile/session data, but PRESERVE Supabase PKCE keys (sb-*)
        if (typeof window !== 'undefined') {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && !key.startsWith('sb-')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
            console.log('[AUTH_CLEANUP] Cleared non-Supabase keys, preserved PKCE verifier');
        }

        // 1. Focus listener: If the user returns to the window, they likely cancelled.
        // We use a slight delay to allow the auth session to potentially hydrate first
        // if they actually succeeded but the redirect was weirdly fast.
        const handleFocus = () => {
            setTimeout(resetLoading, 2000);
            window.removeEventListener('focus', handleFocus);
        };
        window.addEventListener('focus', handleFocus);

        // 2. Timeout fail-safe: In case the redirect process hangs or fails silently.
        const safetyTimeout = setTimeout(resetLoading, 10000);

        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(window.location.pathname.startsWith('/auth') ? '/auth/complete-profile' : window.location.pathname)}`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'select_account',
                        // Se eliminó 'hd' para permitir que el usuario seleccione cualquier cuenta en Google
                    },
                },
            });

            if (error) {
                clearTimeout(safetyTimeout);
                window.removeEventListener('focus', handleFocus);
                throw error;
            }
        } catch (error: any) {
            console.error('Error Google OAuth:', error);

            // Tratamiento de error específico para restricción de dominio
            if (error.message?.includes('dominio') || error.message?.includes('domain')) {
                alert('Acceso denegado: Debes utilizar obligatoriamente tu correo institucional (@alum.up.edu.pe) para entrar.');
            } else {
                alert('Error al iniciar sesión con Google: ' + error.message);
            }

            resetLoading();
        }
    };

    return (
        <Button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className={styles.button}
            aria-busy={loading}
        >
            <span className={styles.buttonContent}>
                {loading ? (
                    <span className={styles.spinner} aria-hidden="true" />
                ) : (
                <svg className={styles.googleIcon} viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                    />
                    <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                    />
                    <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                        fill="#FBBC05"
                    />
                    <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                    />
                </svg>
                )}
                <span>{loading ? 'Abriendo Google…' : text}</span>
            </span>
        </Button>
    );
}
