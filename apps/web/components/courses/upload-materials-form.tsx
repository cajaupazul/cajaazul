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
    { value: 'syllabus', label: '📖 Sílabo Oficial' },
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

                // Actualizar syllabus_url en courses si es tipo syllabus
                if (materialType === 'syllabus') {
                    await supabase
                        .from('courses')
                        .update({ syllabus_url: materialUrl })
                        .eq('id', courseId);
                }
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
            <DialogContent className="sm:max-w-md bg-bb-card border-bb-border text-white shadow-2xl rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Subir Material del Curso</DialogTitle>
                    <DialogDescription className="text-bb-text-secondary font-medium">
                        Comparte un PPT, examen, guía u otro material con tus compañeros
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpload} className="space-y-5">
                    {/* Tipo de Material */}
                    <div>
                        <Label htmlFor="type" className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-2 block px-1">Tipo de Material *</Label>
                        <Select value={materialType} onValueChange={setMaterialType}>
                            <SelectTrigger className="mt-1 h-11 bg-bb-darker border-bb-border text-white rounded-xl focus:ring-blue-500/20 transition-all">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-bb-card border-bb-border text-white rounded-xl">
                                {MATERIAL_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value} className="focus:bg-blue-600 focus:text-white rounded-lg">
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Profesor (Opcional) */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label htmlFor="professor" className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 px-1">Profesor (Opcional)</Label>
                            <Link
                                href="/dashboard/professors"
                                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider flex items-center gap-1 hover:underline"
                                target="_blank"
                            >
                                <UserPlus className="h-3 w-3" />
                                Agregar nuevo
                            </Link>
                        </div>
                        <Select value={professorId} onValueChange={setProfessorId}>
                            <SelectTrigger className="h-11 bg-bb-darker border-bb-border text-white rounded-xl focus:ring-blue-500/20 transition-all">
                                <SelectValue placeholder="Seleccionar profesor..." />
                            </SelectTrigger>
                            <SelectContent className="bg-bb-card border-bb-border text-white rounded-xl">
                                <SelectItem value="none" className="focus:bg-blue-600 focus:text-white rounded-lg italic opacity-70">Ninguno / General</SelectItem>
                                {allProfessors.map((prof) => (
                                    <SelectItem key={prof.id} value={prof.id} className="focus:bg-blue-600 focus:text-white rounded-lg">
                                        {prof.nombre}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {allProfessors.length === 0 && (
                            <p className="text-[9px] text-bb-text-secondary mt-2 italic font-medium">
                                No hay profesores registrados para este curso todavía.
                            </p>
                        )}
                    </div>


                    {/* Descripción */}
                    <div>
                        <Label htmlFor="description" className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-2 block px-1">Descripción (Opcional)</Label>
                        <Input
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe brevemente el contenido"
                            className="h-11 bg-bb-darker border-bb-border text-white placeholder:text-bb-text-secondary/30 rounded-xl focus:ring-blue-500/20"
                        />
                    </div>

                    {/* Seleccionar Archivo */}
                    <div>
                        <Label htmlFor="file" className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-2 block px-1">Archivos *</Label>
                        <div className={`mt-1 border-2 border-dashed rounded-xl p-6 text-center transition-all ${files.length > 0 ? 'border-blue-500 bg-blue-500/5' : 'border-bb-border hover:border-blue-500 hover:bg-bb-darker/50'}`}>
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
                                className="cursor-pointer flex flex-col items-center gap-3"
                            >
                                <div className={`p-3 rounded-xl transition-all ${files.length > 0 ? 'bg-blue-600 text-white' : 'bg-bb-darker text-blue-400 border border-bb-border'}`}>
                                    <Upload className="h-6 w-6" />
                                </div>
                                <div className="space-y-1">
                                    <p className="font-bold text-sm text-white">
                                        {files.length > 0 ? '¡Archivos seleccionados!' : 'Haz clic para seleccionar'}
                                    </p>
                                    <p className="text-[10px] text-bb-text-secondary font-medium">
                                        Soporta múltiples archivos
                                    </p>
                                </div>
                            </label>
                        </div>
                        {files.length > 0 && (
                            <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                {files.map((f, i) => (
                                    <div key={i} className="p-2 bg-bb-darker/50 rounded-xl flex items-center justify-between border border-bb-border group transition-all">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="p-1.5 bg-blue-500/10 rounded-lg">
                                                <FileText className="h-3 w-3 text-blue-400 shrink-0" />
                                            </div>
                                            <span className="text-[11px] font-bold text-white truncate">
                                                {f.name}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                                            className="p-1.5 text-bb-text-secondary hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Botones */}
                    <div className="flex gap-3 pt-6">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                            className="flex-1 text-bb-text-secondary hover:text-white hover:bg-white/5 font-bold rounded-xl"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={uploading || files.length === 0}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 font-black uppercase tracking-widest text-[10px] h-11 rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50"
                        >
                            {uploading ? 'Subiendo...' : 'Subir Materiales'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
