'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { Upload, X, GraduationCap, BookOpen, ArrowLeft, FileText, LayoutPanelLeft, CheckCircle } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface FullPageProfessorUploadFormProps {
    professorId: string;
    professorName: string;
    coursesTaught: { id: string; nombre: string }[];
}

const MATERIAL_TYPES = [
    { value: 'ppt', label: '📊 Presentación (PPT)' },
    { value: 'examen', label: '📝 Examen Pasado' },
    { value: 'guia', label: '📚 Guía de Estudio' },
    { value: 'otro', label: '📎 Otro Material' },
];

export default function FullPageProfessorUploadForm({
    professorId,
    professorName,
    coursesTaught,
}: FullPageProfessorUploadFormProps) {
    const router = useRouter();
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [fileName, setFileName] = useState('');
    const [materialType, setMaterialType] = useState('otro');
    const [courseId, setCourseId] = useState<string>(coursesTaught[0]?.id || '');
    const [description, setDescription] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setFileName(selectedFile.name.split('.')[0]); // Default to filename without extension
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!file || !fileName.trim() || !materialType || !courseId) {
            alert('Por favor completa todos los campos');
            return;
        }

        setUploading(true);

        try {
            // Crear nombre único para el archivo
            const fileExt = file.name.split('.').pop();
            const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

            // Subir archivo a storage
            const { error: uploadError } = await supabase.storage
                .from('course_materials')
                .upload(storagePath, file, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: file.type,
                });

            if (uploadError) {
                throw new Error(`Error al subir el archivo: ${uploadError.message}`);
            }

            // Obtener URL pública
            const { data: publicUrlData } = supabase.storage
                .from('course_materials')
                .getPublicUrl(storagePath);

            const materialUrl = publicUrlData.publicUrl;

            // Obtener ID del usuario actual
            const {
                data: { user },
            } = await supabase.auth.getUser();
            const userId = user?.id || 'anonymous';

            // Insertar registro en la tabla materials
            const { error: insertError } = await supabase.from('materials').insert({
                course_id: courseId,
                user_id: userId,
                professor_id: professorId,
                titulo: fileName.trim(),
                descripcion: description.trim() || null,
                url_archivo: materialUrl,
                tipo: materialType,
                descargas: 0,
            });

            if (insertError) throw insertError;

            alert('¡Material subido exitosamente!');
            router.push(`/dashboard/professors/${professorId}`);
            router.refresh();
        } catch (error: any) {
            console.error('Error:', error);
            alert(error.message || 'Error al procesar el material');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-10 px-6">
            <div className="mb-10 flex items-center justify-between">
                <div>
                    <Button
                        variant="ghost"
                        className="pl-0 text-bb-text-secondary hover:text-bb-text hover:bg-transparent mb-4"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="h-5 w-5 mr-1" /> Volver al perfil
                    </Button>
                    <h1 className="text-4xl font-black text-bb-text uppercase tracking-tight">Subir Material</h1>
                    <p className="text-bb-text-secondary mt-2">Estás subiendo material para el profesor: <span className="text-blue-400 font-bold">{professorName}</span></p>
                </div>
            </div>

            <form onSubmit={handleUpload} className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Details */}
                    <div className="space-y-6">
                        <div className="bg-bb-card border border-bb-border rounded-3xl p-8 space-y-6 shadow-xl">
                            <h2 className="text-xl font-black text-bb-text flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-400" /> Detalles del Recurso
                            </h2>

                            <div className="space-y-2">
                                <Label htmlFor="course" className="text-bb-text font-bold flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-purple-400" /> Curso de Referencia *
                                </Label>
                                <Select value={courseId} onValueChange={setCourseId} required>
                                    <SelectTrigger className="bg-bb-darker border-bb-border text-bb-text h-12 text-lg">
                                        <SelectValue placeholder="Selecciona un curso" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-bb-card border-bb-border text-bb-text">
                                        {coursesTaught.map((course) => (
                                            <SelectItem key={course.id} value={course.id} className="focus:bg-bb-hover">
                                                {course.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-bb-text-secondary italic">El material se vinculará a este curso y profesor simultáneamente.</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="type" className="text-bb-text font-bold flex items-center gap-2">
                                    <GraduationCap className="w-4 h-4 text-blue-400" /> Categoría de Material *
                                </Label>
                                <Select value={materialType} onValueChange={setMaterialType}>
                                    <SelectTrigger className="bg-bb-darker border-bb-border text-bb-text h-12 text-lg">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-bb-card border-bb-border text-bb-text">
                                        {MATERIAL_TYPES.map((type) => (
                                            <SelectItem key={type.value} value={type.value} className="focus:bg-bb-hover">
                                                {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="fileName" className="text-bb-text font-bold">Título del Material *</Label>
                                <Input
                                    id="fileName"
                                    value={fileName}
                                    onChange={(e) => setFileName(e.target.value)}
                                    placeholder="Ej: Clase 01 - Introducción"
                                    className="bg-bb-darker border-bb-border text-bb-text h-12 text-lg focus:ring-blue-500"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description" className="text-bb-text font-bold">Descripción (Opcional)</Label>
                                <Textarea
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="¿De qué trata este archivo?"
                                    className="bg-bb-darker border-bb-border text-bb-text min-h-[120px]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: File & Submit */}
                    <div className="space-y-6">
                        <div className="bg-bb-card border border-bb-border rounded-3xl p-8 space-y-6 shadow-xl">
                            <h2 className="text-xl font-black text-bb-text flex items-center gap-2">
                                <Upload className="w-5 h-5 text-green-400" /> Archivo Digital
                            </h2>

                            <div className="space-y-4">
                                <div className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all ${file ? 'border-blue-500 bg-blue-500/5' : 'border-bb-border hover:border-blue-500/50 bg-bb-darker/50'
                                    }`}>
                                    <input
                                        id="file"
                                        type="file"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                                    />
                                    <label
                                        htmlFor="file"
                                        className="cursor-pointer flex flex-col items-center gap-4 group"
                                    >
                                        <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${file ? 'bg-blue-500 text-white' : 'bg-bb-border text-bb-text-secondary'
                                            }`}>
                                            <Upload className="h-10 w-10" />
                                        </div>
                                        <div>
                                            <p className="font-black text-bb-text text-xl">
                                                {file ? '¡Archivo Seleccionado!' : 'Selecciona tu archivo'}
                                            </p>
                                            <p className="text-sm text-bb-text-secondary mt-2">
                                                PDF, PPT, DOC, XLS, Imágenes o ZIP
                                            </p>
                                        </div>
                                    </label>
                                </div>

                                {file && (
                                    <div className="p-4 bg-blue-500/10 rounded-2xl flex items-center justify-between border border-blue-500/20 group">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                                <LayoutPanelLeft className="w-5 h-5 text-blue-400" />
                                            </div>
                                            <span className="text-sm font-bold text-blue-400 truncate">
                                                {file.name}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFile(null);
                                                setFileName('');
                                            }}
                                            className="text-bb-text-secondary hover:text-red-400 p-2 transition-colors"
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-blue-600/5 border border-blue-500/20 rounded-3xl p-8 space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-blue-500/20 rounded-lg">
                                    <CheckCircle className="w-6 h-6 text-blue-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm text-bb-text font-bold italic">Contribución a la Comunidad</p>
                                    <p className="text-[11px] text-bb-text-secondary leading-relaxed mt-1">
                                        Tu aporte ayuda a miles de estudiantes a prepararse mejor. Asegúrate de que el material sea legible y esté bien categorizado.
                                    </p>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 h-16 text-white text-xl font-black shadow-2xl shadow-blue-600/20 mt-4 active:scale-[0.98] transition-all"
                                disabled={uploading || !file}
                            >
                                {uploading ? 'SUBIENDO CONTENIDO...' : 'PUBLICAR MATERIAL'}
                            </Button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
