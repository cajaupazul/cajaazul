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
    Eye,
    X
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FrameEditor } from '@/components/admin/FrameEditor';
import { PLACEHOLDERS } from '@/lib/constants';
import Link from 'next/link';
import { removeSupabaseStorageUrl } from '@/lib/supabase-storage-cleanup';

function EditShopItemWrapper() {
    const { colors } = useTheme();
    const { profile } = useProfile();
    const router = useRouter();
    const searchParams = useSearchParams();
    const itemId = searchParams.get('id');

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [item, setItem] = useState<ShopItem | null>(null);

    // Form state
    const [form, setForm] = useState({
        name: '',
        description: '',
        type: 'profile_frame' as any,
        category_id: '',
        price_coins: 0,
        frame_key: '',
        is_active: true,
        max_uses: null as number | null,
        bundle_items: [] as string[]
    });
    const [categories, setCategories] = useState<ShopCategory[]>([]);
    const [allShopItems, setAllShopItems] = useState<any[]>([]);
    const [frameSettings, setFrameSettings] = useState<any>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [skipResize, setSkipResize] = useState(false);

    // Proteccion de ruta
    useEffect(() => {
        if (profile && profile.role !== 'admin' && profile.role !== 'superadmin') {
            router.push('/dashboard');
        }
    }, [profile, router]);

    useEffect(() => {
        if (itemId) {
            fetchItem();
            fetchCategories();
        } else if (itemId === null) {
            setLoading(false);
        }
    }, [itemId]);

    const fetchCategories = async () => {
        const { data: catData } = await supabase
            .from('shop_categories')
            .select('*')
            .order('display_order', { ascending: true });
        if (catData) setCategories(catData);

        const { data: itemData } = await supabase
            .from('shop_items')
            .select('id, name, type, is_active')
            .neq('id', itemId) // No seleccionarse a si mismo
            .order('created_at', { ascending: false });
        if (itemData) setAllShopItems(itemData);
    };

    const fetchItem = async () => {
        if (!itemId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('shop_items')
            .select('*')
            .eq('id', itemId)
            .single();

        if (!error && data) {
            setItem(data);
            setForm({
                name: data.name,
                description: data.description || '',
                type: data.type,
                category_id: data.category_id || '',
                price_coins: data.price_coins,
                frame_key: data.frame_key || '',
                is_active: data.is_active,
                max_uses: data.max_uses,
                bundle_items: data.bundle_items || []
            });
            setFrameSettings(data.frame_settings);
        } else {
            alert('No se pudo cargar el artículo');
            router.push('/admin/shop');
        }
        setLoading(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
                alert('Usa una imagen PNG, JPG, WebP o GIF.');
                e.target.value = '';
                return;
            }
            const maxBytes = file.type === 'image/gif' ? 6 * 1024 * 1024 : 12 * 1024 * 1024;
            if (file.size > maxBytes) {
                alert(file.type === 'image/gif' ? 'El GIF no puede superar 6 MB.' : 'La imagen no puede superar 12 MB.');
                e.target.value = '';
                return;
            }
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setSkipResize(file.type === 'image/gif');
        }
    };

    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!itemId) return;

        setIsSaving(true);
        let uploadedPath: string | null = null;
        let databaseSaved = false;
        try {
            let finalImageUrl = item?.image_url;

            // Si hay un archivo nuevo, subirlo antes de guardar
            if (selectedFile) {
                const { resizeImage } = await import('@/lib/image-utils');
                const imageBlob = await resizeImage(selectedFile, 512, skipResize);
                const extension = skipResize ? selectedFile.name.split('.').pop() : 'webp';
                // Añadimos "_update_" para no pisar el original u otra caché fácilmente
                const fileName = `catalog/${crypto.randomUUID()}-update-${form.frame_key}.${extension}`;
                uploadedPath = fileName;

                const { error: uploadError } = await supabase.storage
                    .from('profile-frames')
                    .upload(fileName, imageBlob, {
                        contentType: skipResize ? selectedFile.type : 'image/webp',
                        cacheControl: '31536000',
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('profile-frames')
                    .getPublicUrl(fileName);

                finalImageUrl = publicUrl;
            }

            const { error: dbError } = await supabase
                .from('shop_items')
                .update({
                    ...form,
                    category_id: form.category_id || null,
                    frame_settings: frameSettings,
                    ...(selectedFile ? { image_url: finalImageUrl } : {})
                })
                .eq('id', itemId);

            if (dbError) throw dbError;
            databaseSaved = true;

            if (selectedFile && item?.image_url && item.image_url !== finalImageUrl) {
                await removeSupabaseStorageUrl(supabase, 'profile-frames', item.image_url);
            }

            // Éxito
            router.push('/admin/shop');
            router.refresh();
        } catch (error: any) {
            if (!databaseSaved && uploadedPath) {
                await supabase.storage.from('profile-frames').remove([uploadedPath]).catch(console.error);
            }
            console.error('Error al actualizar item:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-bb-darker flex items-center justify-center">
                <RefreshCw className="w-10 h-10 text-blue-400 animate-spin" />
            </div>
        );
    }

    if (!itemId) {
        return (
            <div className="min-h-screen bg-bb-darker flex flex-col items-center justify-center p-8 text-center">
                <AlertCircle className="w-16 h-16 text-yellow-500 mb-4" />
                <h1 className="text-2xl font-bold text-bb-text">ID de artículo faltante</h1>
                <p className="text-bb-text-secondary mt-2">No se proporcionó un ID de artículo válido.</p>
                <Link href="/admin/shop" className="mt-6">
                    <Button>Volver a la tienda</Button>
                </Link>
            </div>
        );
    }

    if (!item || !profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
        return null;
    }

    return (
        <div className="min-h-screen bg-bb-darker p-4 sm:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/shop">
                            <Button variant="ghost" size="icon" className="rounded-full bg-bb-sidebar/50 hover:bg-bb-sidebar">
                                <ChevronLeft className="w-6 h-6" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-extrabold text-bb-text tracking-tight flex items-center gap-3 text-bb-text">
                                <RefreshCw className="text-blue-400" /> Editar: {item.name}
                            </h1>
                            <p className="text-bb-text-secondary">Modifica los parámetros y alineación del marco</p>
                        </div>
                    </div>
                    <Button
                        onClick={() => handleSave()}
                        className="font-bold h-12 px-8 rounded-xl shadow-lg hidden md:flex"
                        style={{ backgroundColor: colors?.primary }}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form Side */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-bb-card border border-bb-border rounded-3xl p-6 shadow-xl space-y-6">
                            <h2 className="font-bold text-lg flex items-center gap-2 border-b border-bb-border pb-4 text-bb-text">
                                <AlertCircle className="w-5 h-5 text-blue-400" /> Datos del Artículo
                            </h2>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nombre del Item</Label>
                                    <Input
                                        required
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        className="bg-bb-sidebar/30 border-bb-border h-11"
                                    />
                                </div>

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
                                                <SelectItem value="other">Otro / Pack Especial</SelectItem>
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

                                {/* Seleccionador de Bundle Items (Solo para Packs) */}
                                {form.type === 'other' && allShopItems.length > 0 && (
                                    <div className="space-y-3 pt-4 border-t border-bb-border bg-blue-500/5 p-4 rounded-xl">
                                        <h3 className="font-bold text-sm text-blue-400 flex items-center gap-2">
                                            📦 Configuración de Pack
                                        </h3>
                                        <p className="text-[10px] text-bb-text-secondary">
                                            Selecciona los artículos que el usuario recibirá automáticamente al comprar este pack.
                                        </p>
                                        <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                            {allShopItems.map((item: any) => (
                                                <label key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer border border-transparent hover:border-white/10 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded bg-bb-darker border-bb-border accent-blue-500"
                                                        checked={form.bundle_items.includes(item.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setForm(prev => ({ ...prev, bundle_items: [...prev.bundle_items, item.id] }));
                                                            } else {
                                                                setForm(prev => ({ ...prev, bundle_items: prev.bundle_items.filter(id => id !== item.id) }));
                                                            }
                                                        }}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-bold text-white truncate">{item.name}</div>
                                                        <div className="text-[9px] text-zinc-500 uppercase tracking-wider">{item.type.replace('_', ' ')} • ID: {item.id.slice(0, 8)}</div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2 pt-2 border-t border-bb-border">
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
                                            min="0"
                                            step="1"
                                            value={form.price_coins}
                                            onChange={e => {
                                                const val = parseInt(e.target.value);
                                                setForm({ ...form, price_coins: isNaN(val) ? 0 : val });
                                            }}
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
                                <div className="space-y-4 pt-2 border-t border-bb-border">
                                    <div className="space-y-2">
                                        <Label>Cantidad de Usos</Label>
                                        <Select
                                            value={form.max_uses === null ? 'forever' : form.max_uses.toString()}
                                            onValueChange={(value) => setForm({ ...form, max_uses: value === 'forever' ? null : parseInt(value) })}
                                        >
                                            <SelectTrigger className="w-full bg-bb-sidebar/30 border-bb-border h-11">
                                                <SelectValue placeholder="Seleccionar límite" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="forever">Para siempre (Infinito)</SelectItem>
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                                    <SelectItem key={n} value={n.toString()}>{n} {n === 1 ? 'uso' : 'usos'}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[10px] text-bb-text-secondary italic">Ideal para stickers que se consumen al usarlos.</p>
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

                        {/* Image Upload Area */}
                        <div className="bg-bb-card border border-bb-border rounded-3xl p-6 shadow-xl space-y-4">
                            <h2 className="font-bold text-lg border-b border-bb-border pb-4 text-bb-text">Imagen del Artículo</h2>
                            <div className="flex flex-col items-center justify-center border-2 border-dashed border-bb-border rounded-2xl p-8 bg-bb-sidebar/20 hover:bg-bb-sidebar/30 transition-all cursor-pointer relative">
                                {previewUrl || item.image_url ? (
                                    <div className="relative group">
                                        <img src={previewUrl || item.image_url || PLACEHOLDERS.ITEM} className="w-48 h-48 object-contain rounded-xl shadow-2xl" alt="Preview" />
                                        {previewUrl && (
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                                                className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-2 shadow-lg hover:scale-110 transition-transform z-10"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                        {/* Overlay para subir nueva si ya hay una */}
                                        <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center cursor-pointer">
                                            <div className="text-white font-bold text-sm bg-black/50 px-3 py-1.5 rounded-lg backdrop-blur-sm">Cambiar Imagen</div>
                                            <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleFileChange} />
                                        </label>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center gap-3 cursor-pointer w-full">
                                        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                            <ImageIcon className="w-8 h-8" />
                                        </div>
                                        <div className="text-center text-bb-text">
                                            <p className="font-bold">Haz clic para subir nueva imagen</p>
                                            <p className="text-xs text-bb-text-secondary mt-1">Reemplazará la actual (PNG, GIF, WebP)</p>
                                        </div>
                                        <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleFileChange} />
                                    </label>
                                )}
                            </div>

                            {/* Optimization Option */}
                            <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-2xl space-y-3 mt-4">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="skip_resize"
                                        checked={skipResize}
                                        onChange={(e) => setSkipResize(e.target.checked)}
                                        className="w-5 h-5 accent-blue-500"
                                    />
                                    <Label htmlFor="skip_resize" className="text-sm font-bold flex flex-col cursor-pointer text-bb-text">
                                        Preservar Animación (Saltar Optimizador)
                                        <span className="text-[10px] font-normal text-bb-text-secondary mt-1">Usa esto si subes un GIF animado para la nueva imagen.</span>
                                    </Label>
                                </div>
                            </div>
                        </div>
                    </div >

                    {/* Preview / Adjust Side */}
                    < div className="lg:col-span-2" >
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
                                        frameImageUrl={previewUrl || item.image_url || PLACEHOLDERS.ITEM}
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

                {/* Mobile Save Button */}
                < div className="md:hidden pt-4" >
                    <Button
                        onClick={() => handleSave()}
                        className="font-bold w-full h-14 rounded-2xl shadow-xl flex items-center justify-center gap-3"
                        style={{ backgroundColor: colors?.primary }}
                        disabled={isSaving}
                    >
                        <Save className="w-5 h-5" />
                        {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                </div >
            </div >
        </div >
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
