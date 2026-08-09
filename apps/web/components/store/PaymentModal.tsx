'use client';

import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, Loader2, AlertCircle, ExternalLink, ShieldCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useProfile } from '@/lib/profile-context';
import { supabase } from '@/lib/supabase';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: {
        id: string;
        name: string;
        price: number;
        type: 'vip' | 'coins' | 'item';
        amount?: number;
    } | null;
    onPaymentSuccess: (result: any) => void;
    onPaymentError: (error: any) => void;
}

export default function PaymentModal({
    isOpen,
    onClose,
    product,
    onPaymentSuccess,
    onPaymentError
}: PaymentModalProps) {
    const { profile, refreshProfile } = useProfile();
    const [initPoint, setInitPoint] = useState<string | null>(null);
    const [loadingPreference, setLoadingPreference] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    // Fetch preference init_point when modal opens with a valid product
    useEffect(() => {
        if (!isOpen || !product) {
            setInitPoint(null);
            setErrorMsg(null);
            setIsSuccess(false);
            return;
        }

        let isMounted = true;
        async function fetchPreference() {
            if (!product) return;
            try {
                setLoadingPreference(true);
                setErrorMsg(null);
                setInitPoint(null);

                console.log('[PaymentModal] Invocando create-payment con:', {
                    product_id: product.id,
                    user_id: profile?.id
                });

                let link: string | null = null;

                // 1. Intentar llamar a Supabase Edge Function 'create-payment'
                try {
                    const { data: edgeData, error: edgeError } = await supabase.functions.invoke(
                        'create-payment',
                        { body: { product_id: product.id, user_id: profile?.id } }
                    );

                    console.log('[PaymentModal] Edge Function response:', edgeData);

                    if (!edgeError && edgeData?.init_point) {
                        link = edgeData.init_point;
                    }
                } catch (e) {
                    console.warn('[PaymentModal] Edge Function failed, fallback a Worker API...', e);
                }

                // 2. Fallback vía Worker API si la Edge Function no retornó init_point
                if (!link) {
                    console.log('[PaymentModal] Invocando Worker API (/checkout)...');
                    const workerData = await apiFetch('/checkout', {
                        method: 'POST',
                        body: JSON.stringify({
                            product_id: product.id,
                            origin: window.location.origin,
                        })
                    });
                    console.log('[PaymentModal] Worker API response:', workerData);
                    link = workerData?.init_point || workerData?.initPoint || workerData?.url;
                }

                if (isMounted) {
                    if (link) {
                        setInitPoint(link);
                    } else {
                        throw new Error('No se pudo generar la pasarela de pago de Mercado Pago.');
                    }
                }
            } catch (err: any) {
                console.error('[PaymentModal] Error creating preference:', err);
                if (isMounted) {
                    setErrorMsg(err.message || 'Error al conectar con Mercado Pago');
                    onPaymentError(err);
                }
            } finally {
                if (isMounted) setLoadingPreference(false);
            }
        }

        fetchPreference();

        return () => {
            isMounted = false;
        };
    }, [isOpen, product]);

    // Realtime Supabase listener to auto-detect payment approval & profile updates
    useEffect(() => {
        if (!isOpen || !profile?.id) return;

        const channel = supabase
            .channel(`profile-payment-listener-${profile.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${profile.id}`,
                },
                (payload) => {
                    console.log('[PaymentModal] Profile updated via Realtime:', payload.new);
                    setIsSuccess(true);
                    refreshProfile();
                    onPaymentSuccess(payload.new);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isOpen, profile?.id, refreshProfile, onPaymentSuccess]);

    if (!isOpen || !product) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-[#141416] rounded-3xl shadow-2xl border border-white/10 flex flex-col h-[92vh] max-h-[750px] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#1A1D24] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                                {isSuccess ? '¡Pago Exitoso!' : 'Completar Pago Seguro'}
                            </h3>
                            {!isSuccess && (
                                <p className="text-xs text-gray-400">
                                    {product.name} — <span className="text-emerald-400 font-mono font-bold">S/ {product.price.toFixed(2)}</span>
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden flex flex-col bg-[#0E0F12] text-gray-200">
                    {isSuccess ? (
                        <div className="p-8 flex flex-col items-center justify-center my-auto text-center space-y-5">
                            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center animate-bounce">
                                <CheckCircle2 size={44} />
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">¡Compra Realizada!</h2>
                            <p className="text-sm sm:text-base text-gray-300 max-w-md leading-relaxed">
                                Has adquirido <strong>{product.name}</strong> correctamente. <br />
                                Tus beneficios ya fueron actualizados en tu cuenta.
                            </p>
                            <button
                                onClick={onClose}
                                className="w-full max-w-xs py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition-all transform active:scale-95 shadow-lg shadow-emerald-900/40"
                            >
                                Volver a la tienda
                            </button>
                        </div>
                    ) : loadingPreference ? (
                        <div className="flex flex-col items-center justify-center my-auto py-12 space-y-4">
                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                            <p className="text-sm font-semibold text-gray-300">Cargando pasarela de pago en vivo...</p>
                        </div>
                    ) : errorMsg ? (
                        <div className="p-6 text-center my-auto space-y-4">
                            <div className="w-12 h-12 mx-auto bg-red-500/20 text-red-400 rounded-full flex items-center justify-center">
                                <AlertCircle size={28} />
                            </div>
                            <p className="text-sm text-red-300">{errorMsg}</p>
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-bold"
                            >
                                Cerrar
                            </button>
                        </div>
                    ) : initPoint ? (
                        /* Embedded iframe: Pasarela de pago completa DENTRO del modal */
                        <div className="w-full h-full flex flex-col">
                            <iframe
                                src={initPoint}
                                className="w-full flex-1 border-0 bg-white"
                                title="Pasarela de Pago Mercado Pago"
                                allow="payment *; camera *; microphome *"
                            />
                            <div className="px-4 py-2 bg-[#141416] border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400 shrink-0">
                                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    Pago en vivo dentro de la plataforma
                                </span>
                                <a
                                    href={initPoint}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
                                >
                                    <span>Abrir en nueva pestaña</span>
                                    <ExternalLink size={12} />
                                </a>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
