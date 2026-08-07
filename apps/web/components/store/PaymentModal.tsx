'use client';

import React, { useEffect, useState } from 'react';
import { ShoppingBag, ShieldCheck, X, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useProfile } from '@/lib/profile-context';
import { supabase } from '@/lib/supabase';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';

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
    const [preferenceId, setPreferenceId] = useState<string | null>(null);
    const [loadingPreference, setLoadingPreference] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    // Initialize MP SDK once
    useEffect(() => {
        const mpPublicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || 'APP_USR-c89b2d7b-b44e-4926-ba40-3d456209235d';
        console.log('MP Public Key:', process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || mpPublicKey);
        try {
            initMercadoPago(mpPublicKey, { locale: 'es-PE' });
        } catch (err) {
            console.error('[PaymentModal] Error initializing Mercado Pago:', err);
        }
    }, []);

    // Fetch preferenceId when modal opens with a valid product
    useEffect(() => {
        if (!isOpen || !product) {
            setPreferenceId(null);
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
                setPreferenceId(null);

                console.log('Invocando create-payment con:', {
                    product_id: product.id,
                    user_id: profile?.id
                });

                let prefId: string | null = null;

                // 1. Intentar llamar a Supabase Edge Function 'create-payment'
                try {
                    const { data: edgeData, error: edgeError } = await supabase.functions.invoke(
                        'create-payment',
                        { body: { product_id: product.id, user_id: profile?.id } }
                    );

                    console.log('data completo:', JSON.stringify(edgeData));
                    console.log('preference_id (Edge Function):', edgeData?.preference_id || edgeData?.id);
                    console.log('Respuesta Edge Function create-payment:', { data: edgeData, error: edgeError });

                    if (!edgeError && (edgeData?.preference_id || edgeData?.id)) {
                        prefId = edgeData.preference_id || edgeData.id;
                    }
                } catch (e) {
                    console.warn('[PaymentModal] Edge Function invocation failed, tratando vía Worker API...', e);
                }

                // 2. Fallback vía Worker API si la Edge Function no retornó preference_id
                if (!prefId) {
                    console.log('Invocando Worker API (/checkout)...');
                    const workerData = await apiFetch('/checkout', {
                        method: 'POST',
                        body: JSON.stringify({
                            product_id: product.id,
                            origin: window.location.origin,
                        })
                    });
                    console.log('data completo (Worker API):', JSON.stringify(workerData));
                    console.log('preference_id (Worker API):', workerData?.preference_id || workerData?.id);
                    prefId = workerData?.preference_id || workerData?.id;
                }

                // Sanitizar para asegurar que sea el ID de preferencia y NO la URL init_point
                if (prefId && prefId.startsWith('http')) {
                    console.warn('Se detectó URL init_point en lugar de ID de preferencia. Extrayendo ID...');
                    const urlParts = prefId.split('pref_id=');
                    if (urlParts.length > 1) {
                        prefId = urlParts[1].split('&')[0];
                    }
                }

                console.log('preference_id final asignado al Payment Brick:', prefId);

                if (isMounted) {
                    if (prefId) {
                        setPreferenceId(prefId);
                    } else {
                        throw new Error('No se recibió preference_id');
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
                            <p className="text-sm font-semibold text-gray-300">Cargando pasarela de pago segura...</p>
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
                    ) : preferenceId ? (
                        <div className="w-full">
                            <Payment
                                initialization={{
                                    amount: product.price,
                                    preferenceId: preferenceId,
                                }}
                                customization={{
                                    paymentMethods: {
                                        ticket: 'all',
                                        bankTransfer: 'all',
                                        creditCard: 'all',
                                        debitCard: 'all',
                                        mercadoPago: 'all',
                                    },
                                    visual: {
                                        style: {
                                            theme: 'dark',
                                        },
                                    },
                                }}
                                onSubmit={async ({ selectedPaymentMethod, formData }) => {
                                    console.log('[Payment Brick] Submit event triggered:', selectedPaymentMethod);
                                }}
                                onReady={() => console.log('[Payment Brick] Brick listo')}
                                onError={(error) => {
                                    console.error('[Payment Brick] Error:', error);
                                    onPaymentError(error);
                                }}
                            />
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
