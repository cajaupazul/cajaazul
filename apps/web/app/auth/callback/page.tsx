'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const handleCallback = async () => {
            const code = searchParams.get('code');
            const nextParam = searchParams.get('next');
            const errorParam = searchParams.get('error_description') || searchParams.get('error');

            if (errorParam) {
                router.push(`/auth/login?error=${encodeURIComponent(errorParam)}`);
                return;
            }

            if (code) {
                try {
                    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

                    if (error) throw error;

                    if (session) {
                        const user = session.user;
                        const email = user.email || '';

                        // STRICT DOMAIN ENFORCEMENT
                        if (!email.toLowerCase().endsWith('@alum.up.edu.pe')) {
                            console.warn(`[AUTH_GATE] Blocked unauthorized domain: ${email}`);
                            await supabase.auth.signOut();
                            router.push('/auth/login?error=DOMAIN_RESTRICTED');
                            return;
                        }

                        // AUTO-REDIRECT FOR REGISTERED USERS
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('nombre, carrera')
                            .eq('id', user.id)
                            .single();

                        if (profile) {
                            const isComplete = profile.nombre &&
                                profile.nombre.trim().length > 0 &&
                                profile.carrera &&
                                !['Estudiante', 'General', 'Carrera', ''].includes(profile.carrera);

                            if (isComplete) {
                                router.push(nextParam || '/dashboard');
                                return;
                            }
                        }

                        // If not complete, go to onboarding
                        router.push(nextParam ?? '/auth/complete-profile');
                    }
                } catch (error: any) {
                    console.error('Auth callback error:', error.message);
                    router.push(`/auth/login?error=${encodeURIComponent(error.message || 'Error de autenticación')}`);
                }
            } else {
                router.push('/auth/login?error=Invalid%20auth%20code');
            }
        };

        handleCallback();
    }, [router, searchParams]);

    return (
        <div className="min-h-screen bg-bb-dark flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-bb-text-secondary animate-pulse text-sm">Procesando inicio de sesión...</p>
            </div>
        </div>
    );
}

export default function AuthCallback() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-bb-dark flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-bb-text-secondary animate-pulse text-sm">Cargando...</p>
                </div>
            </div>
        }>
            <AuthCallbackContent />
        </Suspense>
    );
}
