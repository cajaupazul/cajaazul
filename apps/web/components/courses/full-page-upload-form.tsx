'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase, Professor } from '@/lib/supabase';
// import { getPublicFileUrl } from '@/lib/r2-storage';
import { Upload, X, UserPlus, ArrowLeft, FileText, CheckCircle } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';

interface FullPageUploadFormProps {
    courseId: string;
    courseName: string;
    allProfessors: Professor[];
}

const MATERIAL_TYPES = [
    { value: 'syllabus', label: '📖 Sílabo Oficial', description: 'Documento oficial del curso' },
    { value: 'ppt', label: '📊 Presentación (PPT)', description: 'Diapositivas de clase' },
    { value: 'examen', label: '📝 Examen Pasado', description: 'Parciales, finales o prácticas' },
    { value: 'guia', label: '📚 Guía de Estudio', description: 'Resúmenes y apuntes' },
    { value: 'enlace', label: '🔗 Enlace / Link', description: 'Links externos o videos' },
    { value: 'otro', label: '📎 Otro Material', description: 'Cualquier otro recurso útil' },
];

export default function FullPageUploadForm({
    courseId,
    courseName,
    allProfessors,
}: FullPageUploadFormProps) {
    const router = useRouter();
    const [uploading, setUploading] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [materialType, setMaterialType] = useState('otro');
    const [professorId, setProfessorId] = useState<string>('none');
    const [description, setDescription] = useState('');
    const [links, setLinks] = useState<{ titulo: string; url: string }[]>([{ titulo: '', url: '' }]);

    const addLinkRow = () => setLinks(prev => [...prev, { titulo: '', url: '' }]);
    const updateLink = (index: number, field: 'titulo' | 'url', value: string) => {
        const newLinks = [...links];
        newLinks[index][field] = value;
        setLinks(newLinks);
    };
    const removeLinkRow = (index: number) => setLinks(prev => prev.filter((_, i) => i !== index));

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length > 0) {
            setFiles(prev => [...prev, ...selectedFiles]);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();

        if (materialType !== 'enlace' && files.length === 0) {
            alert('Por favor selecciona al menos un archivo');
            return;
        }

        // Validate professor selection for types other than 'enlace' and 'otro'
        if (materialType !== 'enlace' && materialType !== 'otro' && professorId === 'none') {
            alert('Para este tipo de material, debes seleccionar un profesor específico.');
            return;
        }

        if (materialType === 'enlace' && links.some(l => !l.url)) {
            alert('Por favor ingresa la URL de todos los enlaces');
            return;
        }

        setUploading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuario no autenticado');
            const userId = user.id;

            if (materialType === 'enlace') {
                for (const link of links) {
                    if (!link.url) continue;
                    const { error: insertError } = await supabase.from('materials').insert({
                        course_id: courseId,
                        user_id: userId,
                        professor_id: professorId === 'none' ? null : professorId,
                        titulo: link.titulo || 'Enlace Externo',
                        descripcion: description.trim() || null,
                        url_archivo: link.url,
                        tipo: 'enlace',
                        descargas: 0,
                    });
                    if (insertError) throw new Error(`Error al guardar enlace: ${insertError.message}`);
                }
            } else {
                // Use parallel uploads for speed
                const uploadPromises = files.map(async (file) => {
                    const fileExt = file.name.split('.').pop();
                    const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

                    const { uploadFileToR2 } = await import('@/lib/r2-storage');
                    const materialUrl = await uploadFileToR2('course-materials', storagePath, file);

                    const { error: insertError } = await supabase.from('materials').insert({
                        course_id: courseId,
                        user_id: userId,
                        professor_id: professorId === 'none' ? null : professorId,
                        titulo: file.name.split('.')[0] || file.name,
                        descripcion: description.trim() || null,
                        url_archivo: materialUrl,
                        tipo: materialType,
                        descargas: 0,
                    });

                    if (insertError) throw new Error(`Error al guardar ${file.name}: ${insertError.message}`);

                    if (materialType === 'syllabus') {
                        await supabase
                            .from('courses')
                            .update({ syllabus_url: materialUrl })
                            .eq('id', courseId);
                    }

                    // Trigger thumbnail generation
                    const triggerExtensions = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'pdf', 'jpg', 'jpeg', 'png', 'webp'];
                    if (triggerExtensions.includes(fileExt?.toLowerCase() || '')) {
                        const { triggerFileConversion } = await import('@/lib/converter');
                        // Small safety delay
                        setTimeout(async () => {
                            try {
                                const urlObj = new URL(materialUrl);
                                const fileKey = urlObj.searchParams.get('path');
                                if (fileKey) {
                                    await triggerFileConversion(fileKey, 'course-materials');
                                }
                            } catch (e) {
                                console.error('Error triggering conversion:', e);
                            }
                        }, 2000);
                    }
                });

                await Promise.all(uploadPromises);
            }

            // Éxito
            router.push(`/dashboard/courses/view?id=${courseId}`);
            router.refresh();
        } catch (error: any) {
            console.error('Error:', error);
            alert(error.message || 'Error al procesar el material');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto py-8 px-4 min-h-screen bg-bb-dark">
            <div className="mb-8">
                <Button
                    variant="ghost"
                    className="pl-0 text-bb-text-secondary hover:bg-transparent hover:text-blue-400 mb-2 transition-colors"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver al curso
                </Button>
                <h1 className="text-3xl font-black text-bb-text uppercase tracking-tight">Subir Material</h1>
                <p className="text-bb-text-secondary mt-2 font-medium">
                    Comparte tus recursos con la comunidad de <span className="font-bold text-blue-400">{courseName}</span>.
                </p>
            </div>

            <form onSubmit={handleUpload} className="space-y-8 bg-bb-card p-8 rounded-2xl shadow-2xl border border-bb-border shadow-black/10 dark:shadow-black/40">
                {/* 1. Selección de Archivo */}
                <div className="space-y-4">
                    <Label className="text-lg font-black text-bb-text uppercase tracking-tight flex items-center gap-2">
                        <CheckCircle className={`h-5 w-5 ${materialType === 'enlace' ? (links.some(l => l.url) ? 'text-green-500' : 'text-bb-border') : (files.length > 0 ? 'text-green-500' : 'text-bb-border')}`} />
                        1. {materialType === 'enlace' ? 'Agrega los enlaces' : 'Selecciona los archivos'}
                    </Label>

                    {materialType === 'enlace' ? (
                        <div className="space-y-4">
                            {links.map((link, index) => (
                                <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-bb-darker/50 rounded-2xl border border-bb-border">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-bb-text-secondary tracking-widest pl-1">Título del enlace</Label>
                                        <Input
                                            placeholder="Ej: Video de la clase"
                                            value={link.titulo}
                                            onChange={(e) => updateLink(index, 'titulo', e.target.value)}
                                            className="h-11 bg-bb-card border-bb-border text-bb-text rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2 relative">
                                        <Label className="text-[10px] font-black uppercase text-bb-text-secondary tracking-widest pl-1">URL / Link *</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="https://..."
                                                value={link.url}
                                                onChange={(e) => updateLink(index, 'url', e.target.value)}
                                                className="h-11 bg-bb-card border-bb-border text-bb-text rounded-xl flex-1"
                                            />
                                            {links.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => removeLinkRow(index)}
                                                    className="h-11 w-11 p-0 text-red-400 hover:bg-red-500/10 rounded-xl"
                                                >
                                                    <X className="h-5 w-5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={addLinkRow}
                                className="w-full h-12 border-dashed border-2 border-bb-border text-bb-text-secondary hover:text-blue-400 hover:border-blue-500/50 rounded-2xl font-bold transition-all"
                            >
                                + Agregar otro enlace
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${files.length > 0 ? 'border-blue-500 bg-blue-500/5' : 'border-bb-border hover:border-blue-500 hover:bg-bb-darker/50'
                                }`}>
                                <input
                                    id="file"
                                    type="file"
                                    multiple
                                    onChange={handleFileChange}
                                    className="hidden"
                                    accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                                />
                                <label htmlFor="file" className="cursor-pointer block w-full h-full">
                                    <div className="flex flex-col items-center gap-4 py-4">
                                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform active:scale-90 ${files.length > 0 ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-bb-sidebar text-blue-400 border border-bb-border'}`}>
                                            <Upload className="h-8 w-8" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-lg font-bold text-bb-text">Arrastra tus archivos aquí o haz clic para explorar</p>
                                            <p className="text-xs text-bb-text-secondary font-medium">Soporta múltiples archivos: PDF, PPT, Word, Imágenes, ZIP</p>
                                        </div>
                                    </div>
                                </label>
                            </div>

                            {files.length > 0 && (
                                <div className="space-y-3 mt-4">
                                    <Label className="text-[10px] font-black text-bb-text-secondary uppercase tracking-[0.2em] px-1 italic">Archivos Seleccionados ({files.length})</Label>
                                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar border border-bb-border/30 rounded-2xl p-2 bg-bb-darker/30">
                                        {files.map((f, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-bb-card rounded-xl border border-bb-border group hover:border-blue-500/30 transition-all">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                                        <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-bb-text truncate">{f.name}</p>
                                                        <p className="text-[10px] text-bb-text-secondary font-medium">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                                                    className="p-2 hover:bg-red-500/10 text-bb-text-secondary hover:text-red-500 rounded-lg transition-all"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* 2. Detalles del Material */}
                    <div className="space-y-4">
                        <Label className="text-lg font-black text-bb-text uppercase tracking-tight flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-bb-sidebar text-blue-400 border border-bb-border flex items-center justify-center text-xs font-black">2</span>
                            Detalles del lote
                        </Label>

                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="type" className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-2 block px-1">Categoría de material</Label>
                                <Select value={materialType} onValueChange={setMaterialType}>
                                    <SelectTrigger className="mt-1.5 h-12 bg-bb-sidebar border-bb-border text-bb-text rounded-xl focus:ring-blue-500/20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-bb-card border-bb-border text-bb-text rounded-xl">
                                        {MATERIAL_TYPES.map((type) => (
                                            <SelectItem key={type.value} value={type.value} className="focus:bg-blue-600 focus:text-white rounded-lg">
                                                <div className="flex flex-col py-1">
                                                    <span className="font-bold">{type.label}</span>
                                                    <span className="text-[10px] opacity-60 font-medium">{type.description}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="description" className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-2 block px-1">Descripción común (Opcional)</Label>
                                <Input
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe brevemente este contenido"
                                    className="mt-1.5 h-12 bg-bb-sidebar border-bb-border text-bb-text placeholder:text-bb-text-secondary/30 rounded-xl focus:ring-blue-500/20"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 3. Asociación (Profesor) */}
                    <div className="space-y-4">
                        <Label className="text-lg font-black text-bb-text uppercase tracking-tight flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-bb-sidebar text-blue-400 border border-bb-border flex items-center justify-center text-xs font-black">3</span>
                            Asociación
                        </Label>

                        <div className="p-5 bg-bb-sidebar/50 rounded-2xl border border-bb-border">
                            <div className="flex items-center justify-between mb-3">
                                <Label htmlFor="professor" className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 px-1">Profesor del curso</Label>
                                <Link
                                    href="/dashboard/professors"
                                    className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 hover:underline uppercase tracking-wider"
                                    target="_blank"
                                >
                                    <UserPlus className="h-3 w-3" />
                                    Nuevo Profesor
                                </Link>
                            </div>

                            <Select value={professorId} onValueChange={setProfessorId}>
                                <SelectTrigger className="h-12 bg-bb-card border-bb-border text-bb-text rounded-xl focus:ring-blue-500/20">
                                    <SelectValue placeholder="Seleccionar profesor..." />
                                </SelectTrigger>
                                <SelectContent className="bg-bb-card border-bb-border text-bb-text rounded-xl">
                                    <SelectItem value="none" className="focus:bg-blue-600 focus:text-white rounded-lg">
                                        <span className="text-bb-text-secondary italic">Ningúno / Material General</span>
                                    </SelectItem>
                                    {allProfessors.map((prof) => (
                                        <SelectItem key={prof.id} value={prof.id} className="focus:bg-blue-600 focus:text-white rounded-lg">
                                            <span className="font-bold">{prof.nombre}</span>
                                            {prof.especialidad && (
                                                <span className="ml-2 text-[10px] opacity-50 font-medium">
                                                    ({prof.especialidad})
                                                </span>
                                            )}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <p className="text-[10px] text-bb-text-secondary mt-4 leading-relaxed italic font-medium">
                                Si el material corresponde a una clase específica de un profesor, selecciónalo aquí. Esto ayudará a otros estudiantes a encontrar materiales de sus docentes.
                            </p>
                            <p className="text-[10px] text-blue-400 mt-3 font-bold uppercase tracking-tight flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                Solo podrás eliminar tu material durante las primeras 24 horas.
                            </p>
                            <p className="text-[9px] text-blue-400/70 mt-4 font-bold uppercase tracking-tighter">
                                * Si el profesor no se encuentra en la lista, deberías agregar uno nuevo.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="pt-8 border-t border-bb-border flex flex-col sm:flex-row justify-end gap-4">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.back()}
                        className="w-full sm:w-32 text-bb-text-secondary hover:text-bb-text hover:bg-bb-hover font-bold rounded-xl"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        disabled={uploading || (materialType === 'enlace' ? links.every(l => !l.url) : files.length === 0)}
                        className="w-full sm:w-64 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all text-white font-black uppercase tracking-widest text-xs h-12 rounded-xl active:scale-95 disabled:opacity-50"
                    >
                        {uploading ? 'Subiendo...' : (materialType === 'enlace' ? 'Publicar Enlaces' : 'Publicar Materiales')}
                    </Button>
                </div>
            </form>
        </div>
    );
}
