
'use client';

import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
            <DialogContent className="max-w-4xl p-0 overflow-hidden bg-[#1a1b1e] border-[#2c2e33] text-white rounded-3xl shadow-2xl">
                <div className="flex flex-col md:flex-row h-full max-h-[85vh]">

                    {/* LEFT SIDE: Item Showcase */}
                    <div className="flex-1 p-8 md:p-12 flex flex-col items-center justify-center bg-gradient-to-br from-[#141517] to-[#101113] relative border-b md:border-b-0 md:border-r border-[#2c2e33]">

                        {/* Type Label */}
                        <div className="absolute top-6 left-6 text-xs font-bold tracking-wider text-gray-500 uppercase">
                            {item.type === 'profile_frame' ? 'Avatar Decoration' : 'Item'}
                        </div>

                        {/* Main Image Display */}
                        <div className="relative w-48 h-48 md:w-64 md:h-64 flex items-center justify-center animate-in zoom-in-50 duration-500">
                            {/* Glow Effect */}
                            <div className="absolute inset-0 bg-blue-500/10 blur-[60px] rounded-full animate-pulse" />

                            <img
                                src={item.image_url || ''}
                                alt={item.name}
                                className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                            />
                        </div>

                        <h2 className="mt-8 text-2xl md:text-3xl font-black text-center text-white tracking-tight">
                            {item.name}
                        </h2>
                        <p className="mt-2 text-gray-400 text-center text-sm md:text-base max-w-xs leading-relaxed">
                            {item.description}
                        </p>
                    </div>

                    {/* RIGHT SIDE: Preview & Actions */}
                    <div className="w-full md:w-[400px] bg-[#1a1b1e] p-6 md:p-8 flex flex-col">

                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-lg font-bold text-white">Preview</h3>
                            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10 text-gray-400">
                                <X size={20} />
                            </Button>
                        </div>

                        {/* Preview Box */}
                        <div className="flex-1 flex flex-col items-center justify-center min-h-[200px] bg-[#141517] rounded-2xl border border-[#2c2e33] p-6 mb-8 relative group">
                            <div className="absolute inset-0 bg-[url('/grid-pattern.png')] opacity-5 pointer-events-none" />

                            {/* Profile Card Mockup */}
                            <div className="w-full max-w-[280px] bg-[#25262b] rounded-xl p-4 shadow-xl border border-[#2c2e33] relative overflow-hidden">
                                {/* Banner Mockup */}
                                <div className="h-16 w-full bg-gradient-to-r from-blue-600 to-purple-600 absolute top-0 left-0" />

                                <div className="mt-8 pl-2 relative z-10 flex gap-3 items-end">
                                    <AvatarWithFrame
                                        size={80} // Large preview size
                                        avatarUrl={profile?.avatar_url}
                                        name={profile?.nombre}
                                        frameUrl={item.image_url}
                                        // Assume default scale for preview, or use item settings if available in future
                                        className="ring-4 ring-[#25262b] rounded-full bg-[#25262b]"
                                    />
                                    <div className="mb-2">
                                        <div className="h-4 w-24 bg-gray-600 rounded mb-1.5 animate-pulse" style={{ animationDuration: '3s' }} />
                                        <div className="h-3 w-16 bg-gray-700 rounded animate-pulse" style={{ animationDuration: '4s' }} />
                                    </div>
                                </div>
                            </div>

                            <p className="mt-6 text-xs text-gray-500 font-medium">Así es como te verás</p>
                        </div>

                        {/* Action Area */}
                        <div className="mt-auto space-y-4">
                            {!isOwned && (
                                <div className="flex justify-between items-center px-2">
                                    <span className="text-gray-400 text-sm">Precio</span>
                                    <div className="flex items-center gap-2">
                                        <img src="/icons/moneda.png" alt="Coin" className="w-6 h-6 object-contain" />
                                        <span className="text-2xl font-black text-white">{item.price_coins}</span>
                                    </div>
                                </div>
                            )}

                            <Button
                                onClick={() => onBuy(item)}
                                disabled={isOwned || loading || (!isOwned && !canAfford)}
                                className={`w-full h-14 text-lg font-bold rounded-xl shadow-lg transition-all ${isOwned
                                        ? 'bg-green-500/20 text-green-500 border border-green-500/50 hover:bg-green-500/30'
                                        : 'bg-[#ffc400] hover:bg-[#ffb300] text-black'
                                    }`}
                            >
                                {loading ? (
                                    <div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : isOwned ? (
                                    <span className="flex items-center gap-2"><Check size={20} /> Adquirido</span>
                                ) : (
                                    'Comprar'
                                )}
                            </Button>

                            {!isOwned && !canAfford && (
                                <p className="text-xs text-red-400 text-center font-medium">
                                    No tienes suficientes monedas
                                </p>
                            )}
                        </div>

                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
