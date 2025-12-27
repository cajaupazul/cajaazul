'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase, Professor } from '@/lib/supabase';
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
    { value: 'ppt', label: '📊 Presentación (PPT)', description: 'Diapositivas de clase' },
    { value: 'examen', label: '📝 Examen Pasado', description: 'Parciales, finales o prácticas' },
    { value: 'guia', label: '📚 Guía de Estudio', description: 'Resúmenes y apuntes' },
    { value: 'otro', label: '📎 Otro Material', description: 'Cualquier otro recurso útil' },
];

export default function FullPageUploadForm({
    courseId,
    courseName,
    allProfessors,
}: FullPageUploadFormProps) {
    const router = useRouter();
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [fileName, setFileName] = useState('');
    const [materialType, setMaterialType] = useState('otro');
    const [professorId, setProfessorId] = useState<string>('none');
    const [description, setDescription] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setFileName(selectedFile.name);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!file || !fileName.trim() || !materialType) {
            alert('Por favor completa todos los campos');
            return;
        }

        setUploading(true);

        try {
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

            if (uploadError) {
                throw new Error(`Error al subir el archivo: ${uploadError.message}`);
            }

            // 3. Obtener URL pública
            const { data: publicUrlData } = supabase.storage
                .from('course_materials')
                .getPublicUrl(storagePath);

            const materialUrl = publicUrlData.publicUrl;

            // 4. Obtener usuario actual
            const {
                data: { user },
            } = await supabase.auth.getUser();
            const userId = user?.id;

            if (!userId) throw new Error('Usuario no autenticado');

            // 5. Insertar en base de datos
            const { error: insertError } = await supabase.from('materials').insert({
                course_id: courseId,
                user_id: userId,
                professor_id: professorId === 'none' ? null : professorId,
                titulo: fileName.trim(),
                descripcion: description.trim() || null,
                url_archivo: materialUrl,
                tipo: materialType,
                descargas: 0,
            });

            if (insertError) {
                throw new Error(`Error al guardar el material: ${insertError.message}`);
            }

            // Éxito
            router.push(`/dashboard/courses/${courseId}`);
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
                    Volver al curso
                </Button>
                <h1 className="text-3xl font-bold text-slate-900">Subir Material</h1>
                <p className="text-slate-500 mt-2">
                    Comparte tus recursos con la comunidad de <span className="font-semibold text-blue-600">{courseName}</span>.
                </p>
            </div>

            <form onSubmit={handleUpload} className="space-y-8 bg-white p-8 rounded-xl shadow-sm border border-slate-200">

                {/* 1. Selección de Archivo */}
                <div className="space-y-4">
                    <Label className="text-lg font-semibold flex items-center gap-2">
                        <CheckCircle className={`h-5 w-5 ${file ? 'text-green-500' : 'text-slate-300'}`} />
                        1. Selecciona el archivo
                    </Label>

                    <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${file ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50'
                        }`}>
                        <input
                            id="file"
                            type="file"
                            onChange={handleFileChange}
                            className="hidden"
                            accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                        />
                        <label htmlFor="file" className="cursor-pointer block w-full h-full">
                            {file ? (
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                                        <FileText className="h-8 w-8 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-800 text-lg">{file.name}</p>
                                        <p className="text-sm text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setFile(null);
                                            setFileName('');
                                        }}
                                        className="mt-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                    >
                                        <X className="h-4 w-4 mr-2" /> Eliminar archivo
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-4 py-4">
                                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                                        <Upload className="h-8 w-8 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-medium text-slate-700">Arrastra tu archivo aquí o haz clic para explorar</p>
                                        <p className="text-sm text-slate-500 mt-1">Soporta PDF, PPT, Word, Excel, Imágenes, ZIP</p>
                                    </div>
                                </div>
                            )}
                        </label>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* 2. Detalles del Material */}
                    <div className="space-y-4">
                        <Label className="text-lg font-semibold flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-sm font-bold">2</span>
                            Detalles básicos
                        </Label>

                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="fileName">Título del Material</Label>
                                <Input
                                    id="fileName"
                                    value={fileName}
                                    onChange={(e) => setFileName(e.target.value)}
                                    placeholder="Ej: Clase 01 - Introducción..."
                                    className="mt-1.5 h-11"
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="type">Tipo</Label>
                                <Select value={materialType} onValueChange={setMaterialType}>
                                    <SelectTrigger className="mt-1.5 h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MATERIAL_TYPES.map((type) => (
                                            <SelectItem key={type.value} value={type.value}>
                                                <div className="flex flex-col py-1">
                                                    <span className="font-medium">{type.label}</span>
                                                    <span className="text-xs text-slate-500">{type.description}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="description">Descripción (Opcional)</Label>
                                <Input
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe brevemente el contenido"
                                    className="mt-1.5 h-11"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 3. Asociación (Profesor) */}
                    <div className="space-y-4">
                        <Label className="text-lg font-semibold flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-sm font-bold">3</span>
                            Asociación
                        </Label>

                        <div className="p-5 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <Label htmlFor="professor" className="text-slate-700">Profesor del curso</Label>
                                <Link
                                    href="/dashboard/professors"
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
                                    target="_blank"
                                >
                                    <UserPlus className="h-3 w-3" />
                                    Nuevo Profesor
                                </Link>
                            </div>

                            <Select value={professorId} onValueChange={setProfessorId}>
                                <SelectTrigger className="h-11 bg-white">
                                    <SelectValue placeholder="Seleccionar profesor..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">
                                        <span className="text-slate-500">Ningúno / Material General</span>
                                    </SelectItem>
                                    {allProfessors.map((prof) => (
                                        <SelectItem key={prof.id} value={prof.id}>
                                            <span className="font-medium text-slate-900">{prof.nombre}</span>
                                            {prof.especialidad && (
                                                <span className="ml-2 text-xs text-slate-500 font-normal">
                                                    ({prof.especialidad})
                                                </span>
                                            )}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                                Si el material corresponde a una clase específica de un profesor, selecciónalo aquí. Esto ayudará a otros estudiantes a encontrar materiales de sus docentes.
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
                        disabled={uploading || !file}
                        className="w-48 bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
                    >
                        {uploading ? 'Subiendo...' : 'Publicar Material'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
