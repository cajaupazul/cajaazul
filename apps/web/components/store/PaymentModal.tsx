'use client';

import React, { useEffect } from 'react';
import { Payment } from '@mercadopago/sdk-react';
import { initMercadoPago } from '@mercadopago/sdk-react';
import { X } from 'lucide-react';
import { ShopItem } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';

// Initialize with the Public Key provided by the user
// In production, this should be in an environment variable
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

    const customization = {
        paymentMethods: {
            ticket: ['all'],
            bankTransfer: ['all'],
            creditCard: ['all'],
            debitCard: ['all'],
        },
    };

    const onSubmit = async (param: any) => {
        const { selectedPaymentMethod, formData } = param;

        try {
            const response = await fetch('https://campuslink-api.cajaupazul.workers.dev/checkout/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    product_id: product.id,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                onPaymentError(result);
                // Return generic error to Brick
                return new Promise((resolve, reject) => {
                    reject({
                        cause: result.error || 'Unknown error',
                    });
                });
            }

            onPaymentSuccess(result);

            // Return success to Brick to show success screen? 
            // Or typically we verify and close. 
            // The Brick Promise resolution behavior depends on configuration.
            // But usually we just resolve void.
            return Promise.resolve();

        } catch (error) {
            onPaymentError(error);
            return new Promise((resolve, reject) => {
                reject({
                    cause: 'Network error',
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-[#141416] rounded-3xl shadow-2xl overflow-hidden border border-white/10 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#1A1D24]">
                    <div>
                        <h3 className="text-xl font-bold text-white">Completar Pago</h3>
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

                {/* Body - MP Brick */}
                <div className="p-2 sm:p-6 bg-white min-h-[400px]">
                    <Payment
                        initialization={{
                            amount: product.price,
                            /*  preferenceId: '<PREFERENCE_ID>',  <-- WE DO NOT USE THIS ANYMORE */
                        }}
                        customization={customization}
                        onSubmit={onSubmit}
                        onReady={onReady}
                        onError={onError}
                    />
                </div>
            </div>
        </div>
    );
}
