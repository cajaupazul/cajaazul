'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    AlertCircle,
    CheckCircle2,
    Clock3,
    CreditCard,
    ExternalLink,
    Loader2,
    LockKeyhole,
    ShieldCheck,
    Smartphone,
    X,
} from 'lucide-react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { useProfile } from '@/lib/profile-context';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';

const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || 'APP_USR-c89b2d7b-b44e-4926-ba40-3d456209235d';

try {
    initMercadoPago(MP_PUBLIC_KEY, { locale: 'es-PE' });
} catch (_) {
    // El SDK conserva una única instancia global cuando el componente se recarga.
}

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

type PaymentMethod = 'brick' | 'yape';
type PaymentState = 'form' | 'approved' | 'pending';

type PaymentResult = {
    success?: boolean;
    status?: string;
    payment_id?: string | number;
    message?: string;
    external_resource_url?: string;
};

async function loadMercadoPagoSdk() {
    if (typeof window === 'undefined' || (window as any).MercadoPago) return;

    await new Promise<void>((resolve, reject) => {
        const existing = document.getElementById('mp-sdk-v2') as HTMLScriptElement | null;
        if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('No se pudo cargar Mercado Pago.')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.id = 'mp-sdk-v2';
        script.src = 'https://sdk.mercadopago.com/js/v2';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('No se pudo cargar Mercado Pago.'));
        document.head.appendChild(script);
    });
}

function friendlyPaymentMessage(result: PaymentResult) {
    const detail = result.message ?? '';
    const knownMessages: Record<string, string> = {
        cc_rejected_bad_filled_card_number: 'Revisa el número de la tarjeta.',
        cc_rejected_bad_filled_date: 'Revisa la fecha de vencimiento.',
        cc_rejected_bad_filled_security_code: 'Revisa el código de seguridad.',
        cc_rejected_insufficient_amount: 'La tarjeta no tiene saldo suficiente.',
        cc_rejected_call_for_authorize: 'El banco necesita que autorices el pago.',
        cc_rejected_card_disabled: 'La tarjeta está deshabilitada. Comunícate con tu banco.',
        cc_rejected_high_risk: 'Mercado Pago no pudo aprobar esta operación. Prueba otro medio de pago.',
        cc_rejected_duplicated_payment: 'Este pago ya fue procesado.',
    };
    return knownMessages[detail] ?? (detail || 'El pago no pudo procesarse. Prueba nuevamente.');
}

export default function PaymentModal({
    isOpen,
    onClose,
    product,
    onPaymentSuccess,
    onPaymentError,
}: PaymentModalProps) {
    const { profile, refreshProfile } = useProfile();
    const { themeMode } = useTheme();
    const attemptIdRef = useRef<string | null>(null);
    const [method, setMethod] = useState<PaymentMethod>('brick');
    const [paymentState, setPaymentState] = useState<PaymentState>('form');
    const [statusMessage, setStatusMessage] = useState('');
    const [externalResourceUrl, setExternalResourceUrl] = useState<string | null>(null);
    const [brickKey, setBrickKey] = useState(0);
    const [brickError, setBrickError] = useState<string | null>(null);
    const [yapePhone, setYapePhone] = useState('');
    const [yapeOtp, setYapeOtp] = useState('');
    const [yapeLoading, setYapeLoading] = useState(false);
    const [yapeError, setYapeError] = useState<string | null>(null);

    const getAttemptId = () => {
        if (!attemptIdRef.current) attemptIdRef.current = crypto.randomUUID();
        return attemptIdRef.current;
    };

    const resetAttempt = () => {
        attemptIdRef.current = null;
    };

    useEffect(() => {
        if (isOpen) {
            setBrickKey((current) => current + 1);
            return;
        }

        resetAttempt();
        setMethod('brick');
        setPaymentState('form');
        setStatusMessage('');
        setExternalResourceUrl(null);
        setBrickError(null);
        setYapePhone('');
        setYapeOtp('');
        setYapeError(null);
    }, [isOpen]);

    const applyPaymentResult = useCallback(async (result: PaymentResult) => {
        if (result.success && result.status === 'approved') {
            resetAttempt();
            setPaymentState('approved');
            await refreshProfile();
            onPaymentSuccess(result);
            return true;
        }

        if (result.status === 'pending') {
            setStatusMessage(result.message ?? 'Mercado Pago está confirmando la operación.');
            setExternalResourceUrl(result.external_resource_url ?? null);
            setPaymentState('pending');
            return true;
        }

        resetAttempt();
        return false;
    }, [onPaymentSuccess, refreshProfile]);

    const handleBrickSubmit = useCallback(async ({ formData }: { selectedPaymentMethod: any; formData: any }) => {
        setBrickError(null);
        try {
            const { data, error } = await supabase.functions.invoke<PaymentResult>('process-payment', {
                body: {
                    formData,
                    product_id: product?.id,
                    request_id: getAttemptId(),
                },
            });

            if (error) throw error;
            if (await applyPaymentResult(data ?? {})) return;

            const message = friendlyPaymentMessage(data ?? {});
            setBrickError(message);
            throw new Error(message);
        } catch (error: any) {
            const message = error?.message || 'No pudimos procesar el pago.';
            setBrickError(message);
            onPaymentError(error);
            throw error;
        }
    }, [applyPaymentResult, onPaymentError, product?.id]);

    const handleYapePay = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!product) return;

        const phoneNumber = yapePhone.replace(/\D/g, '');
        const otp = yapeOtp.replace(/\D/g, '');
        if (phoneNumber.length !== 9) {
            setYapeError('Ingresa un celular válido de 9 dígitos.');
            return;
        }
        if (otp.length !== 6) {
            setYapeError('Ingresa el código de aprobación de 6 dígitos.');
            return;
        }

        setYapeLoading(true);
        setYapeError(null);
        try {
            await loadMercadoPagoSdk();
            const MercadoPago = (window as any).MercadoPago;
            if (!MercadoPago) throw new Error('No se pudo iniciar Mercado Pago.');

            const mp = new MercadoPago(MP_PUBLIC_KEY, { locale: 'es-PE' });
            const token = await mp.yape({ otp, phoneNumber }).create();
            if (!token?.id) throw new Error(token?.message || 'El código de Yape no pudo validarse.');

            const { data, error } = await supabase.functions.invoke<PaymentResult>('create-yape-payment', {
                body: {
                    token: token.id,
                    product_id: product.id,
                    request_id: getAttemptId(),
                },
            });
            if (error) throw error;
            if (await applyPaymentResult(data ?? {})) return;

            setYapeError(friendlyPaymentMessage(data ?? {}));
            setYapeOtp('');
        } catch (error: any) {
            setYapeError(error?.message || 'No pudimos procesar el pago con Yape.');
            onPaymentError(error);
        } finally {
            setYapeLoading(false);
        }
    };

    if (!isOpen || !product) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label="Completar pago">
            <div className="relative flex max-h-[94dvh] w-full max-w-[500px] flex-col overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-card)] text-[var(--bb-text)] shadow-2xl">
                <header className="flex shrink-0 items-center justify-between border-b border-[var(--bb-border)] bg-[var(--bb-card)] px-4 py-4 sm:px-5">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#009ee3] text-white">
                            <ShieldCheck size={21} />
                        </span>
                        <div className="min-w-0">
                            <p className="truncate text-base font-extrabold text-[var(--bb-text)]">Pago seguro con Mercado Pago</p>
                            <p className="truncate text-xs text-[var(--bb-text-secondary)]">
                                {product.name} <span className="px-1">·</span> <strong className="text-emerald-400">S/ {product.price.toFixed(2)}</strong>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Cerrar" className="ml-3 rounded-full p-2 text-[var(--bb-text-secondary)] transition-colors hover:bg-[var(--bb-hover)] hover:text-[var(--bb-text)]">
                        <X size={20} />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto">
                    {paymentState === 'approved' ? (
                        <div className="flex flex-col items-center gap-4 p-8 text-center">
                            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white"><CheckCircle2 size={34} /></span>
                            <div>
                                <h2 className="text-2xl font-extrabold text-[var(--bb-text)]">Pago confirmado</h2>
                                <p className="mt-2 text-sm leading-6 text-[var(--bb-text-secondary)]">Tu compra de <strong className="text-[var(--bb-text)]">{product.name}</strong> ya fue acreditada.</p>
                            </div>
                            <button onClick={onClose} className="mt-2 w-full rounded-xl bg-[#009ee3] px-4 py-3 font-bold text-white transition-colors hover:bg-[#008dcc]">Volver a la tienda</button>
                        </div>
                    ) : paymentState === 'pending' ? (
                        <div className="flex flex-col items-center gap-4 p-8 text-center">
                            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-400 text-[#191919]"><Clock3 size={32} /></span>
                            <div>
                                <h2 className="text-2xl font-extrabold text-[var(--bb-text)]">Pago en confirmación</h2>
                                <p className="mt-2 text-sm leading-6 text-[var(--bb-text-secondary)]">{statusMessage}</p>
                            </div>
                            {externalResourceUrl && (
                                <a href={externalResourceUrl} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#009ee3] px-4 py-3 font-bold text-white">
                                    Ver instrucciones <ExternalLink size={17} />
                                </a>
                            )}
                            <button onClick={onClose} className="w-full rounded-xl border border-[var(--bb-border)] px-4 py-3 font-bold text-[var(--bb-text)] transition-colors hover:bg-[var(--bb-hover)]">Cerrar</button>
                        </div>
                    ) : (
                        <>
                            <div className="border-b border-[var(--bb-border)] p-3">
                                <div className="grid grid-cols-2 rounded-xl bg-[var(--bb-darker)] p-1">
                                    <button onClick={() => setMethod('brick')} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition-colors ${method === 'brick' ? 'bg-[#009ee3] text-white' : 'text-[var(--bb-text-secondary)] hover:bg-[var(--bb-hover)] hover:text-[var(--bb-text)]'}`}>
                                        <CreditCard size={16} /> Tarjetas y saldo
                                    </button>
                                    <button onClick={() => setMethod('yape')} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition-colors ${method === 'yape' ? 'bg-[#6c3fd1] text-white' : 'text-[var(--bb-text-secondary)] hover:bg-[var(--bb-hover)] hover:text-[var(--bb-text)]'}`}>
                                        <img src="/yape-logo.png.png" alt="" className="h-5 w-5 object-contain" /> Yape
                                    </button>
                                </div>
                            </div>

                            {method === 'brick' ? (
                                <div className="p-3 sm:p-4">
                                    {brickError && <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-900 bg-red-950 px-3 py-3 text-xs text-red-200"><AlertCircle size={16} className="mt-0.5 shrink-0" />{brickError}</div>}
                                    <Payment
                                        key={`${brickKey}-${themeMode}`}
                                        initialization={{ amount: product.price, payer: { email: profile?.email || '' } }}
                                        customization={{
                                            visual: { style: { theme: themeMode === 'dark' ? 'dark' : 'default' } },
                                            paymentMethods: {
                                                creditCard: 'all',
                                                debitCard: 'all',
                                                mercadoPago: 'all',
                                                ticket: 'all',
                                                atm: 'all',
                                            },
                                        }}
                                        onSubmit={handleBrickSubmit}
                                        onReady={() => setBrickError(null)}
                                        onError={(error) => {
                                            setBrickError('No se pudo cargar el formulario de pago. Recarga la página.');
                                            onPaymentError(error);
                                        }}
                                    />
                                </div>
                            ) : (
                                <form onSubmit={handleYapePay} className="space-y-4 p-5">
                                    <div className="flex items-start gap-3 rounded-xl border border-[var(--bb-border)] bg-[var(--bb-darker)] p-4">
                                        <img src="/yape-logo.png.png" alt="Yape" className="h-11 w-11 shrink-0 object-contain" />
                                        <div>
                                            <p className="font-extrabold text-[var(--bb-text)]">Paga con tu código de aprobación</p>
                                            <p className="mt-1 text-xs leading-5 text-[var(--bb-text-secondary)]">En Yape abre <strong className="text-[var(--bb-text)]">Menú → Código de aprobación</strong> y usa el código de 6 dígitos.</p>
                                        </div>
                                    </div>

                                    <label className="block space-y-2">
                                        <span className="flex items-center gap-2 text-xs font-bold text-[var(--bb-text)]"><Smartphone size={15} /> Celular afiliado a Yape</span>
                                        <div className="flex overflow-hidden rounded-xl border border-[var(--bb-border)] bg-[var(--bb-darker)] focus-within:border-[#6c3fd1]">
                                            <span className="border-r border-[var(--bb-border)] px-3 py-3 text-sm text-[var(--bb-text-secondary)]">+51</span>
                                            <input type="tel" inputMode="numeric" autoComplete="tel" maxLength={9} value={yapePhone} onChange={(event) => setYapePhone(event.target.value.replace(/\D/g, ''))} placeholder="987654321" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-[var(--bb-text)] outline-none" required />
                                        </div>
                                    </label>

                                    <label className="block space-y-2">
                                        <span className="text-xs font-bold text-[var(--bb-text)]">Código de aprobación</span>
                                        <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={yapeOtp} onChange={(event) => setYapeOtp(event.target.value.replace(/\D/g, ''))} placeholder="000000" className="w-full rounded-xl border border-[var(--bb-border)] bg-[var(--bb-darker)] px-4 py-3 text-center font-mono text-xl tracking-[0.35em] text-[var(--bb-text)] outline-none focus:border-[#6c3fd1]" required />
                                    </label>

                                    {yapeError && <div className="flex items-start gap-2 rounded-xl border border-red-900 bg-red-950 px-3 py-3 text-xs text-red-200"><AlertCircle size={16} className="mt-0.5 shrink-0" />{yapeError}</div>}

                                    <button type="submit" disabled={yapeLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6c3fd1] px-4 py-3.5 font-extrabold text-white transition-colors hover:bg-[#5d32bd] disabled:cursor-not-allowed disabled:opacity-60">
                                        {yapeLoading ? <><Loader2 size={18} className="animate-spin" /> Procesando</> : <>Pagar S/ {product.price.toFixed(2)} con Yape</>}
                                    </button>
                                </form>
                            )}

                            <footer className="flex items-center justify-center gap-2 border-t border-[var(--bb-border)] px-4 py-3 text-[11px] text-[var(--bb-text-secondary)]">
                                <LockKeyhole size={13} /> CampusLink no recibe ni almacena tus datos de pago.
                            </footer>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
