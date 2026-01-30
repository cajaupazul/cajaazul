'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, AlertCircle, ArrowRight, LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

/**
 * PUBLIC CHECKOUT RESULT PAGE
 * 
 * This page is 100% public and does NOT depend on authentication.
 * It serves as a landing page for Mercado Pago redirects.
 * 
 * Key Features:
 * - No SSR (client-side only with 'use client')
 * - No auth guards or middleware
 * - No automatic redirects
 * - Shows manual buttons based on session state
 * - Compatible with Cloudflare Edge Runtime
 */
export default function CheckoutResultPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [hasSession, setHasSession] = useState<boolean | null>(null);
    const [isCheckingSession, setIsCheckingSession] = useState(true);

    const status = searchParams.get('status') || 'success';
    const paymentId = searchParams.get('payment_id');

    // Check for session AFTER page loads (client-side only)
    useEffect(() => {
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                setHasSession(!!session);
            } catch (error) {
                console.error('Error checking session:', error);
                setHasSession(false);
            } finally {
                setIsCheckingSession(false);
            }
        };

        // Small delay to ensure page renders first
        const timer = setTimeout(checkSession, 300);
        return () => clearTimeout(timer);
    }, []);

    const getStatusConfig = () => {
        switch (status) {
            case 'success':
                return {
                    icon: CheckCircle2,
                    iconColor: 'text-green-500',
                    bgColor: 'bg-green-500/10',
                    borderColor: 'border-green-500/20',
                    title: '¡Pago Exitoso!',
                    message: 'Tu transacción ha sido procesada correctamente por Mercado Pago.',
                    detail: 'Los beneficios se verán reflejados en tu cuenta en breve.',
                };
            case 'failure':
                return {
                    icon: XCircle,
                    iconColor: 'text-red-500',
                    bgColor: 'bg-red-500/10',
                    borderColor: 'border-red-500/20',
                    title: 'Pago Rechazado',
                    message: 'No pudimos procesar tu pago.',
                    detail: 'Por favor, intenta de nuevo o contacta a soporte si el problema persiste.',
                };
            case 'pending':
                return {
                    icon: AlertCircle,
                    iconColor: 'text-yellow-500',
                    bgColor: 'bg-yellow-500/10',
                    borderColor: 'border-yellow-500/20',
                    title: 'Pago Pendiente',
                    message: 'Tu pago está siendo procesado por Mercado Pago.',
                    detail: 'Te avisaremos cuando se complete la transacción.',
                };
            default:
                return {
                    icon: AlertCircle,
                    iconColor: 'text-blue-500',
                    bgColor: 'bg-blue-500/10',
                    borderColor: 'border-blue-500/20',
                    title: 'Procesando',
                    message: 'Estamos verificando tu pago.',
                    detail: 'Por favor espera un momento.',
                };
        }
    };

    const config = getStatusConfig();
    const StatusIcon = config.icon;

    const handleGoToDashboard = () => {
        router.push('/dashboard/store?status=' + status);
    };

    const handleGoToLogin = () => {
        router.push('/auth/login?redirect=/dashboard/store');
    };

    return (
        <div className="min-h-screen bg-bb-dark flex flex-col items-center justify-center p-4">
            <div className={`max-w-md w-full bg-bb-card border ${config.borderColor} p-8 rounded-[2.5rem] shadow-2xl text-center space-y-6 animate-in fade-in zoom-in duration-500`}>
                {/* Status Icon */}
                <div className="flex justify-center">
                    <div className="relative">
                        <div className={`absolute inset-0 ${config.bgColor} blur-3xl opacity-20 animate-pulse`} />
                        <StatusIcon className={`w-20 h-20 ${config.iconColor} relative z-10`} />
                    </div>
                </div>

                {/* Status Message */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-black text-bb-text tracking-tight uppercase italic">
                        {config.title}
                    </h1>
                    <p className="text-bb-text-secondary text-lg">
                        {config.message}
                    </p>
                    <p className="text-bb-text-secondary text-sm">
                        {config.detail}
                    </p>
                </div>

                {/* Payment ID (if available) */}
                {paymentId && (
                    <div className={`${config.bgColor} p-4 rounded-2xl border ${config.borderColor}`}>
                        <p className="text-xs text-bb-text-secondary font-mono">
                            ID: {paymentId}
                        </p>
                    </div>
                )}

                {/* Action Buttons - Manual Navigation Only */}
                <div className="pt-4 space-y-3">
                    {isCheckingSession ? (
                        <div className="flex items-center justify-center gap-2 text-bb-text-secondary py-3">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-sm">Verificando sesión...</span>
                        </div>
                    ) : hasSession ? (
                        <Button
                            onClick={handleGoToDashboard}
                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl gap-2 shadow-lg transition-all active:scale-95"
                        >
                            Ir al Dashboard
                            <ArrowRight size={18} />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleGoToLogin}
                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl gap-2 shadow-lg transition-all active:scale-95"
                        >
                            Iniciar Sesión
                            <LogIn size={18} />
                        </Button>
                    )}

                    {/* Secondary Action */}
                    {!hasSession && (
                        <p className="text-xs text-bb-text-secondary">
                            ¿Ya tienes cuenta? Inicia sesión para ver tus beneficios
                        </p>
                    )}
                </div>
            </div>

            {/* Footer Branding */}
            <div className="mt-8 opacity-30">
                <p className="text-[10px] text-bb-text-secondary font-bold uppercase tracking-[0.2em]">
                    CampusLink Secure Checkout
                </p>
            </div>
        </div>
    );
}
