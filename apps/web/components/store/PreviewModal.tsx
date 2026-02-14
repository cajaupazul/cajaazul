
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
            <DialogContent className="max-w-4xl p-0 overflow-hidden bg-[#1a1b1e] border-[#2c2e33] text-white rounded-3xl shadow-2xl max-h-[95vh] flex flex-col">
                <DialogTitle className="sr-only">Vista Previa del Artículo</DialogTitle>
                <DialogDescription className="sr-only">Detalles y vista previa del artículo seleccionado: {item.name}</DialogDescription>
                <div className="flex flex-col md:flex-row h-full overflow-y-auto md:overflow-hidden">
                    {/* LEFT SIDE: Item Showcase */}
                    <div className="flex-1 p-6 md:p-12 flex flex-col items-center justify-center bg-gradient-to-br from-[#141517] to-[#101113] relative border-b md:border-b-0 md:border-r border-[#2c2e33] min-h-[300px]">
                        {/* Type Label */}
                        <div className="absolute top-4 md:top-6 left-4 md:left-6 text-[10px] md:text-xs font-bold tracking-wider text-gray-500 uppercase">
                            {item.type === 'profile_frame' ? 'Avatar Decoration' : 'Item'}
                        </div>

                        {/* Main Image Display */}
                        <div className="relative w-40 h-40 md:w-64 md:h-64 flex items-center justify-center animate-in zoom-in-50 duration-500">
                            {/* Glow Effect */}
                            <div className="absolute inset-0 bg-blue-500/10 blur-[40px] md:blur-[60px] rounded-full animate-pulse" />

                            <img
                                src={item.image_url || ''}
                                alt={item.name}
                                className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                            />
                        </div>

                        <h2 className="mt-6 md:mt-8 text-xl md:text-3xl font-black text-center text-white tracking-tight px-4">
                            {item.name}
                        </h2>
                        <p className="mt-2 text-gray-400 text-center text-xs md:text-base max-w-xs leading-relaxed px-4">
                            {item.description}
                        </p>
                    </div>

                    {/* RIGHT SIDE: Preview & Actions */}
                    <div className="w-full md:w-[400px] bg-[#1a1b1e] p-6 md:p-8 flex flex-col">
                        <div className="flex items-center justify-between mb-6 md:mb-8">
                            <h3 className="text-base md:text-lg font-bold text-white uppercase tracking-wider">Vista Previa</h3>
                        </div>

                        {/* Preview Box */}
                        <div className="flex-1 flex flex-col items-center justify-center min-h-[180px] bg-[#141517] rounded-2xl border border-[#2c2e33] p-4 md:p-6 mb-6 md:mb-8 relative group">
                            <div className="absolute inset-0 opacity-5 pointer-events-none bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

                            {/* Profile Card Mockup */}
                            <div className="w-full max-w-[240px] md:max-w-[280px] bg-[#25262b] rounded-xl p-3 md:p-4 shadow-xl border border-[#2c2e33] relative overflow-hidden">
                                {/* Banner Mockup */}
                                <div className="h-12 md:h-16 w-full bg-gradient-to-r from-blue-600 to-purple-600 absolute top-0 left-0" />

                                <div className="mt-6 md:mt-8 pl-1 md:pl-2 relative z-10 flex gap-2 md:gap-3 items-end">
                                    <AvatarWithFrame
                                        size={60} // Adjusted for better fit on all screens
                                        avatarUrl={profile?.avatar_url}
                                        name={profile?.nombre}
                                        frameUrl={item.image_url}
                                        frameScale={item.frame_settings?.preview?.scale ?? 1.0}
                                        offsetX={item.frame_settings?.preview?.x ?? 0}
                                        offsetY={item.frame_settings?.preview?.y ?? 0}
                                        className="ring-2 md:ring-4 ring-[#25262b] rounded-full bg-[#25262b]"
                                    />
                                    <div className="mb-1 md:mb-2">
                                        <div className="h-3 w-16 md:h-4 md:w-24 bg-gray-600 rounded mb-1 animate-pulse" style={{ animationDuration: '3s' }} />
                                        <div className="h-2 w-12 md:h-3 md:w-16 bg-gray-700 rounded animate-pulse" style={{ animationDuration: '4s' }} />
                                    </div>
                                </div>
                            </div>

                            <p className="mt-4 md:mt-6 text-[10px] md:text-xs text-gray-500 font-medium">Así es como aparecerás</p>
                        </div>

                        {/* Action Area */}
                        <div className="mt-auto space-y-4">
                            {!isOwned && (
                                <div className="flex justify-between items-center px-2">
                                    <span className="text-gray-400 text-xs md:text-sm">Precio</span>
                                    <div className="flex items-center gap-2">
                                        <img src="/icons/moneda.png" alt="Coin" className="w-5 h-5 md:w-6 md:h-6 object-contain" />
                                        <span className="text-xl md:text-2xl font-black text-white">{item.price_coins}</span>
                                    </div>
                                </div>
                            )}

                            <Button
                                onClick={() => onBuy(item)}
                                disabled={isOwned || loading || (!isOwned && !canAfford)}
                                className={`w-full h-12 md:h-14 text-base md:text-lg font-black rounded-xl shadow-lg transition-all active:scale-[0.98] ${isOwned
                                    ? 'bg-green-500/10 text-green-500 border border-green-500/30'
                                    : 'bg-[#ffc400] hover:bg-[#ffb300] text-black border-b-4 border-[#cc9d00] active:border-b-0'
                                    }`}
                            >
                                {loading ? (
                                    <div className="h-5 w-5 md:h-6 md:w-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : isOwned ? (
                                    <span className="flex items-center gap-2"><Check size={18} /> Adquirido</span>
                                ) : (
                                    'Comprar'
                                )}
                            </Button>

                            {!isOwned && !canAfford && (
                                <p className="text-[10px] md:text-xs text-red-400 text-center font-bold uppercase tracking-wider">
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
