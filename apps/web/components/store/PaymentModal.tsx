'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    X, CheckCircle2, AlertCircle, ShieldCheck, CreditCard,
    Loader2, Smartphone,
} from 'lucide-react';
import { useProfile } from '@/lib/profile-context';
import { supabase } from '@/lib/supabase';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';

// ─── Credenciales según entorno ───────────────────────────────────────────────
const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || 'APP_USR-c89b2d7b-b44e-4926-ba40-3d456209235d';




// Inicializar Payment Brick SDK una sola vez
try {
    initMercadoPago(MP_PUBLIC_KEY, { locale: 'es-PE' });
} catch (_) {}

// ─── Tipos ────────────────────────────────────────────────────────────────────
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

type Tab = 'brick' | 'yape';

// ─── Helper: cargar SDK v2 de MP desde CDN ────────────────────────────────────
async function loadMercadoPagoSDK(): Promise<void> {
    if (typeof window === 'undefined') return;
    if ((window as any).MercadoPago) return; // ya cargado

    return new Promise<void>((resolve, reject) => {
        const existing = document.getElementById('mp-sdk-v2');
        if (existing) {
            if ((window as any).MercadoPago) return resolve();
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error('No se pudo cargar el SDK de Mercado Pago')));
            return;
        }
        const script = document.createElement('script');
        script.id = 'mp-sdk-v2';
        script.src = 'https://sdk.mercadopago.com/js/v2';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('No se pudo cargar el SDK de Mercado Pago'));
        document.head.appendChild(script);
    });
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function PaymentModal({
    isOpen,
    onClose,
    product,
    onPaymentSuccess,
    onPaymentError,
}: PaymentModalProps) {
    const { profile, refreshProfile } = useProfile();

    const [activeTab, setActiveTab] = useState<Tab>('brick');
    const [isSuccess, setIsSuccess] = useState(false);
    const [brickKey, setBrickKey] = useState(0);

    // Yape form state
    const [yapePhone, setYapePhone] = useState('');
    const [yapeOtp, setYapeOtp] = useState('');
    const [yapeLoading, setYapeLoading] = useState(false);
    const [yapeError, setYapeError] = useState<string | null>(null);

    // Brick error
    const [brickError, setBrickError] = useState<string | null>(null);

    // Reset al abrir/cerrar
    useEffect(() => {
        if (!isOpen) {
            setIsSuccess(false);
            setBrickError(null);
            setYapePhone('');
            setYapeOtp('');
            setYapeError(null);
            setActiveTab('brick');
        } else {
            setBrickKey((k) => k + 1);
        }
    }, [isOpen]);

    // Realtime listener: detecta cuando el pago se aprueba y el perfil se actualiza
    useEffect(() => {
        if (!isOpen || !profile?.id) return;
        const channel = supabase
            .channel(`profile-payment-${profile.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${profile.id}`,
            }, (payload) => {
                console.log('[PaymentModal] Perfil actualizado:', payload.new);
                setIsSuccess(true);
                refreshProfile();
                onPaymentSuccess(payload.new);
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [isOpen, profile?.id, refreshProfile, onPaymentSuccess]);

    // ── Brick onSubmit ─────────────────────────────────────────────────────────
    const handleBrickSubmit = useCallback(
        async ({ selectedPaymentMethod, formData }: { selectedPaymentMethod: any; formData: any }) => {
            console.log('[Brick] submit:', selectedPaymentMethod, formData);
            setBrickError(null);
            try {
                const { data, error } = await supabase.functions.invoke('process-payment', {
                    body: {
                        formData,
                        product_id: product?.id,
                        user_id: profile?.id,
                        userEmail: profile?.email || 'cliente@campuslink.pe',
                    },
                });
                console.log('[Brick] process-payment response:', data, error);
                if (error || !data?.success) {
                    const msg = data?.message || error?.message || 'El pago no pudo procesarse.';
                    setBrickError(msg);
                    throw new Error(msg);
                }
                setIsSuccess(true);
                refreshProfile();
                onPaymentSuccess(data);
            } catch (err: any) {
                setBrickError(err.message);
                throw err;
            }
        },
        [product?.id, profile?.id, profile?.email, refreshProfile, onPaymentSuccess]
    );

    // ── Yape onSubmit ──────────────────────────────────────────────────────────
    const handleYapePay = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!product) return;

        const cleanPhone = yapePhone.trim().replace(/\D/g, '');
        const cleanOtp = yapeOtp.trim().replace(/\D/g, '');

        if (!cleanPhone || cleanPhone.length !== 9) {
            setYapeError('Ingresa un número de celular válido de 9 dígitos.');
            return;
        }
        if (!cleanOtp || cleanOtp.length !== 6) {
            setYapeError('Ingresa el código OTP de 6 dígitos de tu app de Yape.');
            return;
        }

        setYapeLoading(true);
        setYapeError(null);

        try {
            // 1. Cargar SDK oficial de MP si no está cargado
            await loadMercadoPagoSDK();

            if (!(window as any).MercadoPago) {
                throw new Error('No se pudo cargar el SDK de Mercado Pago. Recarga la página.');
            }

            // 2. Generar token de Yape con el método correcto de la documentación oficial
            console.log('[Yape] Public Key usada:', MP_PUBLIC_KEY?.substring(0, 20));
            const mp = new (window as any).MercadoPago(MP_PUBLIC_KEY, { locale: 'es-PE' });
            console.log('[Yape] Generando token con mp.yape().create()...');


            const yapeInstance = mp.yape({ otp: cleanOtp, phoneNumber: cleanPhone });
            const yapeToken = await yapeInstance.create();

            console.log('[Yape] Token generado:', yapeToken);

            if (!yapeToken?.id) {
                throw new Error(
                    yapeToken?.message ||
                    yapeToken?.cause?.[0]?.description ||
                    'No se pudo generar el token de Yape. Verifica tu código OTP.'
                );
            }

            // 3. Enviar token al backend
            const { data, error } = await supabase.functions.invoke('create-yape-payment', {
                body: {
                    token: yapeToken.id,
                    product_id: product.id,
                    user_id: profile?.id,
                    userEmail: profile?.email || 'cliente@campuslink.pe',
                    description: product.name,
                },
            });

            console.log('[Yape] create-yape-payment response:', data, error);

            if (error || !data?.success) {
                throw new Error(data?.message || error?.message || 'Error al procesar el pago con Yape.');
            }

            setIsSuccess(true);
            refreshProfile();
            onPaymentSuccess(data);

        } catch (err: any) {
            console.error('[Yape] Error:', err);
            setYapeError(err.message || 'Error al procesar el pago con Yape.');
        } finally {
            setYapeLoading(false);
        }
    };

    if (!isOpen || !product) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-[#141416] rounded-3xl shadow-2xl border border-white/10 flex flex-col max-h-[92vh] overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10 bg-[#1A1D24] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                                {isSuccess ? '¡Pago Exitoso!' : 'Completar Pago'}
                            </h3>
                            {!isSuccess && (
                                <p className="text-xs text-gray-400">
                                    {product.name} —{' '}
                                    <span className="text-emerald-400 font-mono font-bold">S/ {product.price.toFixed(2)}</span>
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

                {/* Tabs */}
                {!isSuccess && (
                    <div className="flex p-2 gap-2 bg-[#141416] border-b border-white/10 shrink-0">
                        <button
                            onClick={() => setActiveTab('brick')}
                            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                activeTab === 'brick'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <CreditCard size={15} />
                            Tarjeta / MP
                        </button>
                        <button
                            onClick={() => setActiveTab('yape')}
                            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                activeTab === 'yape'
                                    ? 'bg-[#6C3DD3] text-white shadow-lg shadow-purple-950/60'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <img src="/yape-logo.png.png" alt="Yape" className="w-5 h-5 object-contain" />
                            Yape
                        </button>
                    </div>
                )}

                {/* Body */}
                <div className="overflow-y-auto flex-1">
                    {isSuccess ? (
                        /* Éxito */
                        <div className="p-8 flex flex-col items-center text-center space-y-5">
                            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center animate-bounce">
                                <CheckCircle2 size={36} />
                            </div>
                            <h2 className="text-2xl font-bold text-white">¡Compra Realizada!</h2>
                            <p className="text-sm text-gray-300 leading-relaxed">
                                Has adquirido <strong>{product.name}</strong> correctamente.
                                <br />
                                Tus beneficios han sido actualizados en tu cuenta.
                            </p>
                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all transform active:scale-95 shadow-lg shadow-emerald-900/40"
                            >
                                Volver a la tienda
                            </button>
                        </div>

                    ) : activeTab === 'brick' ? (
                        /* Tab 1: Payment Brick (Tarjeta, MP Wallet, PagoEfectivo) */
                        <div className="p-4">
                            {brickError && (
                                <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                                    <AlertCircle size={16} className="shrink-0 text-red-400" />
                                    <span>{brickError}</span>
                                </div>
                            )}
                            <Payment
                                key={brickKey}
                                initialization={{
                                    amount: product.price,
                                    payer: { email: profile?.email || '' },
                                }}
                                customization={{
                                    visual: {
                                        style: { theme: 'dark' },
                                    },
                                    paymentMethods: {
                                        creditCard: 'all',
                                        debitCard: 'all',
                                        mercadoPago: 'all',
                                        ticket: 'all',
                                        atm: 'all',
                                    },
                                }}
                                onSubmit={handleBrickSubmit}
                                onReady={() => console.log('[Payment Brick] Listo')}
                                onError={(error) => {
                                    console.error('[Payment Brick] Error:', error);
                                    onPaymentError(error);
                                }}
                            />
                        </div>

                    ) : (
                        /* Tab 2: Yape */
                        <form onSubmit={handleYapePay} className="p-5 space-y-5">

                            {/* Brand header */}
                            <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-[#6C3DD3]/20 via-[#4a1fa8]/10 to-black/30 p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center p-1.5">
                                        <img src="/yape-logo.png.png" alt="Yape" className="w-full h-full object-contain" />
                                    </div>
                                    <div>
                                        <p className="text-base font-extrabold text-white">Pago con Yape</p>
                                        <p className="text-[11px] text-purple-300/80">Transferencia instantánea · Perú</p>
                                    </div>
                                </div>

                                {/* Pasos */}
                                <div className="space-y-2 pt-1 border-t border-purple-500/20">
                                    <p className="text-[10px] font-bold text-purple-300/60 uppercase tracking-widest">Cómo obtener tu código</p>
                                    {[
                                        'Abre tu app de Yape en tu teléfono',
                                        'Ve a Servicios → Código de Aprobación',
                                        'Copia el código OTP de 6 dígitos',
                                    ].map((text, i) => (
                                        <div key={i} className="flex items-center gap-2.5">
                                            <span className="w-5 h-5 rounded-full bg-[#6C3DD3]/60 border border-purple-500/40 flex items-center justify-center text-[10px] font-black text-purple-200 shrink-0">
                                                {i + 1}
                                            </span>
                                            <span className="text-xs text-purple-100/80">{text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Monto */}
                            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                                <span className="text-xs text-gray-400 font-medium">Monto a pagar</span>
                                <span className="text-lg font-extrabold text-white font-mono">S/ {product.price.toFixed(2)}</span>
                            </div>

                            {/* Celular */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                    <Smartphone size={14} className="text-purple-400" />
                                    Número de Celular vinculado a Yape
                                </label>
                                <div className="flex items-center rounded-xl bg-black/40 border border-white/10 overflow-hidden focus-within:border-purple-500 transition-colors">
                                    <span className="px-3.5 py-3 text-xs font-bold text-gray-400 bg-white/5 border-r border-white/10 select-none">🇵🇪 +51</span>
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

                            {/* OTP */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
                                    <span>Código OTP de 6 dígitos</span>
                                    <span className="text-[10px] text-purple-400 font-semibold">Generado en app Yape</span>
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="123456"
                                    value={yapeOtp}
                                    onChange={(e) => setYapeOtp(e.target.value.replace(/\D/g, ''))}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-center text-xl font-mono tracking-[0.5em] text-purple-300 placeholder-gray-600 focus:border-purple-500 focus:outline-none transition-colors"
                                    required
                                />
                            </div>

                            {/* Error */}
                            {yapeError && (
                                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
                                    <AlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
                                    <span>{yapeError}</span>
                                </div>
                            )}

                            {/* Botón */}
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
                    )}
                </div>
            </div>
        </div>
    );
}
