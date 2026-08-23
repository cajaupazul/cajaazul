'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { useRouter } from 'next/navigation';
import {
    ChevronLeft,
    Upload,
    Image as ImageIcon,
    Check,
    AlertCircle,
    X,
    Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export default function NewFlowchartPage() {
    const { colors } = useTheme();
    const { profile } = useProfile();
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [faculty, setFaculty] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    useEffect(() => {
        if (profile && profile.role !== 'admin' && profile.role !== 'superadmin') {
            router.push('/dashboard');
        }
    }, [profile, router]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !name || !faculty) return;

        setLoading(true);
        let uploadedPath: string | null = null;
        try {
            // 1. Upload to storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            uploadedPath = fileName;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('flowcharts')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('flowcharts')
                .getPublicUrl(fileName);

            // 3. Save to DB
            const { error: dbError } = await supabase.from('flowcharts').insert({
                name,
                faculty,
                image_url: publicUrl
            });

            if (dbError) throw dbError;

            router.push('/admin/flowcharts');
            router.refresh();
        } catch (error: any) {
            if (uploadedPath) {
                await supabase.storage.from('flowcharts').remove([uploadedPath]).catch(console.error);
            }
            alert('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bb-darker p-4 sm:p-8">
            <div className="max-w-3xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/admin/flowcharts">
                        <Button variant="ghost" size="icon" className="rounded-full bg-bb-sidebar/50 hover:bg-bb-sidebar">
                            <ChevronLeft className="w-6 h-6" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-extrabold text-bb-text tracking-tight flex items-center gap-3">
                            <Upload className="text-blue-400" /> Nuevo Flujograma
                        </h1>
                        <p className="text-bb-text-secondary">Sube un mapa oficial en alta resolución</p>
                    </div>
                </div>

                <form onSubmit={handleUpload} className="space-y-6">
                    <div className="bg-bb-card border border-bb-border rounded-3xl p-6 sm:p-8 shadow-xl space-y-8 text-bb-text">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-bb-text font-bold ml-1">Nombre de la Carrera</Label>
                                    <Input
                                        id="name"
                                        placeholder="Ej: Administración de Empresas"
                                        required
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="bg-bb-sidebar/30 border-bb-border h-12 rounded-xl focus:ring-blue-500/20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="faculty" className="text-bb-text font-bold ml-1">Facultad</Label>
                                    <Input
                                        id="faculty"
                                        placeholder="Ej: Ciencias Empresariales"
                                        required
                                        value={faculty}
                                        onChange={e => setFaculty(e.target.value)}
                                        className="bg-bb-sidebar/30 border-bb-border h-12 rounded-xl focus:ring-blue-500/20"
                                    />
                                </div>
                            </div>

                            {/* Image Upload Area */}
                            <div className="space-y-2">
                                <Label className="text-bb-text font-bold ml-1">Imagen del Flujograma</Label>
                                <div
                                    className={`relative border-2 border-dashed rounded-3xl p-8 transition-all flex flex-col items-center justify-center min-h-[300px] overflow-hidden ${preview ? 'border-blue-500/50 bg-blue-500/5' : 'border-bb-border bg-bb-sidebar/20 hover:bg-bb-sidebar/40 hover:border-bb-text-secondary/50'
                                        }`}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const droppedFile = e.dataTransfer.files?.[0];
                                        if (droppedFile) {
                                            setFile(droppedFile);
                                            setPreview(URL.createObjectURL(droppedFile));
                                        }
                                    }}
                                >
                                    {preview ? (
                                        <div className="relative w-full h-full flex flex-col items-center">
                                            <img src={preview} alt="Preview" className="max-h-[300px] object-contain rounded-xl shadow-2xl mb-4" />
                                            <button
                                                type="button"
                                                onClick={() => { setFile(null); setPreview(null); }}
                                                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                            <div className="text-xs text-bb-text-secondary flex items-center gap-2">
                                                <Check className="w-4 h-4 text-green-500" /> {file?.name} ({(file?.size || 0) / 1024 / 1024 > 1 ? `${((file?.size || 0) / 1024 / 1024).toFixed(2)} MB` : `${((file?.size || 0) / 1024).toFixed(0)} KB`})
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="w-20 h-20 rounded-full bg-bb-sidebar/50 flex items-center justify-center mb-4">
                                                <ImageIcon className="w-10 h-10 text-bb-text-secondary" />
                                            </div>
                                            <p className="text-bb-text font-bold">Arrastra la imagen aquí</p>
                                            <p className="text-bb-text-secondary text-sm mt-1 mb-6 text-center">Recomendado: PNG o JPG de alta resolución</p>
                                            <Input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                id="file-upload"
                                                onChange={handleFileChange}
                                            />
                                            <Button
                                                type="button"
                                                onClick={() => document.getElementById('file-upload')?.click()}
                                                variant="outline"
                                                className="rounded-xl border-bb-border"
                                            >
                                                Seleccionar Archivo
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-500/5 border border-blue-500/10 p-5 rounded-2xl flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                <Sparkles className="text-blue-500 w-5 h-5" />
                            </div>
                            <div>
                                <p className="font-bold text-blue-500 text-sm">Consejo Profesional</p>
                                <p className="text-xs text-bb-text-secondary mt-1 leading-relaxed">
                                    Utiliza imágenes con textos legibles. El usuario podrá hacer zoom para pintar sobre cada curso individualmente.
                                    Una buena resolución (2000px+) asegurará una mejor experiencia.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4">
                        <Link href="/admin/flowcharts">
                            <Button type="button" variant="ghost" className="h-12 px-8 rounded-xl font-bold">Cancelar</Button>
                        </Link>
                        <Button
                            type="submit"
                            disabled={loading || !file || !name || !faculty}
                            className="h-12 px-10 rounded-xl font-bold shadow-xl shadow-blue-500/10 disabled:opacity-50"
                            style={{ backgroundColor: colors?.primary }}
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Subiendo...</span>
                                </div>
                            ) : (
                                'Subir Flujograma'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
