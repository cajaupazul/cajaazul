'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { supabase, ShopItem, UserInventoryItem } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';
import { Package, Check, Zap, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function InventoryPage() {
    const { colors } = useTheme();
    const { profile, refreshProfile } = useProfile();
    const [inventory, setInventory] = useState<(UserInventoryItem & { shop_items: ShopItem })[]>([]);
    const [loading, setLoading] = useState(true);
    const [equipLoading, setEquipLoading] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const fetchInventory = async () => {
            if (!profile?.id) return;

            setLoading(true);
            const { data, error } = await supabase
                .from('user_inventory')
                .select('*, shop_items(*)')
                .eq('user_id', profile.id)
                .order('acquired_at', { ascending: false });

            if (!error && data) {
                setInventory(data as any);
            }
            setLoading(false);
        };

        fetchInventory();
    }, [profile?.id]);

    const handleEquipFrame = async (itemId: string, itemName: string) => {
        setEquipLoading(itemId);
        setMessage(null);

        try {
            await apiFetch('/shop/equip', {
                method: 'POST',
                body: JSON.stringify({ item_id: itemId })
            });

            setMessage({ type: 'success', text: `¡${itemName} equipado con éxito!` });
            await refreshProfile();
            // Refresh inventory
            const { data: invData } = await supabase
                .from('user_inventory')
                .select('*, shop_items(*)')
                .eq('user_id', profile!.id)
                .order('acquired_at', { ascending: false });
            if (invData) setInventory(invData as any);

        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Error al equipar marco' });
        } finally {
            setEquipLoading(null);
            setTimeout(() => setMessage(null), 5000);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-12 h-12 border-4 border-t-faculty-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <h1 className="text-4xl font-extrabold text-bb-text tracking-tight flex items-center gap-3">
                        <Package className="w-10 h-10" style={{ color: colors?.primary }} />
                        Mi Inventario
                    </h1>
                    <p className="text-bb-text-secondary text-lg">
                        Aquí están todos tus artículos adquiridos. Equipa marcos para personalizar tu perfil.
                    </p>
                </div>
                <Link href="/dashboard/store">
                    <Button
                        className="font-bold rounded-xl text-white"
                        style={{ backgroundColor: colors?.primary }}
                    >
                        Ir a la Tienda
                    </Button>
                </Link>
            </div>

            {/* Feedback Message */}
            {message && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${message.type === 'success'
                    ? 'bg-green-500/10 border border-green-500/20'
                    : 'bg-red-500/10 border border-red-500/20'
                    }`}>
                    {message.type === 'success' ? (
                        <CheckCircle2 className="text-green-500" size={24} />
                    ) : (
                        <AlertCircle className="text-red-500" size={24} />
                    )}
                    <p className="text-bb-text font-medium">{message.text}</p>
                </div>
            )}

            {/* Inventory Grid */}
            {inventory.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                    {inventory.map((invItem) => {
                        const item = invItem.shop_items;
                        if (!item) return null;

                        const isEquipped = profile?.active_frame_key === item.frame_key;
                        const isLoading = equipLoading === invItem.id;

                        return (
                            <div
                                key={invItem.id}
                                className={`relative rounded-2xl border bg-bb-card p-3 sm:p-6 transition-all hover:shadow-lg flex flex-col ${isEquipped ? 'ring-2 ring-blue-500 shadow-blue-500/20' : 'border-bb-border'
                                    }`}
                            >
                                {/* Equipped Badge */}
                                {isEquipped && (
                                    <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-blue-500 text-white px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1 animate-pulse z-30">
                                        <Zap size={12} className="sm:hidden" />
                                        <Zap size={14} className="hidden sm:block" />
                                        <span className="hidden sm:inline">Equipado</span>
                                        <span className="sm:hidden">Activo</span>
                                    </div>
                                )}

                                <div className="w-full aspect-square rounded-xl bg-bb-sidebar flex items-center justify-center relative mb-3 sm:mb-4">
                                    {/* Dummy Avatar behind for context */}
                                    <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-bb-dark flex items-center justify-center border border-bb-border overflow-hidden opacity-50 relative z-0">
                                        <div className="w-full h-full bg-gradient-to-br from-bb-sidebar to-bb-dark" />
                                    </div>

                                    {item.image_url ? (
                                        <img
                                            src={item.image_url}
                                            alt={item.name}
                                            className="w-[120%] h-[120%] object-contain absolute inset-[-10%] z-10 pointer-events-none"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full border-4 border-bb-border absolute inset-0 m-auto pointer-events-none">
                                            <div className="w-full h-full rounded-full bg-bb-text-secondary/20" />
                                        </div>
                                    )}
                                </div>

                                {/* Item Info */}
                                <div className="space-y-2 sm:space-y-3 flex-1 flex flex-col">
                                    <div className="flex-1 min-h-[4rem] sm:min-h-[5rem]">
                                        <div className="flex items-center justify-between gap-2">
                                            <h3 className="text-sm sm:text-xl font-bold text-bb-text leading-tight line-clamp-1">{item.name}</h3>
                                            {invItem.remaining_uses !== null && (
                                                <span className="bg-blue-500 text-white text-[9px] sm:text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                                                    {invItem.remaining_uses}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] sm:text-sm text-bb-text-secondary line-clamp-2 mt-1">{item.description}</p>
                                    </div>

                                    {item.type === 'profile_frame' ? (
                                        <Button
                                            onClick={() => handleEquipFrame(item.id, item.name)}
                                            disabled={isEquipped || isLoading}
                                            size="sm"
                                            className={`w-full font-bold rounded-lg sm:rounded-xl text-xs sm:text-sm h-8 sm:h-10 mt-auto ${isEquipped
                                                ? 'bg-bb-hover text-bb-text-secondary cursor-not-allowed'
                                                : 'text-white hover:opacity-90 transition-opacity'
                                                }`}
                                            style={!isEquipped && !isLoading ? { backgroundColor: colors?.primary } : undefined}
                                        >
                                            {isLoading ? '...' : isEquipped ? (
                                                <span className="flex items-center gap-1 sm:gap-2 justify-center">
                                                    <Check size={14} className="sm:w-4 sm:h-4" />
                                                    <span className="hidden sm:inline">Equipado</span>
                                                    <span className="sm:hidden">Activo</span>
                                                </span>
                                            ) : 'Equipar'}
                                        </Button>
                                    ) : (
                                        <div className="h-8 sm:h-10 flex items-center justify-center bg-bb-sidebar/30 rounded-lg sm:rounded-xl border border-bb-border mt-auto">
                                            <span className="text-[9px] sm:text-xs font-bold text-bb-text-secondary uppercase tracking-widest">
                                                {item.type === 'sticker' ? 'Consumible' : 'Coleccionable'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-16">
                    <Package className="w-20 h-20 mx-auto text-bb-text-secondary/50 mb-4" />
                    <h3 className="text-2xl font-bold text-bb-text mb-2">Tu inventario está vacío</h3>
                    <p className="text-bb-text-secondary mb-6">
                        Visita la tienda para comprar marcos y personalizar tu perfil
                    </p>
                    <Link href="/dashboard/store">
                        <Button
                            className="font-bold rounded-xl text-white text-lg px-8 py-3"
                            style={{ backgroundColor: colors?.primary }}
                        >
                            Explorar Tienda
                        </Button>
                    </Link>
                </div>
            )}
        </div>
    );
}
