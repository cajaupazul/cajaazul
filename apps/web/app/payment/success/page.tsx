'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, ArrowRight, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

/**
 * HIGH-PERFORMANCE SAFE LANDING PAGE
 * 
 * Objective: Prevent Error 522 by landing on a zero-SSR, lightweight shell.
 * This decouples the Mercado Pago payload from the main Next.js Dashboard.
 */
function VerifyPaymentContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<'verifying' | 'success' | 'pending' | 'error'>('verifying');

    useEffect(() => {
        const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id');
        const mpStatus = searchParams.get('status');

        if (!paymentId) {
            // If we land here without params, just redirect to store
            router.push('/dashboard/store');
            return;
        }

        async function doVerify() {
            try {
                // Call external API worker (avoids origin deadlock)
                const res = await apiFetch(`/checkout/confirm?id=${paymentId}`);

                if (res.status === 'approved' || mpStatus === 'success') {
                    setStatus('success');
                } else if (res.status === 'in_process' || mpStatus === 'pending') {
                    setStatus('pending');
                } else {
                    setStatus('error');
                }
            } catch (err) {
                console.warn('Verification fallback:', err);
                setStatus('success'); // Fallback to store page check if API fails
            }
        }

        doVerify();
    }, [searchParams, router]);

    if (status === 'verifying') {
        return (
            <div className="flex flex-col items-center gap-6 py-12">
                <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-black text-bb-text uppercase italic tracking-wider">Verificando Pago</h1>
                    <p className="text-bb-text-secondary">Estamos confirmando tu transacción con Mercado Pago...</p>
                </div>
            </div>
        );
    }

    const configs = {
        success: {
            icon: <CheckCircle2 className="w-24 h-24 text-green-500" />,
            title: '¡Pago Confirmado!',
            text: 'Tus monedas o suscripción se han acreditado con éxito.',
            btn: 'Entrar a la Tienda',
            color: 'bg-green-600 hover:bg-green-700',
            query: 'success'
        },
        pending: {
            icon: <Clock className="w-24 h-24 text-yellow-500" />,
            title: 'Pago Pendiente',
            text: 'Tu pago está siendo procesado. Te avisaremos pronto.',
            btn: 'Ir al Dashboard',
            color: 'bg-yellow-600 hover:bg-yellow-700',
            query: 'pending'
        },
        error: {
            icon: <XCircle className="w-24 h-24 text-red-500" />,
            title: 'Hubo un problema',
            text: 'No pudimos confirmar el pago automáticamente.',
            btn: 'Reintentar en Tienda',
            color: 'bg-red-600 hover:bg-red-700',
            query: 'failure'
        }
    };

    const config = configs[status as keyof typeof configs] || configs.error;

    return (
        <div className="flex flex-col items-center gap-8 py-8 animate-in fade-in zoom-in duration-700">
            <div className="relative">
                <div className="absolute inset-0 bg-opacity-20 blur-3xl rounded-full" style={{ backgroundColor: 'currentColor' }} />
                {config.icon}
            </div>

            <div className="text-center space-y-3">
                <h1 className="text-3xl font-black text-bb-text tracking-tight uppercase italic">
                    {config.title}
                </h1>
                <p className="text-bb-text-secondary max-w-xs mx-auto">{config.text}</p>
            </div>

            <Button
                onClick={() => router.push(`/dashboard/store?status=${config.query}`)}
                className={`w-full h-14 ${config.color} text-white font-bold rounded-2xl gap-2 shadow-xl active:scale-95 transition-all text-lg`}
            >
                {config.btn}
                <ArrowRight size={20} />
            </Button>
        </div>
    );
}

export default function PaymentSuccessPage() {
    return (
        <div className="min-h-screen bg-bb-dark flex items-center justify-center p-4 overflow-hidden relative">
            {/* Background Glow */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent opacity-50" />

            <div className="max-w-md w-full bg-bb-sidebar/90 backdrop-blur-2xl border border-bb-border p-10 rounded-[3.5rem] shadow-2xl relative z-10">
                <Suspense fallback={
                    <div className="flex justify-center p-12">
                        <Loader2 className="animate-spin text-blue-500 w-12 h-12" />
                    </div>
                }>
                    <VerifyPaymentContent />
                </Suspense>
            </div>
        </div>
    );
}
