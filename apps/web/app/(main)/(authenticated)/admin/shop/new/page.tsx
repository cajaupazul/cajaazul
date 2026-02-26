'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { supabase, ShopCategory } from '@/lib/supabase';
import { getPublicFileUrl } from '@/lib/r2-storage';
import { resizeImage } from '@/lib/image-utils';
import {
    Plus,
    Trash2,
    Save,
    Image as ImageIcon,
    ShieldCheck,
    RefreshCw,
    X,
    ChevronLeft,
    Sparkles,
    AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FrameEditor } from '@/components/admin/FrameEditor';
import { PLACEHOLDERS } from '@/lib/constants';
import Link from 'next/link';

export default function NewShopItemPage() {
    const { colors } = useTheme();
    const { profile } = useProfile();
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);

    // Form state
    const [form, setForm] = useState({
        name: '',
        description: '',
        type: 'profile_frame' as any,
        category_id: '',
        price_coins: 0,
        frame_key: '',
        is_active: true
    });
    const [categories, setCategories] = useState<ShopCategory[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [skipResize, setSkipResize] = useState(false);
    const [frameSettings, setFrameSettings] = useState<any>(null);

    // Proteccion de ruta
    useEffect(() => {
        if (profile && profile.role !== 'admin' && profile.role !== 'superadmin') {
            router.push('/dashboard');
        }
        fetchCategories();
    }, [profile, router]);

    const fetchCategories = async () => {
        const { data } = await supabase
            .from('shop_categories')
            .select('*')
            .order('display_order', { ascending: true });
        if (data) setCategories(data);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));

            // Auto detect if it's animated to suggest skipping resize
            if (file.type === 'image/gif' || file.name.endsWith('.gif') || file.type === 'image/webp') {
                // We can't be 100% sure if WebP is animated without parsing, 
                // but if the user says WebP is not animating, they will likely check this.
                // For now, let's just make the option visible.
            }
        }
    };

    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (!selectedFile || !form.frame_key) {
            alert('Por favor selecciona una imagen y define un frame_key único');
            return;
        }

        setIsSaving(true);
        try {
            // 1. Procesar imagen
            const imageBlob = await resizeImage(selectedFile, 512, skipResize);
            const extension = skipResize ? selectedFile.name.split('.').pop() : 'webp';
            const fileName = `${Date.now()}_${form.frame_key}.${extension}`;

            // 2. Subir a Storage
            const { error: uploadError } = await supabase.storage
                .from('profile-frames')
                .upload(fileName, imageBlob, {
                    contentType: skipResize ? selectedFile.type : 'image/webp',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // 3. Obtener URL pública
            const { data: { publicUrl } } = supabase.storage
                .from('profile-frames')
                .getPublicUrl(fileName);

            // 4. Insertar en base de datos
            const { error: dbError } = await supabase
                .from('shop_items')
                .insert([{
                    ...form,
                    category_id: form.category_id || null,
                    image_url: publicUrl,
                    frame_settings: frameSettings
                }]);

            if (dbError) throw dbError;

            // Éxito
            router.push('/admin/shop');
            router.refresh();
        } catch (error: any) {
            console.error('Error al crear item:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
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
                            <h1 className="text-3xl font-extrabold text-bb-text tracking-tight flex items-center gap-3">
                                <Plus className="text-blue-400" /> Nuevo Marco
                            </h1>
                            <p className="text-bb-text-secondary">Configuración detallada del artículo</p>
                        </div>
                    </div>
                    <Button
                        onClick={() => handleSave()}
                        className="font-bold h-12 px-8 rounded-xl shadow-lg hidden md:flex"
                        style={{ backgroundColor: colors?.primary }}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Guardando...' : 'Crear Artículo'}
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form Side */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-bb-card border border-bb-border rounded-3xl p-6 shadow-xl space-y-6">
                            <h2 className="font-bold text-lg flex items-center gap-2 border-b border-bb-border pb-4">
                                <AlertCircle className="w-5 h-5 text-blue-400" /> Información Básica
                            </h2>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nombre del Item</Label>
                                    <Input
                                        required
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        className="bg-bb-sidebar/30 border-bb-border h-11"
                                        placeholder="Ej: Marco de Fuego"
                                    />
                                </div>
                                <div className="space-y-4 pt-2 border-t border-bb-border">
                                    <div className="space-y-2">
                                        <Label>Tipo de Artículo</Label>
                                        <select
                                            value={form.type}
                                            onChange={e => setForm({ ...form, type: e.target.value })}
                                            className="w-full bg-bb-sidebar/30 border-bb-border h-11 rounded-md px-3 text-sm"
                                        >
                                            <option value="profile_frame">Marco de Perfil</option>
                                            <option value="background">Fondo</option>
                                            <option value="badge">Insignia</option>
                                            <option value="sticker">Sticker (Decoración)</option>
                                            <option value="other">Otro</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Sección / Categoría</Label>
                                        <select
                                            value={form.category_id}
                                            onChange={e => setForm({ ...form, category_id: e.target.value })}
                                            className="w-full bg-bb-sidebar/30 border-bb-border h-11 rounded-md px-3 text-sm"
                                        >
                                            <option value="">Sin categoría</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Frame Key (Identificador único)</Label>
                                    <Input
                                        required
                                        value={form.frame_key}
                                        onChange={e => setForm({ ...form, frame_key: e.target.value })}
                                        className="bg-bb-sidebar/30 border-bb-border h-11"
                                        placeholder="ej: frame_fire_01"
                                    />
                                    <p className="text-[10px] text-bb-text-secondary italic">Si no es un marco, puedes dejarlo vacío.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Precio (Monedas)</Label>
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
                                        placeholder="Describe el marco..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Image Upload Area */}
                        <div className="bg-bb-card border border-bb-border rounded-3xl p-6 shadow-xl space-y-4">
                            <h2 className="font-bold text-lg border-b border-bb-border pb-4">Imagen del Marco</h2>
                            <div className="flex flex-col items-center justify-center border-2 border-dashed border-bb-border rounded-2xl p-8 bg-bb-sidebar/20 hover:bg-bb-sidebar/30 transition-all cursor-pointer relative">
                                {previewUrl ? (
                                    <div className="relative group">
                                        <img src={previewUrl || PLACEHOLDERS.ITEM} className="w-48 h-48 object-contain rounded-xl shadow-2xl" alt="Preview" />
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                                            className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-2 shadow-lg hover:scale-110 transition-transform"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center gap-3 cursor-pointer w-full">
                                        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                            <ImageIcon className="w-8 h-8" />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-bold text-bb-text">Haz clic para subir</p>
                                            <p className="text-xs text-bb-text-secondary mt-1">Soporta PNG, GIF, WebP</p>
                                        </div>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                    </label>
                                )}
                            </div>

                            {/* Optimization Option */}
                            <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-2xl space-y-3">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="skip_resize"
                                        checked={skipResize}
                                        onChange={(e) => setSkipResize(e.target.checked)}
                                        className="w-5 h-5 accent-blue-500"
                                    />
                                    <Label htmlFor="skip_resize" className="text-sm font-bold flex flex-col cursor-pointer">
                                        Preservar Animación (Saltar Opitimizador)
                                        <span className="text-[10px] font-normal text-bb-text-secondary">Usa esto si subes un GIF o WebP animado.</span>
                                    </Label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preview / Adjust Side */}
                    <div className="lg:col-span-2">
                        {previewUrl ? (
                            <div className="bg-bb-card border border-bb-border rounded-3xl p-6 sm:p-8 shadow-xl space-y-8 h-full">
                                {form.type === 'profile_frame' ? (
                                    <>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-bb-border pb-6">
                                            <h2 className="font-bold text-2xl flex items-center gap-3">
                                                <Sparkles className="text-yellow-400 w-6 h-6" /> Ajuste Visual Real-Time
                                            </h2>
                                            <p className="text-xs bg-bb-darker px-3 py-1.5 rounded-full text-bb-text-secondary">
                                                Los cambios se aplicarán al crear el item
                                            </p>
                                        </div>

                                        <FrameEditor
                                            frameImageUrl={previewUrl}
                                            onSave={(settings) => setFrameSettings(settings)}
                                        // Removemos el botón de guardar interno del editor si queremos que el principal mande
                                        // De hecho FrameEditor tiene su propio botòn, lo dejaremos pero FrameEditor nos dará los settings
                                        />

                                        <div className="bg-yellow-500/5 border border-yellow-500/10 p-5 rounded-2xl flex gap-4">
                                            <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                                                <RefreshCw className="text-yellow-500 w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-yellow-500 text-sm">¿Cómo ajustar?</p>
                                                <p className="text-xs text-bb-text-secondary mt-1 leading-relaxed">
                                                    Mueve los deslizadores para alinear el marco con el avatar.
                                                    No olvides pulsar <strong>"Guardar Ajustes"</strong> en el editor verde arriba antes de crear el artículo para confirmar las dimensiones.
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                                        <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                                            <ShieldCheck className="w-10 h-10" />
                                        </div>
                                        <div className="max-w-sm">
                                            <h3 className="font-bold text-xl text-bb-text">Sin Ajuste Visual</h3>
                                            <p className="text-bb-text-secondary mt-2">
                                                Los artículos de tipo <strong>{form.type === 'badge' ? 'Insignia' : form.type === 'sticker' ? 'Sticker' : 'Otro'}</strong> no requieren alineación con el avatar.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-bb-card border border-bb-border rounded-3xl p-8 shadow-xl h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                                <div className="w-20 h-20 rounded-full bg-bb-sidebar/50 flex items-center justify-center">
                                    <ImageIcon className="w-10 h-10 text-bb-text-secondary" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl text-bb-text">Esperando Imagen</h3>
                                    <p className="text-bb-text-secondary max-w-xs mx-auto mt-2">
                                        Sube un archivo para poder realizar los ajustes visuales y ver el resultado en tiempo real.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mobile Save Button */}
                <div className="md:hidden pt-4">
                    <Button
                        onClick={() => handleSave()}
                        className="font-bold w-full h-14 rounded-2xl shadow-xl flex items-center justify-center gap-3"
                        style={{ backgroundColor: colors?.primary }}
                        disabled={isSaving}
                    >
                        <Save className="w-5 h-5" />
                        {isSaving ? 'Guardando...' : 'Crear Artículo'}
                    </Button>
                </div>
            </div>
        </div>
    );
}


