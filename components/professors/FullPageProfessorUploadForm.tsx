'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { Upload, X, GraduationCap, BookOpen, ArrowLeft, FileText, CheckCircle } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';

interface FullPageProfessorUploadFormProps {
    professorId: string;
    professorName: string;
    coursesTaught: { id: string; nombre: string }[];
    preselectedCourseId?: string | null;
}

const MATERIAL_TYPES = [
    { value: 'ppt', label: '📊 Presentación (PPT)', description: 'Diapositivas de clase' },
    { value: 'examen', label: '📝 Examen Pasado', description: 'Parciales, finales o prácticas' },
    { value: 'guia', label: '📚 Guía de Estudio', description: 'Resúmenes y apuntes' },
    { value: 'otro', label: '📎 Otro Material', description: 'Cualquier otro recurso útil' },
];

export default function FullPageProfessorUploadForm({
    professorId,
    professorName,
    coursesTaught,
    preselectedCourseId,
}: FullPageProfessorUploadFormProps) {
    const router = useRouter();
    const [uploading, setUploading] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [materialType, setMaterialType] = useState('otro');
    const [courseId, setCourseId] = useState<string>(preselectedCourseId || coursesTaught[0]?.id || '');
    const [description, setDescription] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length > 0) {
            setFiles(prev => [...prev, ...selectedFiles]);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();

        if (files.length === 0 || !materialType || !courseId) {
            alert('Por favor selecciona al menos un archivo y el curso de referencia');
            return;
        }

        setUploading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuario no autenticado');
            const userId = user.id;

            for (const file of files) {
                // 1. Crear nombre único para el archivo
                const fileExt = file.name.split('.').pop();
                const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

                // 2. Subir archivo a Supabase Storage
                const { error: uploadError } = await supabase.storage
                    .from('course_materials')
                    .upload(storagePath, file, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: file.type,
                    });

                if (uploadError) throw new Error(`Error al subir ${file.name}: ${uploadError.message}`);

                // 3. Obtener URL pública
                const { data: publicUrlData } = supabase.storage
                    .from('course_materials')
                    .getPublicUrl(storagePath);

                const materialUrl = publicUrlData.publicUrl;

                // 4. Insertar en base de datos
                const { error: insertError } = await supabase.from('materials').insert({
                    course_id: courseId,
                    user_id: userId,
                    professor_id: professorId,
                    titulo: file.name.split('.')[0] || file.name,
                    descripcion: description.trim() || null,
                    url_archivo: materialUrl,
                    tipo: materialType,
                    descargas: 0,
                });

                if (insertError) throw new Error(`Error al guardar ${file.name}: ${insertError.message}`);
            }

            // Éxito
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
        <div className="max-w-3xl mx-auto py-8 px-4">
            <div className="mb-8">
                <Button
                    variant="ghost"
                    className="pl-0 hover:bg-transparent hover:text-blue-600 mb-2"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver al perfil
                </Button>
                <h1 className="text-3xl font-bold text-slate-900">Subir Material</h1>
                <p className="text-slate-500 mt-2">
                    Estás subiendo material para el profesor: <span className="font-semibold text-blue-600">{professorName}</span>
                </p>
            </div>

            <form onSubmit={handleUpload} className="space-y-8 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                {/* 1. Selección de Archivo */}
                <div className="space-y-4">
                    <Label className="text-lg font-semibold flex items-center gap-2">
                        <CheckCircle className={`h-5 w-5 ${files.length > 0 ? 'text-green-500' : 'text-slate-300'}`} />
                        1. Selecciona los archivos
                    </Label>

                    <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${files.length > 0 ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50'
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
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${files.length > 0 ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}>
                                    <Upload className="h-8 w-8" />
                                </div>
                                <div>
                                    <p className="text-lg font-medium text-slate-700">Arrastra tus archivos aquí o haz clic para explorar</p>
                                    <p className="text-sm text-slate-500 mt-1">Soporta múltiples archivos: PDF, PPT, Word, Imágenes, ZIP</p>
                                </div>
                            </div>
                        </label>
                    </div>

                    {files.length > 0 && (
                        <div className="space-y-2 mt-4">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Archivos Seleccionados ({files.length})</Label>
                            <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar border border-slate-100 rounded-xl p-2">
                                {files.map((f, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 group">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-slate-700 truncate">{f.name}</p>
                                                <p className="text-[10px] text-slate-500">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                                            className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* 2. Detalles del Material */}
                    <div className="space-y-4">
                        <Label className="text-lg font-semibold flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-sm font-bold">2</span>
                            Detalles del lote
                        </Label>

                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="type">Categoría de material</Label>
                                <Select value={materialType} onValueChange={setMaterialType}>
                                    <SelectTrigger className="mt-1.5 h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MATERIAL_TYPES.map((type) => (
                                            <SelectItem key={type.value} value={type.value}>
                                                <div className="flex flex-col py-1">
                                                    <span className="font-medium text-slate-900">{type.label}</span>
                                                    <span className="text-xs text-slate-500">{type.description}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="description">Descripción común (Opcional)</Label>
                                <Input
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe brevemente este contenido"
                                    className="mt-1.5 h-11"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 3. Asociación (Curso) */}
                    <div className="space-y-4">
                        <Label className="text-lg font-semibold flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-sm font-bold">3</span>
                            Asociación
                        </Label>

                        <div className="p-5 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <Label htmlFor="course" className="text-slate-700">Curso de Referencia *</Label>
                                <Link
                                    href="/dashboard/courses"
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
                                    target="_blank"
                                >
                                    <BookOpen className="h-3 w-3" />
                                    Ver Cursos
                                </Link>
                            </div>

                            <Select value={courseId} onValueChange={setCourseId}>
                                <SelectTrigger className="h-11 bg-white">
                                    <SelectValue placeholder="Selecciona un curso" />
                                </SelectTrigger>
                                <SelectContent>
                                    {coursesTaught.length > 0 ? (
                                        coursesTaught.map((course) => (
                                            <SelectItem key={course.id} value={course.id}>
                                                <span className="font-medium text-slate-900">{course.nombre}</span>
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <p className="p-2 text-xs text-slate-500 italic">No tienes cursos vinculados.</p>
                                    )}
                                </SelectContent>
                            </Select>

                            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                                El material se vinculará a este profesor y al curso seleccionado simultáneamente. Esto ayudará a otros estudiantes a encontrar materiales en ambas secciones.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                        className="w-32"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        disabled={uploading || files.length === 0}
                        className="w-48 bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all text-white font-bold"
                    >
                        {uploading ? 'Subiendo...' : 'Publicar Materiales'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
