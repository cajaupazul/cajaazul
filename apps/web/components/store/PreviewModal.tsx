
'use client';

import React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShopItem } from '@/lib/supabase';
import { AvatarWithFrame } from '@/components/ui/AvatarWithFrame';
import { X, Check } from 'lucide-react';

interface PreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: ShopItem | null;
    profile: any; // User profile for avatar
    onBuy: (item: ShopItem) => void;
    isOwned: boolean;
    loading?: boolean;
    canAfford: boolean;
}

export default function PreviewModal({
    isOpen,
    onClose,
    item,
    profile,
    onBuy,
    isOwned,
    loading = false,
    canAfford
}: PreviewModalProps) {
    if (!item) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[92vw] sm:max-w-4xl p-0 overflow-hidden bg-[#1a1b1e] border-[#2c2e33] text-white rounded-3xl shadow-2xl max-h-[90vh] flex flex-col translate-x-[-50%] translate-y-[-50%]">
                <DialogTitle className="sr-only">Vista Previa del Artículo</DialogTitle>
                <DialogDescription className="sr-only">Detalles y vista previa del artículo seleccionado: {item.name}</DialogDescription>
                <div className="flex flex-col md:flex-row h-full overflow-y-auto md:overflow-hidden">
                    {/* LEFT SIDE: Item Showcase */}
                    <div className="flex-1 p-5 md:p-12 flex flex-col items-center justify-center bg-gradient-to-br from-[#141517] to-[#101113] relative border-b md:border-b-0 md:border-r border-[#2c2e33] min-h-fit md:min-h-[400px]">
                        {/* Type Label */}
                        <div className="absolute top-4 md:top-6 left-4 md:left-6 text-[10px] md:text-xs font-bold tracking-wider text-gray-500 uppercase">
                            {item.type === 'profile_frame' ? 'Avatar Decoration' : 'Item'}
                        </div>

                        {/* Main Image Display */}
                        <div className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-64 md:h-64 flex items-center justify-center animate-in zoom-in-50 duration-500 mt-8 mb-4">
                            {/* Glow Effect */}
                            <div className="absolute inset-0 bg-blue-500/10 blur-[30px] md:blur-[60px] rounded-full animate-pulse" />

                            <img
                                src={item.image_url || ''}
                                alt={item.name}
                                className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                            />
                        </div>

                        <h2 className="text-lg md:text-3xl font-black text-center text-white tracking-tight px-4 mb-1">
                            {item.name}
                        </h2>
                        <p className="text-gray-400 text-center text-[10px] md:text-base max-w-xs leading-relaxed px-4 mb-4">
                            {item.description}
                        </p>
                    </div>

                    {/* RIGHT SIDE: Preview & Actions */}
                    <div className="w-full md:w-[400px] bg-[#1a1b1e] p-5 md:p-8 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm md:text-lg font-bold text-white uppercase tracking-wider">Vista Previa</h3>
                        </div>

                        {/* Preview Box */}
                        <div className="flex flex-col items-center justify-center min-h-[140px] md:min-h-[200px] bg-[#141517] rounded-2xl border border-[#2c2e33] p-4 md:p-6 relative group">
                            <div className="absolute inset-0 opacity-5 pointer-events-none bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

                            {/* Profile Card Mockup */}
                            <div className="w-full max-w-[200px] md:max-w-[280px] bg-[#25262b] rounded-xl p-3 md:p-4 shadow-xl border border-[#2c2e33] relative overflow-hidden">
                                {/* Banner Mockup */}
                                <div className="h-10 md:h-16 w-full bg-gradient-to-r from-blue-600 to-purple-600 absolute top-0 left-0" />

                                <div className="mt-5 md:mt-8 pl-1 md:pl-2 relative z-10 flex gap-2 md:gap-3 items-end">
                                    <AvatarWithFrame
                                        size={50} // Reduced for mobile fit
                                        avatarUrl={profile?.avatar_url}
                                        name={profile?.nombre}
                                        frameUrl={item.image_url}
                                        frameScale={item.frame_settings?.preview?.scale ?? 1.0}
                                        offsetX={item.frame_settings?.preview?.x ?? 0}
                                        offsetY={item.frame_settings?.preview?.y ?? 0}
                                        className="ring-2 md:ring-4 ring-[#25262b] rounded-full bg-[#25262b]"
                                    />
                                    <div className="mb-0.5 md:mb-2">
                                        <div className="h-2 w-12 md:h-4 md:w-24 bg-gray-600 rounded mb-1 animate-pulse" style={{ animationDuration: '3s' }} />
                                        <div className="h-2 w-8 md:h-3 md:w-16 bg-gray-700 rounded animate-pulse" style={{ animationDuration: '4s' }} />
                                    </div>
                                </div>
                            </div>

                            <p className="mt-3 md:mt-6 text-[8px] md:text-xs text-gray-500 font-medium tracking-tight">Tu perfil se lucirá así</p>
                        </div>

                        {/* Action Area */}
                        <div className="mt-auto space-y-3">
                            {!isOwned && (
                                <div className="flex justify-between items-center px-2">
                                    <span className="text-gray-400 text-[10px] md:text-sm">Precio</span>
                                    <div className="flex items-center gap-1.5 md:gap-2">
                                        <img src="/icons/moneda.png" alt="Coin" className="w-4 h-4 md:w-6 md:h-6 object-contain" />
                                        <span className="text-lg md:text-2xl font-black text-white">{item.price_coins}</span>
                                    </div>
                                </div>
                            )}

                            <Button
                                onClick={() => onBuy(item)}
                                disabled={isOwned || loading || (!isOwned && !canAfford)}
                                className={`w-full h-10 md:h-14 text-sm md:text-lg font-black rounded-xl shadow-lg transition-all active:scale-[0.98] ${isOwned
                                    ? 'bg-green-500/10 text-green-500 border border-green-500/30'
                                    : 'bg-[#ffc400] hover:bg-[#ffb300] text-black border-b-2 md:border-b-4 border-[#cc9d00] active:border-b-0'
                                    }`}
                            >
                                {loading ? (
                                    <div className="h-4 w-4 md:h-6 md:w-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : isOwned ? (
                                    <span className="flex items-center gap-2 text-xs md:text-base"><Check size={16} /> Adquirido</span>
                                ) : (
                                    'Comprar'
                                )}
                            </Button>

                            {!isOwned && !canAfford && (
                                <p className="text-[9px] md:text-xs text-red-400 text-center font-bold uppercase tracking-wider">
                                    Monedas insuficientes
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
