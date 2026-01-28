'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, ShopItem } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';
import { useTheme } from '@/lib/theme-context';
import {
    Plus,
    X,
    RotateCcw,
    Maximize2,
    Minimize2,
    Trash2,
    Check,
    Palette,
    Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DecorationSettings {
    x: number;
    y: number;
    scale: number;
    rotate: number;
}

interface Decoration {
    id: string;
    item_id: string;
    placer_id: string;
    settings: DecorationSettings;
    shop_items: ShopItem;
}

interface StickerCanvasProps {
    targetType: 'profile' | 'professor';
    targetId: string;
    canEdit?: boolean;
}

export function StickerCanvas({ targetType, targetId, canEdit = false }: StickerCanvasProps) {
    const { profile } = useProfile();
    const { colors } = useTheme();
    const [decorations, setDecorations] = useState<Decoration[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [inventory, setInventory] = useState<ShopItem[]>([]);
    const [showInventory, setShowInventory] = useState(false);
    const [loading, setLoading] = useState(true);
    const canvasRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (targetId) {
            fetchDecorations();
        }
    }, [targetId]);

    const fetchDecorations = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('user_decorations')
            .select('*, shop_items(*)')
            .eq('target_type', targetType)
            .eq('target_id', targetId);

        if (!error && data) {
            setDecorations(data as any);
        }
        setLoading(false);
    };

    const fetchInventory = async () => {
        if (!profile?.id) return;

        const { data, error } = await supabase
            .from('user_inventory')
            .select('shop_items(*)')
            .eq('user_id', profile.id);

        if (!error && data) {
            const stickers = (data as any[])
                .map(d => d.shop_items)
                .filter(i => i && i.type === 'sticker') as ShopItem[];
            setInventory(stickers);
        }
    };

    const addSticker = async (item: ShopItem) => {
        if (!profile?.id) return;

        const newDecoration = {
            placer_id: profile.id,
            target_type: targetType,
            target_id: targetId,
            item_id: item.id,
            settings: { x: 50, y: 50, scale: 1, rotate: 0 }
        };

        const { data, error } = await supabase
            .from('user_decorations')
            .insert([newDecoration])
            .select('*, shop_items(*)')
            .single();

        if (!error && data) {
            setDecorations([...decorations, data as any]);
            setShowInventory(false);
        } else {
            alert('Error al añadir sticker: ' + (error?.message || 'Error desconocido'));
        }
    };

    const updateSticker = async (id: string, settings: DecorationSettings) => {
        // En un entorno productivo usaríamos debounce para no saturar Supabase
        const { error } = await supabase
            .from('user_decorations')
            .update({ settings })
            .eq('id', id);

        if (error) console.error('Error updating sticker:', error);
    };

    const deleteSticker = async (id: string) => {
        const { error } = await supabase
            .from('user_decorations')
            .delete()
            .eq('id', id);

        if (!error) {
            setDecorations(decorations.filter(d => d.id !== id));
        }
    };

    const handleToggleEdit = () => {
        if (!isEditing) {
            fetchInventory();
        }
        setIsEditing(!isEditing);
    };

    return (
        <div className="absolute inset-0 z-20 pointer-events-none" ref={canvasRef}>
            {/* Decoraciones */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {decorations.map((deco) => (
                    <StickerItem
                        key={deco.id}
                        decoration={deco}
                        isEditing={isEditing}
                        onUpdate={(settings) => updateSticker(deco.id, settings)}
                        onDelete={() => deleteSticker(deco.id)}
                        canvasRef={canvasRef}
                    />
                ))}
            </div>

            {/* Controles de Edición */}
            {(canEdit || targetType === 'professor') && (
                <div className="absolute bottom-4 right-4 pointer-events-auto flex flex-col gap-2 z-50">
                    <AnimatePresence>
                        {isEditing && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                className="flex flex-col gap-2"
                            >
                                <Button
                                    onClick={() => setShowInventory(true)}
                                    className="rounded-full shadow-lg bg-bb-sidebar hover:bg-bb-hover text-bb-text border border-bb-border"
                                    size="icon"
                                    title="Añadir Sticker"
                                >
                                    <Plus className="w-5 h-5 text-blue-400" />
                                </Button>

                                <Button
                                    onClick={handleToggleEdit}
                                    className="rounded-full shadow-xl bg-green-500 hover:bg-green-600 text-white"
                                    size="icon"
                                    title="Finalizar Edición"
                                >
                                    <Check className="w-5 h-5" />
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {!isEditing && (
                        <Button
                            onClick={handleToggleEdit}
                            className={`rounded-full shadow-xl text-white hover:scale-110 transition-transform ${isEditing ? 'opacity-0 pointer-events-none' : ''}`}
                            style={{ backgroundColor: colors?.primary }}
                            size="lg"
                        >
                            <Palette className="w-5 h-5 mr-2" />
                            Decorar
                        </Button>
                    )}
                </div>
            )}

            {/* Modal de Inventario de Stickers */}
            <AnimatePresence>
                {showInventory && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-bb-card border border-bb-border rounded-3xl p-6 w-full max-w-lg shadow-2xl relative"
                        >
                            <button
                                onClick={() => setShowInventory(false)}
                                className="absolute top-4 right-4 text-bb-text-secondary hover:text-bb-text transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>

                            <h3 className="text-xl font-bold text-bb-text flex items-center gap-3 mb-6">
                                <Package className="text-blue-400" /> Mis Stickers
                            </h3>

                            {inventory.length > 0 ? (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar pointer-events-auto">
                                    {inventory.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => addSticker(item)}
                                            className="group relative aspect-square bg-bb-sidebar/50 rounded-2xl p-2 border border-bb-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-all"
                                        >
                                            <img
                                                src={item.image_url || ''}
                                                alt={item.name}
                                                className="w-full h-full object-contain group-hover:scale-110 transition-transform"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-blue-500/10 rounded-2xl">
                                                <Plus className="text-blue-400" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 space-y-4">
                                    <div className="w-16 h-16 bg-bb-sidebar rounded-full flex items-center justify-center mx-auto text-bb-text-secondary">
                                        <Package className="w-8 h-8 opacity-20" />
                                    </div>
                                    <p className="text-bb-text-secondary">No tienes stickers en tu inventario.</p>
                                    <Button variant="ghost" className="text-blue-400" onClick={() => window.location.href = '/dashboard/store'}>
                                        Ir a la tienda
                                    </Button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function StickerItem({ decoration, isEditing, onUpdate, onDelete, canvasRef }: {
    decoration: Decoration;
    isEditing: boolean;
    onUpdate: (settings: DecorationSettings) => void;
    onDelete: () => void;
    canvasRef: React.RefObject<HTMLDivElement | null>;
}) {
    const [settings, setSettings] = useState(decoration.settings);
    const [isHovered, setIsHovered] = useState(false);

    const handleDragEnd = (event: any, info: any) => {
        if (!isEditing) return;

        const newSettings = { ...settings, x: settings.x + info.offset.x, y: settings.y + info.offset.y };
        setSettings(newSettings);
        onUpdate(newSettings);
    };

    const updateProp = (prop: keyof DecorationSettings, delta: number) => {
        const newSettings = { ...settings, [prop]: settings[prop] + delta };
        setSettings(newSettings);
        onUpdate(newSettings);
    };

    return (
        <motion.div
            drag={isEditing}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            initial={false}
            animate={{
                x: settings.x,
                y: settings.y,
                scale: settings.scale,
                rotate: settings.rotate
            }}
            transition={{ type: 'spring', damping: 20, stiffness: 300, mass: 0.5 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`absolute pointer-events-auto cursor-grab active:cursor-grabbing ${isEditing ? 'z-[60]' : 'z-10'}`}
            style={{
                touchAction: 'none',
                width: 120,
                height: 120,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            <img
                src={decoration.shop_items?.image_url || ''}
                alt="sticker"
                className="w-full h-full object-contain pointer-events-none select-none"
                draggable={false}
            />

            {/* Controles del Sticker (Solo en modo edición) */}
            <AnimatePresence>
                {isEditing && (isHovered || true) && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-bb-sidebar/95 backdrop-blur border border-bb-border p-1 rounded-full shadow-2xl z-50"
                    >
                        <button onClick={() => updateProp('rotate', -15)} className="p-1.5 hover:bg-bb-hover rounded-full text-bb-text transition-colors" title="Rotar Izquierda">
                            <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => updateProp('scale', -0.1)} className="p-1.5 hover:bg-bb-hover rounded-full text-bb-text transition-colors" title="Achicar">
                            <Minimize2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => updateProp('scale', 0.1)} className="p-1.5 hover:bg-bb-hover rounded-full text-bb-text transition-colors" title="Agrandar">
                            <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-[1px] h-4 bg-bb-border mx-1" />
                        <button onClick={onDelete} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-full transition-colors" title="Eliminar">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
