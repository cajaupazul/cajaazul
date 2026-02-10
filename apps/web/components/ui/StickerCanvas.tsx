'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, ShopItem } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';
import { useTheme } from '@/lib/theme-context';
import {
    Plus,
    X,
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

// Responsive base size for stickers
function useResponsiveBase() {
    const [base, setBase] = useState(120);
    useEffect(() => {
        const calc = () => {
            const w = window.innerWidth;
            if (w < 640) setBase(66);
            else if (w < 1024) setBase(90);
            else setBase(120);
        };
        calc();
        window.addEventListener('resize', calc);
        return () => window.removeEventListener('resize', calc);
    }, []);
    return base;
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
    const baseSize = useResponsiveBase();

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
            {/* Decorations */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {decorations.map((deco) => (
                    <StickerItem
                        key={deco.id}
                        decoration={deco}
                        isEditing={isEditing}
                        onUpdate={(settings) => updateSticker(deco.id, settings)}
                        onDelete={() => deleteSticker(deco.id)}
                        canvasRef={canvasRef}
                        baseSize={baseSize}
                    />
                ))}
            </div>

            {/* Edit Controls — top-right, icon-only */}
            {(canEdit || targetType === 'professor') && (
                <div className="absolute top-4 right-4 pointer-events-auto flex flex-col gap-2 z-50">
                    <AnimatePresence>
                        {isEditing && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex flex-col gap-2"
                            >
                                <Button
                                    onClick={() => setShowInventory(true)}
                                    className="rounded-full shadow-lg bg-bb-sidebar hover:bg-bb-hover text-bb-text border border-bb-border h-10 w-10"
                                    size="icon"
                                    title="Añadir Sticker"
                                >
                                    <Plus className="w-5 h-5 text-blue-400" />
                                </Button>

                                <Button
                                    onClick={handleToggleEdit}
                                    className="rounded-full shadow-xl bg-green-500 hover:bg-green-600 text-white h-10 w-10"
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
                            className="rounded-full shadow-xl text-white hover:scale-110 transition-transform h-10 w-10"
                            style={{ backgroundColor: colors?.primary }}
                            size="icon"
                            title="Decorar"
                        >
                            <Palette className="w-5 h-5" />
                        </Button>
                    )}
                </div>
            )}

            {/* Sticker Inventory Modal */}
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

// ─── StickerItem with gesture-based manipulation ───────────────────────────

function StickerItem({ decoration, isEditing, onUpdate, onDelete, canvasRef, baseSize }: {
    decoration: Decoration;
    isEditing: boolean;
    onUpdate: (settings: DecorationSettings) => void;
    onDelete: () => void;
    canvasRef: React.RefObject<HTMLDivElement | null>;
    baseSize: number;
}) {
    const [settings, setSettings] = useState(decoration.settings);
    const stickerRef = useRef<HTMLDivElement>(null);
    const rotateHandleRef = useRef<HTMLDivElement>(null);
    const resizeHandleRef = useRef<HTMLDivElement>(null);

    // Keep settings in sync if decoration changes externally
    useEffect(() => {
        setSettings(decoration.settings);
    }, [decoration.settings]);

    // Debounced save to DB
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const saveSettings = useCallback((newSettings: DecorationSettings) => {
        setSettings(newSettings);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => onUpdate(newSettings), 300);
    }, [onUpdate]);

    // ── Drag to move ──
    const handleDragEnd = (event: any, info: any) => {
        if (!isEditing) return;
        const newSettings = { ...settings, x: settings.x + info.offset.x, y: settings.y + info.offset.y };
        saveSettings(newSettings);
    };

    // ── Mouse drag for rotation handle ──
    useEffect(() => {
        if (!isEditing) return;
        const handle = rotateHandleRef.current;
        const sticker = stickerRef.current;
        if (!handle || !sticker) return;

        let active = false;
        let startAngle = 0;

        const getCenter = () => {
            const rect = sticker.getBoundingClientRect();
            return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
        };

        const onPointerDown = (e: PointerEvent) => {
            e.preventDefault();
            e.stopPropagation();
            active = true;
            handle.setPointerCapture(e.pointerId);
            const { cx, cy } = getCenter();
            startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI) - settings.rotate;
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!active) return;
            const { cx, cy } = getCenter();
            const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
            const newRotate = angle - startAngle;
            saveSettings({ ...settings, rotate: Math.round(newRotate) });
        };

        const onPointerUp = () => { active = false; };

        handle.addEventListener('pointerdown', onPointerDown);
        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', onPointerUp);
        handle.addEventListener('pointercancel', onPointerUp);

        return () => {
            handle.removeEventListener('pointerdown', onPointerDown);
            handle.removeEventListener('pointermove', onPointerMove);
            handle.removeEventListener('pointerup', onPointerUp);
            handle.removeEventListener('pointercancel', onPointerUp);
        };
    }, [isEditing, settings, saveSettings]);

    // ── Mouse drag for resize handle ──
    useEffect(() => {
        if (!isEditing) return;
        const handle = resizeHandleRef.current;
        const sticker = stickerRef.current;
        if (!handle || !sticker) return;

        let active = false;
        let startDist = 0;
        let startScale = 1;

        const getCenter = () => {
            const rect = sticker.getBoundingClientRect();
            return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
        };

        const onPointerDown = (e: PointerEvent) => {
            e.preventDefault();
            e.stopPropagation();
            active = true;
            handle.setPointerCapture(e.pointerId);
            const { cx, cy } = getCenter();
            startDist = Math.hypot(e.clientX - cx, e.clientY - cy);
            startScale = settings.scale;
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!active) return;
            const { cx, cy } = getCenter();
            const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
            const ratio = dist / startDist;
            const newScale = Math.max(0.3, Math.min(3, startScale * ratio));
            saveSettings({ ...settings, scale: Math.round(newScale * 100) / 100 });
        };

        const onPointerUp = () => { active = false; };

        handle.addEventListener('pointerdown', onPointerDown);
        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', onPointerUp);
        handle.addEventListener('pointercancel', onPointerUp);

        return () => {
            handle.removeEventListener('pointerdown', onPointerDown);
            handle.removeEventListener('pointermove', onPointerMove);
            handle.removeEventListener('pointerup', onPointerUp);
            handle.removeEventListener('pointercancel', onPointerUp);
        };
    }, [isEditing, settings, saveSettings]);

    // ── Pinch-to-zoom + two-finger rotate (mobile) ──
    useEffect(() => {
        if (!isEditing) return;
        const el = stickerRef.current;
        if (!el) return;

        let initialDist = 0;
        let initialAngle = 0;
        let initialScale = 1;
        let initialRotate = 0;

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const dx = e.touches[1].clientX - e.touches[0].clientX;
                const dy = e.touches[1].clientY - e.touches[0].clientY;
                initialDist = Math.hypot(dx, dy);
                initialAngle = Math.atan2(dy, dx) * (180 / Math.PI);
                initialScale = settings.scale;
                initialRotate = settings.rotate;
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const dx = e.touches[1].clientX - e.touches[0].clientX;
                const dy = e.touches[1].clientY - e.touches[0].clientY;
                const dist = Math.hypot(dx, dy);
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);

                const scaleRatio = dist / initialDist;
                const newScale = Math.max(0.3, Math.min(3, initialScale * scaleRatio));
                const newRotate = initialRotate + (angle - initialAngle);

                saveSettings({
                    ...settings,
                    scale: Math.round(newScale * 100) / 100,
                    rotate: Math.round(newRotate)
                });
            }
        };

        el.addEventListener('touchstart', onTouchStart, { passive: false });
        el.addEventListener('touchmove', onTouchMove, { passive: false });

        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
        };
    }, [isEditing, settings, saveSettings]);

    const visualSize = baseSize * settings.scale;

    return (
        <motion.div
            ref={stickerRef}
            drag={isEditing}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            initial={false}
            animate={{
                x: settings.x,
                y: settings.y,
                rotate: settings.rotate
            }}
            transition={{ type: 'spring', damping: 20, stiffness: 300, mass: 0.5 }}
            className={`absolute pointer-events-auto ${isEditing ? 'cursor-grab active:cursor-grabbing z-[60]' : 'z-10'}`}
            style={{
                touchAction: 'none',
                width: visualSize,
                height: visualSize,
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

            {/* Editing controls */}
            <AnimatePresence>
                {isEditing && (
                    <>
                        {/* Dashed border to show selection */}
                        <div className="absolute inset-0 border-2 border-dashed border-blue-400/50 rounded-xl pointer-events-none" />

                        {/* Delete button — top right */}
                        <motion.button
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            onClick={(e) => { e.stopPropagation(); onDelete(); }}
                            className="absolute -top-3 -right-3 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg z-50 transition-colors"
                            title="Eliminar"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </motion.button>

                        {/* Rotate handle — bottom right */}
                        <div
                            ref={rotateHandleRef}
                            className="absolute -bottom-3 -right-3 w-7 h-7 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing z-50 transition-colors select-none"
                            title="Arrastrar para rotar"
                            style={{ touchAction: 'none' }}
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                                <path d="M21 3v5h-5" />
                            </svg>
                        </div>

                        {/* Resize handle — bottom left */}
                        <div
                            ref={resizeHandleRef}
                            className="absolute -bottom-3 -left-3 w-7 h-7 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-lg cursor-nwse-resize z-50 transition-colors select-none"
                            title="Arrastrar para redimensionar"
                            style={{ touchAction: 'none' }}
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 3h6v6" />
                                <path d="M9 21H3v-6" />
                                <path d="M21 3L14 10" />
                                <path d="M3 21l7-7" />
                            </svg>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
