'use client';

import React, { useEffect } from 'react';
import { Payment } from '@mercadopago/sdk-react';
import { initMercadoPago } from '@mercadopago/sdk-react';
import { X } from 'lucide-react';
import { apiFetch } from '@/lib/api';

// Initialize with the Public Key provided by the user
const MP_PUBLIC_KEY = 'TEST-bc969050-c4a6-4ff0-a0b9-3f926e9ee60f';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: {
        id: string;
        name: string;
        price: number;
        type: 'vip' | 'coins' | 'item';
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
    useEffect(() => {
        initMercadoPago(MP_PUBLIC_KEY, { locale: 'es-PE' });
    }, []);

    if (!isOpen || !product) return null;

    const customization: any = {
        visual: {
            style: {
                theme: 'default',
            }
        },
        paymentMethods: {
            minInstallments: 1,
            maxInstallments: 1,
            ticket: 'all',
            bankTransfer: 'all',
            creditCard: 'all',
            debitCard: 'all',
        }
    };

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

            onPaymentSuccess(result);
            return Promise.resolve();

        } catch (error: any) {
            onPaymentError(error);
            return new Promise((resolve, reject) => {
                reject({
                    cause: error.message || 'Error processing payment',
                });
            });
        }
    };

    const onError = async (error: any) => {
        console.error('Payment Brick Error:', error);
        onPaymentError(error);
    };

    const onReady = async () => {
        // console.log('Brick is ready');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full sm:max-w-2xl bg-[#141416] rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-white/10 animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 bg-[#1A1D24] shrink-0 rounded-t-3xl">
                    <div>
                        <h3 className="text-lg sm:text-xl font-bold text-white">Completar Pago</h3>
                        <p className="text-sm text-gray-400">
                            {product.name} - <span className="text-blue-400 font-mono">S/ {product.price.toFixed(2)}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body - MP Brick - Scrollable */}
                <div className="p-0 sm:p-6 bg-white overflow-y-auto">
                    <div className="p-4 sm:p-0 min-h-[400px]">
                        <Payment
                            initialization={{
                                amount: product.price,
                            }}
                            customization={customization}
                            onSubmit={onSubmit}
                            onReady={onReady}
                            onError={onError}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
