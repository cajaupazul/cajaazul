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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {inventory.map((invItem) => {
                        const item = invItem.shop_items;
                        if (!item) return null;

                        const isEquipped = invItem.is_equipped;
                        const isLoading = equipLoading === invItem.id;

                        return (
                            <div
                                key={invItem.id}
                                className={`relative rounded-2xl border bg-bb-card p-6 transition-all hover:shadow-lg ${isEquipped ? 'ring-2 ring-blue-500 shadow-blue-500/20' : 'border-bb-border'
                                    }`}
                            >
                                {/* Equipped Badge */}
                                {isEquipped && (
                                    <div className="absolute top-3 right-3 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-pulse z-30">
                                        <Zap size={14} />
                                        Equipado
                                    </div>
                                )}

                                <div className="w-full aspect-square rounded-xl overflow-hidden bg-bb-sidebar flex items-center justify-center relative mb-4">
                                    {/* Dummy Avatar behind for context */}
                                    <div className="w-24 h-24 rounded-full bg-bb-dark flex items-center justify-center border border-bb-border overflow-hidden opacity-50">
                                        <div className="w-full h-full bg-gradient-to-br from-bb-sidebar to-bb-dark" />
                                    </div>

                                    {item.image_url ? (
                                        <img
                                            src={item.image_url}
                                            alt={item.name}
                                            className="w-full h-full object-contain absolute inset-0 z-10"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-24 h-24 rounded-full border-4 border-bb-border absolute inset-0 m-auto">
                                            <div className="w-full h-full rounded-full bg-bb-text-secondary/20" />
                                        </div>
                                    )}
                                </div>

                                {/* Item Info */}
                                <div className="space-y-3">
                                    <div>
                                        <h3 className="text-xl font-bold text-bb-text">{item.name}</h3>
                                        <p className="text-sm text-bb-text-secondary line-clamp-2">{item.description}</p>
                                    </div>

                                    {/* Equip Button */}
                                    <Button
                                        onClick={() => handleEquipFrame(invItem.item_id, item.name)}
                                        disabled={isEquipped || isLoading}
                                        className={`w-full font-bold rounded-xl ${isEquipped
                                            ? 'bg-bb-hover text-bb-text-secondary cursor-not-allowed'
                                            : 'text-white hover:opacity-90'
                                            }`}
                                        style={!isEquipped && !isLoading ? { backgroundColor: colors?.primary } : undefined}
                                    >
                                        {isLoading ? 'Equipando...' : isEquipped ? (
                                            <span className="flex items-center gap-2 justify-center">
                                                <Check size={16} />
                                                Activo
                                            </span>
                                        ) : 'Equipar'}
                                    </Button>
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
