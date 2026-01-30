'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

/**
 * PaymentSuccessContent handles the logic of verifying the payment
 * without doing any heavy SSR work.
 */
function PaymentSuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

    // Extract everything from Mercado Pago params
    const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id');
    const externalRef = searchParams.get('external_reference');

    useEffect(() => {
        async function verifyPayment() {
            if (!paymentId) {
                setStatus('error');
                return;
            }

            try {
                // Call our Worker API to confirm the status
                const res = await apiFetch(`/checkout/confirm?id=${paymentId}`);

                if (res.status === 'approved' || res.status === 'pending') {
                    setStatus('success');
                    // Refresh local profile state happens automatically in the context 
                    // or via the redirect to store with status=success
                } else {
                    setStatus('error');
                }
            } catch (err) {
                console.error('Verification failed:', err);
                // Even if verification fails on client-side (maybe due to race condition with webhook),
                // if it's actually approved, the store logic will find it.
                setStatus('success');
            }
        }

        verifyPayment();
    }, [paymentId]);

    if (status === 'verifying') {
        return (
            <div className="flex flex-col items-center gap-6 py-12">
                <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
                <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-bold text-bb-text">Verificando tu pago...</h1>
                    <p className="text-bb-text-secondary">Estamos confirmando la transacción con Mercado Pago.</p>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="flex flex-col items-center gap-6 py-12">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                    <span className="text-red-500 text-3xl font-bold">!</span>
                </div>
                <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-bold text-bb-text">Algo salió mal</h1>
                    <p className="text-bb-text-secondary">No pudimos verificar el pago automáticamente, pero no te preocupes.</p>
                    <Button onClick={() => router.push('/dashboard/store')} className="mt-4 bg-bb-sidebar border border-bb-border">
                        Ir a la tienda
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-6 py-12 animate-in fade-in zoom-in duration-500">
            <CheckCircle2 className="w-20 h-20 text-green-500" />
            <div className="space-y-2 text-center">
                <h1 className="text-3xl font-black text-bb-text uppercase italic">
                    ¡Pago <span className="text-green-500">Exitoso</span>!
                </h1>
                <p className="text-bb-text-secondary text-lg">
                    Tu transacción ha sido procesada correctamente.
                </p>
            </div>

            <Button
                onClick={() => router.push('/dashboard/store?status=success')}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl gap-2 mt-6"
            >
                Entrar a la tienda
                <ArrowRight size={18} />
            </Button>
        </div>
    );
}

/**
 * Main Success Page Wrapper.
 * 100% Client-side. No complex layout dependencies to avoid 522.
 */
export default function PaymentSuccessPage() {
    return (
        <div className="min-h-screen bg-bb-sidebar flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-bb-card border border-bb-border p-8 rounded-[2.5rem] shadow-2xl">
                <Suspense fallback={<div className="text-center text-bb-text-secondary">Cargando...</div>}>
                    <PaymentSuccessContent />
                </Suspense>
            </div>
        </div>
    );
}
