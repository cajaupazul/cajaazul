'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { supabase, ShopItem, ShopCategory } from '@/lib/supabase';
import {
    Save,
    Trash2,
    Image as ImageIcon,
    ShieldCheck,
    RefreshCw,
    ChevronLeft,
    Sparkles,
    AlertCircle,
    Eye
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

// ... existing imports

    // ... inside component

                                <div className="space-y-4 pt-2 border-t border-bb-border">
                                    <div className="space-y-2">
                                        <Label>Tipo de Artículo</Label>
                                        <Select
                                            value={form.type}
                                            onValueChange={(value) => setForm({ ...form, type: value })}
                                        >
                                            <SelectTrigger className="w-full bg-bb-sidebar/30 border-bb-border h-11">
                                                <SelectValue placeholder="Seleccionar tipo" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="profile_frame">Marco de Perfil</SelectItem>
                                                <SelectItem value="background">Fondo</SelectItem>
                                                <SelectItem value="badge">Insignia</SelectItem>
                                                <SelectItem value="sticker">Sticker (Decoración)</SelectItem>
                                                <SelectItem value="other">Otro</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Sección / Categoría</Label>
                                        <Select
                                            value={form.category_id}
                                            onValueChange={(value) => setForm({ ...form, category_id: value })}
                                        >
                                            <SelectTrigger className="w-full bg-bb-sidebar/30 border-bb-border h-11">
                                                <SelectValue placeholder="Seleccionar categoría" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Sin categoría</SelectItem>
                                                {categories.map(cat => (
                                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Frame Key (No se recomienda cambiar)</Label>
                                    <Input
                                        required
                                        value={form.frame_key}
                                        onChange={e => setForm({ ...form, frame_key: e.target.value })}
                                        className="bg-bb-sidebar/30 border-bb-border h-11"
                                    />
                                    <p className="text-[10px] text-bb-text-secondary italic">Si no es un marco, puedes dejarlo vacío.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Precio</Label>
                                        <Input
                                            required
                                            type="number"
                                            value={form.price_coins}
                                            onChange={e => setForm({ ...form, price_coins: parseInt(e.target.value) })}
                                            className="bg-bb-sidebar/30 border-bb-border h-11"
                                        />
                                    </div>
                                    <div className="flex items-center space-x-2 pt-8">
                                        <input
                                            type="checkbox"
                                            id="is_active"
                                            checked={form.is_active}
                                            onChange={e => setForm({ ...form, is_active: e.target.checked })}
                                            className="w-5 h-5 rounded-lg border-bb-border bg-bb-sidebar/30 accent-blue-500"
                                        />
                                        <Label htmlFor="is_active" className="cursor-pointer">Activo</Label>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Descripción</Label>
                                    <Textarea
                                        value={form.description}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                        className="bg-bb-sidebar/30 border-bb-border min-h-[100px]"
                                    />
                                </div>
                            </div >
                        </div >

    {/* Image Preview Card */ }
    < div className = "bg-bb-card border border-bb-border rounded-3xl p-6 shadow-xl space-y-4" >
                            <h2 className="font-bold text-lg border-b border-bb-border pb-4 text-bb-text">Imagen Actual</h2>
                            <div className="flex flex-col items-center justify-center border border-bb-border rounded-2xl p-8 bg-bb-sidebar/20">
                                <img src={item.image_url || PLACEHOLDERS.ITEM} className="w-48 h-48 object-contain rounded-xl shadow-2xl" alt="Current" />
                                <div className="mt-4 flex items-center gap-2 text-[10px] text-bb-text-secondary font-mono">
                                    <ImageIcon className="w-3 h-3" /> URL: {item.image_url?.split('/').pop() || 'Sin URL'}
                                </div>
                            </div>
                            <p className="text-xs text-bb-text-secondary italic text-center">
                                * Para cambiar la imagen, elimina este item y crea uno nuevo.
                            </p>
                        </div >
                    </div >

    {/* Preview / Adjust Side */ }
    < div className = "lg:col-span-2" >
        <div className="bg-bb-card border border-bb-border rounded-3xl p-6 sm:p-8 shadow-xl space-y-8 h-full">
            {form.type === 'profile_frame' ? (
                <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-bb-border pb-6">
                        <h2 className="font-bold text-2xl flex items-center gap-3 text-bb-text">
                            <Sparkles className="text-yellow-400 w-6 h-6" /> Re-Ajustar Alineación
                        </h2>
                        <Button variant="ghost" size="sm" className="bg-bb-sidebar text-bb-text-secondary text-[10px]">
                            ID: {item.id.slice(0, 8)}...
                        </Button>
                    </div>

                    <FrameEditor
                        frameImageUrl={item.image_url || PLACEHOLDERS.ITEM}
                        initialSettings={frameSettings || undefined}
                        onSave={(settings) => setFrameSettings(settings)}
                    />

                    <div className="bg-blue-500/5 border border-blue-500/10 p-5 rounded-2xl flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                            <RefreshCw className="text-blue-500 w-5 h-5" />
                        </div>
                        <div>
                            <p className="font-bold text-blue-500 text-sm">¿Cómo funciona?</p>
                            <p className="text-xs text-bb-text-secondary mt-1 leading-relaxed">
                                Si cambiaste el nombre o precio, pero no el marco, asegúrate de que los ajustes visuales sigan siendo correctos.
                                No olvides pulsar <strong>"Guardar Ajustes"</strong> dentro del editor para actualizar la alineación.
                            </p>
                        </div>
                    </div>
                </>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
                    <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                        <ShieldCheck className="w-10 h-10" />
                    </div>
                    <div className="max-w-sm">
                        <h3 className="font-bold text-xl text-bb-text">Sin Ajuste Visual</h3>
                        <p className="text-bb-text-secondary mt-2">
                            Los artículos de tipo <strong>{form.type === 'badge' ? 'Insignia' : form.type === 'sticker' ? 'Sticker' : form.type === 'background' ? 'Fondo' : 'Otro'}</strong> no requieren alineación con el avatar.
                        </p>
                    </div>
                </div>
            )}
        </div>
                    </div >
                </div >

    {/* Mobile Save Button */ }
    < div className = "md:hidden pt-4" >
        <Button
            onClick={() => handleSave()}
            className="font-bold w-full h-14 rounded-2xl shadow-xl flex items-center justify-center gap-3"
            style={{ backgroundColor: colors?.primary }}
            disabled={isSaving}
        >
            <SaveIcon className="w-5 h-5" />
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
                </div >
            </div >
        </div >
    );
}

function SaveIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v13a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
        </svg>
    );
}

export default function EditShopItemPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-bb-darker flex items-center justify-center">
                <RefreshCw className="w-10 h-10 text-blue-400 animate-spin" />
            </div>
        }>
            <EditShopItemWrapper />
        </Suspense>
    );
}
