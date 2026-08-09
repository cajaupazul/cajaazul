'use client';

import React, { useEffect, useState } from 'react';
import { ShoppingBag, ShieldCheck, X, CheckCircle2, Loader2, AlertCircle, CreditCard, Smartphone, QrCode } from 'lucide-react';
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
    const [activeTab, setActiveTab] = useState<'brick' | 'yape'>('brick');
    const [preferenceId, setPreferenceId] = useState<string | null>(null);
    const [loadingPreference, setLoadingPreference] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    // Yape Form State
    const [yapePhone, setYapePhone] = useState('');
    const [yapeOtp, setYapeOtp] = useState('');
    const [yapeLoading, setYapeLoading] = useState(false);
    const [yapeError, setYapeError] = useState<string | null>(null);

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
            setYapePhone('');
            setYapeOtp('');
            setYapeError(null);
            setActiveTab('brick');
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

    // Handle Yape Payment submission
    const handleYapePay = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!product) return;

        const cleanPhone = yapePhone.trim().replace(/\D/g, '');
        const cleanOtp = yapeOtp.trim().replace(/\D/g, '');

        if (!cleanPhone || cleanPhone.length !== 9) {
            setYapeError('Ingresa un número de celular válido de 9 dígitos (Perú).');
            return;
        }

        if (!cleanOtp || cleanOtp.length !== 6) {
            setYapeError('Ingresa el código de aprobación OTP de 6 dígitos de tu app de Yape.');
            return;
        }

        setYapeLoading(true);
        setYapeError(null);

        try {
            const mpPublicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || 'APP_USR-c89b2d7b-b44e-4926-ba40-3d456209235d';
            console.log('[Yape] Generando token en frontend con Public Key:', mpPublicKey);

            if (typeof window === 'undefined' || !(window as any).MercadoPago) {
                throw new Error('SDK de Mercado Pago no cargado en el navegador.');
            }

            const mp = new (window as any).MercadoPago(mpPublicKey, { locale: 'es-PE' });
            
            if (typeof mp.yape !== 'function') {
                throw new Error('Método Yape no soportado por el SDK actual de Mercado Pago.');
            }

            const yapeTokenRes = await mp.yape({
                otp: cleanOtp,
                phoneNumber: cleanPhone,
            });

            console.log('[Yape] Token de Yape generado:', yapeTokenRes);

            if (!yapeTokenRes?.id) {
                throw new Error('No se pudo generar el token de Yape. Verifica el código OTP o tu teléfono.');
            }

            console.log('[Yape] Invocando create-yape-payment con token.id:', yapeTokenRes.id);

            const { data: yapeData, error: yapeErr } = await supabase.functions.invoke(
                'create-yape-payment',
                {
                    body: {
                        token: yapeTokenRes.id,
                        amount: product.price,
                        product_id: product.id,
                        user_id: profile?.id,
                        description: product.name,
                        userEmail: profile?.email || 'cliente@campuslink.pe',
                    },
                }
            );

            console.log('[Yape] Respuesta create-yape-payment:', { data: yapeData, error: yapeErr });

            if (yapeErr || !yapeData?.success) {
                throw new Error(yapeData?.message || yapeErr?.message || 'Error al procesar el pago con Yape.');
            }

            setIsSuccess(true);
            refreshProfile();
            onPaymentSuccess(yapeData);

        } catch (err: any) {
            console.error('[Yape] Error:', err);
            setYapeError(err.message || 'Ocurrió un error al procesar tu pago con Yape.');
        } finally {
            setYapeLoading(false);
        }
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

                {/* Tabs Selector */}
                {!isSuccess && (
                    <div className="flex border-b border-white/10 bg-[#141416] p-1.5 gap-2 shrink-0">
                        <button
                            onClick={() => setActiveTab('brick')}
                            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'brick'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <CreditCard size={16} />
                            <span>Tarjeta / Mercado Pago</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('yape')}
                            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'yape'
                                    ? 'bg-[#6C3DD3] text-white shadow-lg shadow-purple-950/60'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <img src="/yape-logo.png.png" alt="Yape" className="w-5 h-5 object-contain" />
                            <span>Yape</span>
                        </button>
                    </div>
                )}

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
                    ) : activeTab === 'yape' ? (
                        /* Tab 2: Yape Form */
                        <form onSubmit={handleYapePay} className="space-y-5 py-2">

                            {/* Yape Brand Header */}
                            <div className="rounded-2xl overflow-hidden border border-purple-500/20 bg-gradient-to-br from-[#6C3DD3]/20 via-[#4a1fa8]/10 to-black/30">
                                {/* Top brand row */}
                                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center p-1.5 shadow-lg">
                                            <img src="/yape-logo.png.png" alt="Yape" className="w-full h-full object-contain" />
                                        </div>
                                        <div>
                                            <p className="text-base font-extrabold text-white tracking-tight">Pago con Yape</p>
                                            <p className="text-[11px] text-purple-300/80">Transferencia instantánea · Perú</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-2.5 py-1">
                                        <ShieldCheck size={11} className="text-emerald-400" />
                                        <span className="text-[10px] font-bold text-emerald-400">Seguro</span>
                                    </div>
                                </div>

                                {/* Steps */}
                                <div className="px-5 pb-4 space-y-2">
                                    <p className="text-[10px] font-bold text-purple-300/70 uppercase tracking-widest mb-2">Cómo obtener tu código</p>
                                    {[
                                        { step: '1', text: 'Abre tu app de Yape en tu teléfono' },
                                        { step: '2', text: 'Ve a Servicios → Código de Aprobación' },
                                        { step: '3', text: 'Copia el código OTP de 6 dígitos' },
                                    ].map(({ step, text }) => (
                                        <div key={step} className="flex items-center gap-3">
                                            <span className="w-5 h-5 rounded-full bg-[#6C3DD3]/60 border border-purple-500/40 flex items-center justify-center text-[10px] font-black text-purple-200 shrink-0">{step}</span>
                                            <span className="text-xs text-purple-100/80">{text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Monto a pagar */}
                            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/8">
                                <span className="text-xs text-gray-400 font-medium">Monto a pagar</span>
                                <span className="text-lg font-extrabold text-white font-mono">S/ {product.price.toFixed(2)}</span>
                            </div>

                            {/* Phone Input */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                    <Smartphone size={14} className="text-purple-400" />
                                    Número de Celular vinculado a Yape
                                </label>
                                <div className="flex items-center rounded-xl bg-black/40 border border-white/10 overflow-hidden focus-within:border-purple-500 transition-colors">
                                    <span className="px-3.5 text-xs font-bold text-gray-400 bg-white/5 py-3 border-r border-white/10">
                                        🇵🇪 +51
                                    </span>
                                    <input
                                        type="tel"
                                        maxLength={9}
                                        placeholder="987654321"
                                        value={yapePhone}
                                        onChange={(e) => setYapePhone(e.target.value.replace(/\D/g, ''))}
                                        className="w-full bg-transparent px-3 py-2.5 text-sm font-mono text-white placeholder-gray-500 focus:outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            {/* OTP Input */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
                                    <span>Código de Aprobación (OTP de 6 dígitos)</span>
                                    <span className="text-[10px] text-purple-400 font-semibold">Generado en app Yape</span>
                                </label>
                                <input
                                    type="text"
                                    maxLength={6}
                                    placeholder="123456"
                                    value={yapeOtp}
                                    onChange={(e) => setYapeOtp(e.target.value.replace(/\D/g, ''))}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-center text-lg font-mono tracking-[0.4em] text-purple-300 placeholder-gray-600 focus:border-purple-500 focus:outline-none transition-colors"
                                    required
                                />
                            </div>

                            {/* Error Alert */}
                            {yapeError && (
                                <div className="p-3.5 rounded-xl bg-red-500/20 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                                    <AlertCircle size={16} className="shrink-0 text-red-400" />
                                    <span>{yapeError}</span>
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={yapeLoading || yapePhone.length !== 9 || yapeOtp.length !== 6}
                                className="w-full py-3.5 px-4 bg-[#6C3DD3] hover:bg-[#5c33b8] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-purple-950/60 flex items-center justify-center gap-2 active:scale-95"
                            >
                                {yapeLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Procesando Yape...</span>
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck size={18} />
                                        <span>Pagar con Yape | S/ {product.price.toFixed(2)}</span>
                                    </>
                                )}
                            </button>
                        </form>
                    ) : loadingPreference ? (
                        /* Tab 1: Brick Loading */
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                            <p className="text-sm font-semibold text-gray-300">Cargando pasarela de pago segura...</p>
                        </div>
                    ) : errorMsg ? (
                        /* Tab 1: Error */
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
                        /* Tab 1: Mercado Pago Brick */
                        <div className="w-full">
                            <Payment
                                initialization={{
                                    amount: product.price,
                                    preferenceId: preferenceId,
                                }}
                                customization={{
                                    paymentMethods: {
                                        mercadoPago: 'all',
                                        creditCard: 'all',
                                        debitCard: 'all',
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
