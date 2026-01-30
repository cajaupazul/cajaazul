'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertCircle, ArrowRight, LogIn, Loader2 } from 'lucide-react';

/**
 * ULTRA LIGHTWEIGHT CHECKOUT RESULT PAGE
 * 
 * DESIGNED FOR CLOUDFLARE PAGES EDGE RUNTIME:
 * - 100% Client-side ('use client')
 * - No Server Components / No SSR
 * - Static export forced
 * - No external providers or layouts
 * - Query params read from window.location
 */

export const runtime = 'edge';
export const dynamic = 'force-static';

export default function CheckoutResultPage() {
    const [status, setStatus] = useState<string | null>(null);
    const [paymentId, setPaymentId] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Direct read from window to bypass Next.js hook overhead in first byte
        const params = new URLSearchParams(window.location.search);
        setStatus(params.get('status') || 'success');
        setPaymentId(params.get('payment_id'));
    }, []);

    if (!mounted) {
        return (
            <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center font-sans">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                    <p className="text-gray-400 text-sm font-medium animate-pulse">Iniciando...</p>
                </div>
            </div>
        );
    }

    const getStatusConfig = () => {
        switch (status) {
            case 'success':
                return {
                    icon: CheckCircle2,
                    iconColor: 'text-green-500',
                    bgColor: 'bg-green-500/10',
                    borderColor: 'border-green-500/20',
                    title: '¡Pago Exitoso!',
                    message: 'Tu transacción ha sido procesada correctamente.',
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
                    detail: 'Por favor, intenta de nuevo o contacta a soporte.',
                };
            case 'pending':
                return {
                    icon: AlertCircle,
                    iconColor: 'text-yellow-500',
                    bgColor: 'bg-yellow-500/10',
                    borderColor: 'border-yellow-500/20',
                    title: 'Pago Pendiente',
                    message: 'Tu pago está siendo procesado.',
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

    return (
        <div className="min-h-screen bg-[#0A0A0B] flex flex-col items-center justify-center p-4 font-sans selection:bg-blue-500/30">
            <div className={`max-w-md w-full bg-[#141416] border ${config.borderColor} p-10 rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] text-center space-y-8 animate-in fade-in zoom-in duration-700`}>
                {/* Status Icon */}
                <div className="flex justify-center">
                    <div className="relative group">
                        <div className={`absolute inset-0 ${config.bgColor} blur-[40px] opacity-40 group-hover:opacity-60 transition-opacity duration-500 animate-pulse`} />
                        <StatusIcon className={`w-24 h-24 ${config.iconColor} relative z-10 drop-shadow-2xl transition-transform duration-500 group-hover:scale-110`} />
                    </div>
                </div>

                {/* Status Message */}
                <div className="space-y-4">
                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic drop-shadow-sm">
                        {config.title}
                    </h1>
                    <div className="space-y-2 px-2">
                        <p className="text-gray-300 text-lg leading-relaxed font-medium">
                            {config.message}
                        </p>
                        <p className="text-gray-500 text-sm leading-relaxed">
                            {config.detail}
                        </p>
                    </div>
                </div>

                {/* ID Card (if available) */}
                {paymentId && (
                    <div className={`${config.bgColor} py-3 px-5 rounded-2xl border ${config.borderColor} group cursor-default transition-all duration-300 hover:scale-[1.02]`}>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Referencia</p>
                        <p className="text-xs text-white/90 font-mono tracking-wider">
                            TXN-{paymentId}
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="pt-4 space-y-4">
                    <button
                        onClick={() => window.location.href = '/dashboard/store?status=' + status}
                        className="w-full py-4 bg-white text-black hover:bg-gray-200 font-black uppercase italic tracking-wider rounded-2xl flex items-center justify-center gap-3 shadow-[0_8px_20px_-8px_rgba(255,255,255,0.2)] transition-all duration-300 hover:shadow-[0_12px_25px_-8px_rgba(255,255,255,0.3)] active:scale-[0.98]"
                    >
                        Ir al Dashboard
                        <ArrowRight size={20} strokeWidth={3} />
                    </button>

                    <button
                        onClick={() => window.location.href = '/auth/login?redirect=/dashboard/store'}
                        className="w-full py-4 bg-transparent border-2 border-white/5 text-gray-400 hover:text-white hover:border-white/20 font-bold rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 group"
                    >
                        <LogIn size={18} className="group-hover:-translate-x-1 transition-transform" />
                        Acceder a mi Cuenta
                    </button>
                </div>
            </div>

            {/* Premium Footer */}
            <div className="mt-12 text-center space-y-2 opacity-40 hover:opacity-100 transition-opacity duration-500">
                <p className="text-[10px] text-white font-black uppercase tracking-[0.4em] italic">
                    CampusLink <span className="text-blue-500">Secure</span>
                </p>
                <div className="h-[1px] w-8 bg-blue-500/50 mx-auto" />
            </div>
        </div>
    );
}
