'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { Upload, X, UserPlus, FileText } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Professor } from '@/lib/supabase';
import Link from 'next/link';

interface UploadMaterialsFormProps {
    courseId: string;
    allProfessors: Professor[];
    onMaterialUploaded: () => void;
}

const MATERIAL_TYPES = [
    { value: 'ppt', label: '📊 Presentación (PPT)' },
    { value: 'examen', label: '📝 Examen Pasado' },
    { value: 'guia', label: '📚 Guía de Estudio' },
    { value: 'otro', label: '📎 Otro Material' },
];

export default function UploadMaterialsForm({
    courseId,
    allProfessors,
    onMaterialUploaded,
}: UploadMaterialsFormProps) {
    const [open, setOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [materialType, setMaterialType] = useState('otro');
    const [professorId, setProfessorId] = useState<string>('none');
    const [description, setDescription] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length > 0) {
            setFiles(prev => [...prev, ...selectedFiles]);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();

        if (files.length === 0 || !materialType) {
            alert('Por favor selecciona al menos un archivo');
            return;
        }

        setUploading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuario no autenticado');
            const userId = user.id;

            for (const file of files) {
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

                if (uploadError) throw new Error(`Error al subir ${file.name}: ${uploadError.message}`);

                // Obtener URL pública
                const { data: publicUrlData } = supabase.storage
                    .from('course_materials')
                    .getPublicUrl(storagePath);

                const materialUrl = publicUrlData.publicUrl;

                // Insertar registro en la tabla materials
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
            }

            alert('¡Materiales subidos exitosamente!');
            setOpen(false);
            setFiles([]);
            setMaterialType('otro');
            setDescription('');
            onMaterialUploaded();
        } catch (error: any) {
            console.error('Error:', error);
            alert(error.message || 'Error al procesar el material');
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                    <Upload className="h-4 w-4 mr-2" />
                    Subir Material
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Subir Material del Curso</DialogTitle>
                    <DialogDescription>
                        Comparte un PPT, examen, guía u otro material con tus compañeros
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpload} className="space-y-4">
                    {/* Tipo de Material */}
                    <div>
                        <Label htmlFor="type">Tipo de Material *</Label>
                        <Select value={materialType} onValueChange={setMaterialType}>
                            <SelectTrigger className="mt-2">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {MATERIAL_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Profesor (Opcional) */}
                    <div>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="professor">Profesor (Opcional)</Label>
                            <Link
                                href="/dashboard/professors"
                                className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                                target="_blank"
                            >
                                <UserPlus className="h-2.5 w-2.5" />
                                Agregar nuevo
                            </Link>
                        </div>
                        <Select value={professorId} onValueChange={setProfessorId}>
                            <SelectTrigger className="mt-2 text-sm">
                                <SelectValue placeholder="Seleccionar profesor..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Ninguno / General</SelectItem>
                                {allProfessors.map((prof) => (
                                    <SelectItem key={prof.id} value={prof.id}>
                                        {prof.nombre}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {allProfessors.length === 0 && (
                            <p className="text-[10px] text-slate-500 mt-1 italic">
                                No hay profesores registrados para este curso todavía.
                            </p>
                        )}
                    </div>


                    {/* Descripción */}
                    <div>
                        <Label htmlFor="description">Descripción (Opcional)</Label>
                        <Input
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe brevemente el contenido"
                            className="mt-2"
                        />
                    </div>

                    {/* Seleccionar Archivo */}
                    <div>
                        <Label htmlFor="file">Archivos *</Label>
                        <div className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center transition-all ${files.length > 0 ? 'border-blue-500 bg-blue-50/10' : 'border-slate-300 hover:border-blue-500'}`}>
                            <input
                                id="file-modal"
                                type="file"
                                multiple
                                onChange={handleFileChange}
                                className="hidden"
                                accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                            />
                            <label
                                htmlFor="file-modal"
                                className="cursor-pointer flex flex-col items-center gap-2"
                            >
                                <Upload className={`h-8 w-8 ${files.length > 0 ? 'text-blue-500' : 'text-slate-400'}`} />
                                <div>
                                    <p className="font-medium text-slate-700">
                                        {files.length > 0 ? '¡Archivos seleccionados!' : 'Haz clic para seleccionar'}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Soporta múltiples archivos
                                    </p>
                                </div>
                            </label>
                        </div>
                        {files.length > 0 && (
                            <div className="mt-3 space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                {files.map((f, i) => (
                                    <div key={i} className="p-2 bg-blue-50 rounded-lg flex items-center justify-between border border-blue-100">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileText className="h-3 w-3 text-blue-500 shrink-0" />
                                            <span className="text-[11px] font-medium text-slate-700 truncate">
                                                {f.name}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Botones */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            className="flex-1"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={uploading || files.length === 0}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                            {uploading ? 'Subiendo...' : 'Subir Materiales'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
