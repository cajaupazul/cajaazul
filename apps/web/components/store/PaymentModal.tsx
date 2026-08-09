'use client';

import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, Loader2, AlertCircle, ExternalLink, ShieldCheck, CreditCard, Smartphone, Wallet, Landmark } from 'lucide-react';
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
                        throw new Error('No se pudo generar el enlace de pago de Mercado Pago.');
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

    const handleOpenCheckout = () => {
        if (!initPoint) return;
        window.open(initPoint, '_blank', 'noopener,noreferrer');
    };

    if (!isOpen || !product) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg bg-[#141416] rounded-3xl shadow-2xl border border-white/10 flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10 bg-[#1A1D24] shrink-0">
                    <div>
                        <h3 className="text-lg sm:text-xl font-bold text-white">
                            {isSuccess ? '¡Pago Exitoso!' : 'Completar Pago'}
                        </h3>
                        {!isSuccess && (
                            <p className="text-xs sm:text-sm text-gray-400">
                                {product.name} — <span className="text-emerald-400 font-mono font-bold">S/ {product.price.toFixed(2)}</span>
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 text-gray-200">
                    {isSuccess ? (
                        <div className="p-6 flex flex-col items-center text-center space-y-5">
                            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center animate-bounce">
                                <CheckCircle2 size={36} />
                            </div>
                            <h2 className="text-2xl font-bold text-white">¡Compra Realizada!</h2>
                            <p className="text-sm text-gray-300 leading-relaxed">
                                Has adquirido <strong>{product.name}</strong> correctamente. <br />
                                Tus beneficios han sido actualizados en tu cuenta.
                            </p>
                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all transform active:scale-95 shadow-lg shadow-emerald-900/40"
                            >
                                Volver a la tienda
                            </button>
                        </div>
                    ) : loadingPreference ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                            <p className="text-sm font-semibold text-gray-300">Generando preferencia de pago segura...</p>
                        </div>
                    ) : errorMsg ? (
                        <div className="p-6 text-center space-y-4">
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
                        <div className="space-y-6 py-2">
                            {/* Card Resumen de compra */}
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                                <div className="flex justify-between items-center pb-3 border-b border-white/10">
                                    <span className="text-xs text-gray-400 font-medium">Producto</span>
                                    <span className="text-sm font-bold text-white">{product.name}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-400 font-medium">Monto a Pagar</span>
                                    <span className="text-xl font-extrabold text-emerald-400 font-mono">S/ {product.price.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Métodos de Pago Aceptados en Mercado Pago Perú */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs font-bold text-gray-300 uppercase tracking-wider">
                                    <span>Métodos de Pago Disponibles</span>
                                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-normal">
                                        <ShieldCheck size={13} /> Checkout Oficial MP
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5 text-xs text-gray-300">
                                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-200">
                                        <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                                            <img src="/yape-logo.png.png" alt="Yape" className="w-4 h-4 object-contain" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">Yape</p>
                                            <p className="text-[10px] text-purple-300/80">Código QR / Directo</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-200">
                                        <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0 text-blue-400">
                                            <CreditCard size={14} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">Tarjetas</p>
                                            <p className="text-[10px] text-blue-300/80">Crédito y Débito</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200">
                                        <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0 text-cyan-400">
                                            <Wallet size={14} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">MP Wallet</p>
                                            <p className="text-[10px] text-cyan-300/80">Saldo Mercado Pago</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200">
                                        <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-400">
                                            <Landmark size={14} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">PagoEfectivo</p>
                                            <p className="text-[10px] text-emerald-300/80">BCP, BBVA, Interbank</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Botón Principal para ir al Checkout de Mercado Pago */}
                            <button
                                onClick={handleOpenCheckout}
                                className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-extrabold text-base rounded-2xl transition-all shadow-xl shadow-blue-900/40 flex items-center justify-center gap-3 transform active:scale-98"
                            >
                                <span>Pagar con Mercado Pago</span>
                                <ExternalLink size={18} />
                            </button>

                            <p className="text-[11px] text-center text-gray-400 leading-normal">
                                Al hacer clic, se abrirá la pasarela oficial de <strong>Mercado Pago Perú</strong> en una nueva pestaña donde podrás elegir <strong>Yape</strong>, Tarjeta o PagoEfectivo. Tu compra se activará automáticamente al pagar.
                            </p>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
