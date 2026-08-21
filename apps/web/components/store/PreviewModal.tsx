'use client';

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShopItem } from '@/lib/supabase';
import { AvatarWithFrame } from '@/components/ui/AvatarWithFrame';
import { Check, Zap } from 'lucide-react';

interface PreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: ShopItem | null;
    profile: any;
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
    canAfford,
}: PreviewModalProps) {
    if (!item) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                className="
          fixed left-1/2 top-1/2
          -translate-x-1/2 -translate-y-1/2
          w-[92vw] max-w-[420px] md:max-w-4xl
          max-h-[85vh]
          p-0
          bg-[var(--bb-card)]
          border-[var(--bb-border)]
          text-[var(--bb-text)]
          rounded-3xl
          shadow-2xl
          flex flex-col
          overflow-hidden
          overscroll-contain
          z-[100]
        "
            >
                <DialogTitle className="sr-only">
                    Vista previa del artículo
                </DialogTitle>
                <DialogDescription className="sr-only">
                    Vista previa y detalles del artículo {item.name}
                </DialogDescription>

                {/* CONTENEDOR PRINCIPAL */}
                <div className="flex flex-col md:flex-row h-full w-full overflow-y-auto overflow-x-hidden">

                    {/* IZQUIERDA – ARTÍCULO */}
                    <div className="
            flex-1
            p-6 md:p-12
            flex flex-col
            items-center
            justify-center
            bg-[var(--bb-darker)]
            relative
            border-b md:border-b-0 md:border-r
            border-[var(--bb-border)]
            min-h-[280px] md:min-h-[400px]
          ">
                        <div className="absolute left-6 top-4 text-[10px] font-bold uppercase tracking-wider text-[var(--bb-text-secondary)] md:text-xs">
                            {item.type === 'profile_frame' ? 'Avatar Decoration' : 'Item'}
                        </div>

                        <div className="relative w-28 h-28 sm:w-36 sm:h-36 md:w-64 md:h-64 flex items-center justify-center">
                            <div className="absolute inset-0 bg-blue-500/10 blur-[40px] md:blur-[60px] rounded-full animate-pulse" />
                            <img
                                src={item.image_url || ''}
                                alt={item.name}
                                className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                            />
                        </div>

                        <h2 className="mt-4 md:mt-8 text-lg md:text-3xl font-black text-center tracking-tight px-4">
                            {item.name}
                        </h2>

                        <p className="mt-1 max-w-xs px-4 text-center text-[11px] text-[var(--bb-text-secondary)] md:text-base">
                            {item.description}
                        </p>
                    </div>

                    {/* DERECHA – PREVIEW + ACCIONES */}
                    <div className="flex w-full flex-col bg-[var(--bb-card)] p-6 md:w-[400px] md:p-8">
                        <h3 className="text-xs md:text-lg font-bold uppercase tracking-wider mb-4 md:mb-8 text-center md:text-left">
                            Vista previa
                        </h3>

                        {/* PREVIEW */}
                        <div className="
              flex flex-col
              items-center
              justify-center
              min-h-[140px] md:min-h-[200px]
              bg-[var(--bb-darker)]
              rounded-2xl
              border border-[var(--bb-border)]
              p-4 md:p-6
              mb-6 md:mb-8
              relative
              overflow-hidden
            ">
                            <div className="absolute inset-0 opacity-5 pointer-events-none bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

                            <div className="
                w-full
                max-w-[180px] md:max-w-[280px]
                bg-[var(--bb-card)]
                rounded-xl
                p-3 md:p-4
                shadow-xl
                border border-[var(--bb-border)]
                relative
                overflow-hidden
              ">
                                <div className="h-10 md:h-16 w-full bg-gradient-to-r from-blue-600 to-purple-600 absolute top-0 left-0" />

                                <div className="mt-5 md:mt-8 flex gap-2 md:gap-3 items-end relative z-10">
                                    <AvatarWithFrame
                                        size={45}
                                        avatarUrl={profile?.avatar_url}
                                        name={profile?.nombre}
                                        frameUrl={item.image_url}
                                        frameScale={item.frame_settings?.preview?.scale ?? 1}
                                        offsetX={item.frame_settings?.preview?.x ?? 0}
                                        offsetY={item.frame_settings?.preview?.y ?? 0}
                                        className="rounded-full bg-[var(--bb-card)] ring-2 ring-[var(--bb-card)] md:ring-4"
                                    />

                                    <div className="mb-1 md:mb-2">
                                        <div className="h-2 w-16 md:h-4 md:w-24 bg-gray-600 rounded mb-1 animate-pulse" />
                                        <div className="h-1.5 w-10 md:h-3 md:w-16 bg-gray-700 rounded animate-pulse" />
                                    </div>
                                </div>
                            </div>

                            <p className="mt-3 text-[9px] font-medium text-[var(--bb-text-secondary)] md:mt-6 md:text-xs">
                                Previsualización de perfil
                            </p>
                        </div>

                        {/* ACCIONES */}
                        <div className="mt-auto space-y-4">
                            {!isOwned && (
                                <div className="space-y-4 px-2">
                                    {item.max_uses !== null && (
                                        <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl flex items-center gap-3">
                                            <Zap className="text-indigo-400 w-5 h-5 flex-shrink-0" />
                                            <div>
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none">Ítem Consumible</p>
                                                <p className="text-xs text-indigo-100 font-bold mt-1">Este artículo permite hasta <span className="text-indigo-400">{item.max_uses} usos</span>.</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--bb-text-secondary)] md:text-sm">
                                            Costo Total
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <img
                                                src="/icons/moneda.png"
                                                alt="Coin"
                                                className="w-4 h-4 md:w-6 md:h-6"
                                            />
                                            <span className="text-lg md:text-2xl font-black">
                                                {item.price_coins}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <Button
                                onClick={() => onBuy(item)}
                                disabled={isOwned || loading || (!isOwned && !canAfford)}
                                className={`w-full h-11 md:h-14 text-sm md:text-lg font-black rounded-xl transition-all active:scale-[0.98]
                  ${isOwned
                                        ? 'bg-green-500/10 text-green-500 border border-green-500/30'
                                        : 'bg-[#ffc400] hover:bg-[#ffb300] text-black border-b-4 border-[#cc9d00]'
                                    }
                `}
                            >
                                {loading ? (
                                    <div className="h-4 w-4 md:h-6 md:w-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : isOwned ? (
                                    <span className="flex items-center gap-2">
                                        <Check size={16} /> Adquirido
                                    </span>
                                ) : (
                                    'Comprar ahora'
                                )}
                            </Button>

                            {!isOwned && !canAfford && (
                                <p className="text-[9px] md:text-xs text-red-500 text-center font-bold uppercase tracking-widest bg-red-500/10 py-1 rounded-md">
                                    Fondos insuficientes
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
