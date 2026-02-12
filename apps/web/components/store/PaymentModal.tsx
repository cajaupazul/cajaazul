'use client';

import React, { useEffect, useState } from 'react';
import { ShoppingBag, ShieldCheck, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useProfile } from '@/lib/profile-context';

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
        }
    }, [isOpen]);

    if (!isOpen || !product) return null;

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
                <div className="p-6 bg-white shrink-0">
                    {viewState === 'form' ? (
                        <div className="flex flex-col items-center justify-center space-y-8 py-10">
                            <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                                <ShoppingBag size={48} strokeWidth={1.5} />
                            </div>

                            <div className="text-center space-y-2 max-w-sm">
                                <p className="text-gray-600 text-lg">
                                    Serás redirigido a la plataforma segura de <strong>Mercado Pago</strong> para completar tu compra de <strong>{product.name}</strong>.
                                </p>
                                <p className="text-xs text-gray-400">
                                    Aceptamos Yape, Plin, tarjetas de crédito, débito y efectivo.
                                </p>
                            </div>

                            <button
                                onClick={async () => {
                                    try {
                                        setLoadingRedirection(true);
                                        const response = await apiFetch('/checkout', {
                                            method: 'POST',
                                            body: JSON.stringify({
                                                product_id: product.id
                                            })
                                        });

                                        if (response.init_point) {
                                            window.location.href = response.init_point;
                                        } else {
                                            throw new Error('No se pudo generar el link de pago');
                                        }
                                    } catch (err) {
                                        console.error('Error creating preference:', err);
                                        alert('Hubo un error al conectar con Mercado Pago. Por favor intente de nuevo.');
                                        setLoadingRedirection(false);
                                    }
                                }}
                                disabled={loadingRedirection}
                                className="w-full h-14 bg-[#009EE3] hover:bg-[#0086C3] text-white font-bold rounded-2xl shadow-lg shadow-blue-200 transition-all transform active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loadingRedirection ? (
                                    <>
                                        <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Generando link...</span>
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck size={24} />
                                        <span>Pagar con Mercado Pago | S/ {product.price.toFixed(2)}</span>
                                    </>
                                )}
                            </button>

                            <div className="flex items-center gap-4 opacity-40">
                                <img src="https://http2.mlstatic.com/storage/logos-api-admin/a5f04830-191d-11ee-81b2-1fd38f4e4441-m.svg" alt="Visa" className="h-6" />
                                <img src="https://http2.mlstatic.com/storage/logos-api-admin/aa2b8f70-191d-11ee-be4a-334337b777a8-m.svg" alt="MasterCard" className="h-6" />
                                <img src="https://http2.mlstatic.com/storage/logos-api-admin/7d93f860-b3a1-11ee-9e6b-9b6ef1a70967-xs@2x.png" alt="Yape" className="h-6" />
                            </div>
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
