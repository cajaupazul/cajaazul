'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { supabase } from '@/lib/supabase';
import { resizeImage } from '@/lib/image-utils';
import {
    Plus,
    Save,
    Image as ImageIcon,
    RefreshCw,
    X,
    ChevronLeft,
    Sparkles,
    AlertCircle,
    Clock,
    Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PLACEHOLDERS } from '@/lib/constants';
import Link from 'next/link';

export default function NewVipFramePage() {
    const { colors } = useTheme();
    const { profile } = useProfile();
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);

    // Form state
    const [form, setForm] = useState({
        label: 'Marco Exclusivo',
        description: '',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        scale_factor: 1.4,
        offset_x: 0,
        offset_y: 0
    });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [skipResize, setSkipResize] = useState(false);

    // Proteccion de ruta
    useEffect(() => {
        if (profile && profile.role !== 'admin' && profile.role !== 'superadmin') {
            router.push('/dashboard/store');
        }
    }, [profile, router]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));

            if (file.type === 'image/gif' || file.name.endsWith('.gif') || file.type === 'image/webp') {
                setSkipResize(true); // Auto-suggest keeping animation for gifs
            }
        }
    };

    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (!selectedFile) {
            alert('Por favor selecciona una imagen para el marco exclusivo');
            return;
        }

        setIsSaving(true);
        try {
            // 1. Process Image
            const imageBlob = await resizeImage(selectedFile, 512, skipResize);
            const extension = skipResize ? selectedFile.name.split('.').pop() : 'webp';
            const fileName = `vip_frame_${Date.now()}.${extension}`;

            // 2. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('profile-frames') // Re-using profile-frames bucket
                .upload(fileName, imageBlob, {
                    contentType: skipResize ? selectedFile.type : 'image/webp',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // 3. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('profile-frames')
                .getPublicUrl(fileName);

            // 4. Update existing active frames
            await supabase.from('vip_exclusive_frames').update({ is_active: false }).eq('is_active', true);

            // 5. Insert to DB
            const { error: dbError } = await supabase
                .from('vip_exclusive_frames')
                .insert([{
                    image_url: publicUrl,
                    label: form.label,
                    description: form.description,
                    expires_at: new Date(form.expires_at).toISOString(),
                    scale_factor: form.scale_factor,
                    offset_x: form.offset_x,
                    offset_y: form.offset_y,
                    is_active: true
                }]);

            if (dbError) throw dbError;

            // Success
            router.push('/dashboard/store');
            router.refresh();
        } catch (error: any) {
            console.error('Error saving VIP frame:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
        return null; // or loading
    }

    return (
        <div className="min-h-screen bg-bb-darker p-4 sm:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/store">
                            <Button variant="ghost" size="icon" className="rounded-full bg-bb-sidebar/50 hover:bg-bb-sidebar">
                                <ChevronLeft className="w-6 h-6" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-[1000] text-amber-400 italic uppercase tracking-tighter flex items-center gap-3">
                                <Sparkles className="text-amber-400" /> Nuevo Marco VIP
                            </h1>
                            <p className="text-bb-text-secondary">Configuración del marco exclusivo temporal</p>
                        </div>
                    </div>
                    <Button
                        onClick={() => handleSave()}
                        className="font-[1000] uppercase italic tracking-wider h-12 px-8 rounded-xl shadow-[0_0_20px_rgba(251,191,36,0.3)] hidden md:flex"
                        style={{ backgroundColor: colors?.primary }}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Activando...' : 'Activar Marco Exclusivo'}
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form Side */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-bb-card border border-amber-500/20 rounded-3xl p-6 shadow-xl space-y-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full pointer-events-none" />

                            <h2 className="font-bold text-lg flex items-center gap-2 border-b border-bb-border pb-4 relative z-10 text-amber-100">
                                <AlertCircle className="w-5 h-5 text-amber-400" /> Información del Marco
                            </h2>

                            <div className="space-y-4 relative z-10">
                                <div className="space-y-2">
                                    <Label className="text-amber-400 uppercase text-[10px] tracking-widest font-black">Etiqueta</Label>
                                    <Input
                                        required
                                        value={form.label}
                                        onChange={e => setForm({ ...form, label: e.target.value })}
                                        className="bg-bb-sidebar/50 border-white/10 h-11 text-white font-bold"
                                        placeholder="Ej: MARCO LUNAR"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-amber-400 uppercase text-[10px] tracking-widest font-black">Límite de Tiempo</Label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                                            <Calendar className="w-4 h-4" />
                                        </div>
                                        <input
                                            type="datetime-local"
                                            required
                                            value={form.expires_at}
                                            onChange={e => setForm({ ...form, expires_at: e.target.value })}
                                            className="w-full pl-10 pr-4 bg-bb-sidebar/50 border border-white/10 rounded-max h-11 text-white text-sm [color-scheme:dark] rounded-md outline-none focus:border-amber-500 transition-colors"
                                        />
                                    </div>
                                    <p className="text-[10px] text-bb-text-secondary italic pl-1">El marco expirará automáticamente al pasar la fecha.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-amber-400 uppercase text-[10px] tracking-widest font-black">Descripción (Opcional)</Label>
                                    <Textarea
                                        value={form.description}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                        className="bg-bb-sidebar/50 border-white/10 min-h-[100px] text-white"
                                        placeholder="Descripción promocional corta..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Adjustments */}
                        <div className="bg-bb-card border border-amber-500/20 rounded-3xl p-6 shadow-xl space-y-6 relative overflow-hidden">
                            <h2 className="font-bold text-lg flex items-center gap-2 border-b border-bb-border pb-4 text-amber-100">
                                Ajustes de Alineación
                            </h2>
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-zinc-400 uppercase text-[10px] tracking-widest font-black">Escala del marco</Label>
                                        <span className="text-xs text-amber-500 font-bold">{form.scale_factor.toFixed(2)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.5" max="3.0" step="0.05"
                                        value={form.scale_factor}
                                        onChange={e => setForm({ ...form, scale_factor: parseFloat(e.target.value) })}
                                        className="w-full accent-amber-500"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label className="text-zinc-400 uppercase text-[10px] tracking-widest font-black">Pos X (Pixels)</Label>
                                            <span className="text-xs text-amber-500 font-bold">{form.offset_x}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="-100" max="100" step="1"
                                            value={form.offset_x}
                                            onChange={e => setForm({ ...form, offset_x: parseInt(e.target.value) })}
                                            className="w-full accent-amber-500"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label className="text-zinc-400 uppercase text-[10px] tracking-widest font-black">Pos Y (Pixels)</Label>
                                            <span className="text-xs text-amber-500 font-bold">{form.offset_y}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="-100" max="100" step="1"
                                            value={form.offset_y}
                                            onChange={e => setForm({ ...form, offset_y: parseInt(e.target.value) })}
                                            className="w-full accent-amber-500"
                                        />
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full text-xs"
                                    onClick={(e) => { e.preventDefault(); setForm({ ...form, scale_factor: 1.4, offset_x: 0, offset_y: 0 }); }}
                                >
                                    Resetear ajustes
                                </Button>
                            </div>
                        </div>

                        {/* Image Upload Area */}
                        <div className="bg-bb-card border border-bb-border rounded-3xl p-6 shadow-xl space-y-4">
                            <h2 className="font-bold text-lg border-b border-bb-border pb-4">Imagen del Marco</h2>
                            <div className="flex flex-col items-center justify-center border-2 border-dashed border-bb-border rounded-2xl p-8 bg-bb-sidebar/20 hover:bg-bb-sidebar/30 transition-all cursor-pointer relative">
                                {previewUrl ? (
                                    <div className="relative group">
                                        <img src={previewUrl} className="w-48 h-48 object-contain rounded-xl shadow-2xl" alt="Preview" />
                                        <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); setSelectedFile(null); setPreviewUrl(null); }}
                                            className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-2 shadow-lg hover:scale-110 transition-transform"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center gap-3 cursor-pointer w-full">
                                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                                            <ImageIcon className="w-8 h-8" />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-bold text-bb-text">Haz clic para subir</p>
                                            <p className="text-xs text-bb-text-secondary mt-1">Soporta PNG, GIF, WebP animado</p>
                                        </div>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                    </label>
                                )}
                            </div>

                            {/* Optimization Option */}
                            <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl space-y-3">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="skip_resize"
                                        checked={skipResize}
                                        onChange={(e) => setSkipResize(e.target.checked)}
                                        className="w-5 h-5 accent-amber-500"
                                    />
                                    <Label htmlFor="skip_resize" className="text-sm font-bold flex flex-col cursor-pointer">
                                        Preservar Animación (Saltar Optimizador)
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
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-bb-border pb-6">
                                    <h2 className="font-bold text-2xl flex items-center gap-3">
                                        <Sparkles className="text-amber-400 w-6 h-6 animate-pulse" /> Vista Previa del Marco VIP
                                    </h2>
                                    <p className="text-xs bg-bb-darker px-3 py-1.5 rounded-full text-bb-text-secondary italic">
                                        Se mostrará en la Tienda debajo de Origi
                                    </p>
                                </div>

                                <div className="flex items-center justify-center p-10 bg-black/40 rounded-2xl border border-white/5 shadow-inner">
                                    <div className="relative w-28 h-28 my-2">
                                        {/* Fallback avatar preview */}
                                        <div className="absolute inset-0 bg-zinc-800 rounded-full flex items-center justify-center border-2 border-zinc-700">
                                            <ImageIcon size={24} className="text-zinc-600" />
                                        </div>
                                        {/* Actual Frame Layer with live transformation */}
                                        <img
                                            src={previewUrl}
                                            alt="Preview"
                                            className="absolute top-1/2 left-1/2 w-[140%] h-[140%] object-contain drop-shadow-2xl z-10 pointer-events-none"
                                            style={{
                                                transform: `translate(calc(-50% + ${form.offset_x}px), calc(-50% + ${form.offset_y}px)) scale(${form.scale_factor})`,
                                                transformOrigin: 'center center'
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="bg-amber-500/5 border border-amber-500/10 p-5 rounded-2xl flex gap-4 mt-8">
                                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                                        <Clock className="text-amber-500 w-5 h-5 animate-pulse" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-amber-500 text-sm">Recordatorio</p>
                                        <p className="text-xs text-bb-text-secondary mt-1 leading-relaxed">
                                            El marco exclusivo se activará de inmediato para todos los usuarios VIP y estará disponible
                                            hasta la fecha límite. Al llegar la fecha, expirará automáticamente.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-bb-card border border-bb-border rounded-3xl p-8 shadow-xl h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50 relative overflow-hidden">
                                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                                <div className="w-24 h-24 rounded-full bg-bb-sidebar/50 flex items-center justify-center relative z-10 shadow-lg">
                                    <ImageIcon className="w-12 h-12 text-bb-text-secondary opacity-50" />
                                </div>
                                <div className="relative z-10">
                                    <h3 className="font-bold text-xl text-bb-text italic">Esperando Imagen</h3>
                                    <p className="text-bb-text-secondary max-w-xs mx-auto mt-2">
                                        Sube la imagen del marco exclusivo. Te mostraremos una simulación de cómo se verá envolviendo un avatar VIP.
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
                        className="font-bold w-full h-14 rounded-2xl shadow-xl flex items-center justify-center gap-3 font-[1000] uppercase italic tracking-wider"
                        style={{ backgroundColor: colors?.primary }}
                        disabled={isSaving}
                    >
                        <Save className="w-5 h-5" />
                        {isSaving ? 'Activando...' : 'Activar Marco Exclusivo'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
