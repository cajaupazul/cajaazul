'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, ArrowRight, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SuccessPage() {
    const router = useRouter();

    useEffect(() => {
        // Auto redirect after 5 seconds
        const timer = setTimeout(() => {
            router.push('/dashboard/store?status=success');
        }, 5000);

        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className="min-h-screen bg-bb-sidebar flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-bb-card border border-bb-border p-8 rounded-[2.5rem] shadow-2xl text-center space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="flex justify-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-green-500 blur-3xl opacity-20 animate-pulse" />
                        <CheckCircle2 className="w-20 h-20 text-green-500 relative z-10" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-3xl font-black text-bb-text tracking-tight uppercase italic">
                        ¡Pago <span className="text-green-500">Exitoso</span>!
                    </h1>
                    <p className="text-bb-text-secondary text-lg">
                        Tu transacción ha sido procesada correctamente por Mercado Pago.
                    </p>
                </div>

                <div className="bg-bb-sidebar/50 p-6 rounded-3xl border border-bb-border space-y-4">
                    <div className="flex items-center gap-3 text-left">
                        <Wallet className="text-blue-500" size={24} />
                        <div>
                            <p className="font-bold text-bb-text">Créditos Actualizados</p>
                            <p className="text-xs text-bb-text-secondary">Tus monedas o suscripción se verán reflejadas en segundos.</p>
                        </div>
                    </div>
                </div>

                <div className="pt-4 space-y-3">
                    <p className="text-xs text-bb-text-secondary animate-pulse">
                        Redirigiendo automáticamente en 5 segundos...
                    </p>
                    <Link href="/dashboard/store?status=success" className="block">
                        <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl gap-2 shadow-lg transition-all active:scale-95">
                            Volver a la tienda
                            <ArrowRight size={18} />
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="mt-8 opacity-30">
                <p className="text-[10px] text-bb-text-secondary font-bold uppercase tracking-[0.2em]">
                    CampusLink Secure Checkout
                </p>
            </div>
        </div>
    );
}
