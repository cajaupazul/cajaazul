import React, { useEffect, useState } from 'react';
import { Payment, initMercadoPago } from '@mercadopago/sdk-react';
import { ShoppingBag, ShieldCheck, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useProfile } from '@/lib/profile-context';

// Initialize with the Public Key provided by the user
const MP_PUBLIC_KEY = 'APP_USR-c89b2d7b-b44e-4926-ba40-3d456209235d';

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
    const { profile } = useProfile();
    const [viewState, setViewState] = React.useState<'form' | 'success' | 'error'>('form');
    const [loadingRedirection, setLoadingRedirection] = React.useState(false);

    useEffect(() => {
        if (isOpen) {
            setViewState('form');
            setLoadingRedirection(false);
            initMercadoPago(MP_PUBLIC_KEY, { locale: 'es-PE' });
        }
    }, [isOpen]);

    if (!isOpen || !product) return null;

    const onSubmit = async (param: any) => {
        const { formData } = param;

        try {
            const result = await apiFetch('/checkout/process', {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    product_id: product.id,
                }),
            });

            // Call the parent success handler immediately to start credit update
            onPaymentSuccess(result);
            // Switch to success view
            setViewState('success');

            return Promise.resolve();

        } catch (error: any) {
            console.error(error);
            return new Promise((resolve, reject) => {
                reject({
                    cause: error.message || 'Error processing payment',
                });
            });
        }
    };

    const onError = async (error: any) => {
        console.error('Payment Brick Error:', error);
    };

    const onReady = async () => {
        // console.log('Brick is ready');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`relative w-full sm:max-w-2xl bg-[#141416] rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-white/10 animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 flex flex-col ${viewState === 'success' ? 'h-auto' : 'max-h-[90vh]'}`}>

                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 bg-[#1A1D24] shrink-0 rounded-t-3xl">
                    <div>
                        <h3 className="text-lg sm:text-xl font-bold text-white">
                            {viewState === 'success' ? '¡Pago Exitoso!' : 'Completar Pago'}
                        </h3>
                        {viewState === 'form' && (
                            <p className="text-sm text-gray-400">
                                {product.name} - <span className="text-blue-400 font-mono">S/ {product.price.toFixed(2)}</span>
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-0 sm:p-6 bg-white overflow-y-auto min-h-[400px]">
                    {viewState === 'form' ? (
                        <div className="p-4 sm:p-0">
                            <Payment
                                initialization={{
                                    amount: product.price,
                                    payer: {
                                        email: profile?.email || 'pago@campuslink.pe',
                                        entityType: 'individual'
                                    }
                                }}
                                customization={{
                                    paymentMethods: {
                                        creditCard: 'all',
                                        debitCard: 'all',
                                    }
                                }}
                                onSubmit={onSubmit}
                                onReady={onReady}
                                onError={onError}
                            />
                        </div>
                    ) : (
                        <div className="p-8 flex flex-col items-center text-center space-y-6">
                            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2 animate-bounce">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">¡Compra Realizada!</h2>
                            <p className="text-gray-600 text-lg">
                                Has adquirido <strong>{product.name}</strong> correctamente. <br />
                                Tus beneficios han sido agregados a tu cuenta.
                            </p>
                            <button
                                onClick={onClose}
                                className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all transform active:scale-95"
                            >
                                Entendido, volver a la tienda
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
