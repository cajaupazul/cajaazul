'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { Upload, X } from 'lucide-react';
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

interface UploadMaterialsFormProps {
  courseId: string;
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
  onMaterialUploaded,
}: UploadMaterialsFormProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [materialType, setMaterialType] = useState('otro');
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
        console.error('Error al subir archivo:', uploadError);
        alert(`Error al subir el archivo: ${uploadError.message}`);
        setUploading(false);
        return;
      }

      // Obtener URL pública
      const { data: publicUrlData } = supabase.storage
        .from('course_materials')
        .getPublicUrl(storagePath);

      const materialUrl = publicUrlData.publicUrl;

      // Obtener ID del usuario actual (si está autenticado)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id || 'anonymous';

      // Insertar registro en la tabla materials
      const { error: insertError } = await supabase.from('materials').insert({
        course_id: courseId,
        user_id: userId,
        titulo: fileName.trim(),
        descripcion: description.trim() || null,
        url_archivo: materialUrl,
        tipo: materialType,
        descargas: 0,
      });

      if (insertError) {
        console.error('Error al guardar material:', insertError);
        alert(`Error al guardar el material: ${insertError.message}`);
        setUploading(false);
        return;
      }

      alert('¡Material subido exitosamente!');
      setOpen(false);
      setFile(null);
      setFileName('');
      setMaterialType('otro');
      setDescription('');
      onMaterialUploaded();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al procesar el material');
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

          {/* Nombre del Material */}
          <div>
            <Label htmlFor="fileName">Nombre del Material *</Label>
            <Input
              id="fileName"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="Ej: Clase 01 - Introducción"
              className="mt-2"
              required
            />
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
            <Label htmlFor="file">Archivo *</Label>
            <div className="mt-2 border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
              <input
                id="file"
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
              />
              <label
                htmlFor="file"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="h-8 w-8 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-700">
                    Haz clic para seleccionar
                  </p>
                  <p className="text-xs text-slate-500">
                    PDF, PPT, DOC, XLS, Imágenes, ZIP
                  </p>
                </div>
              </label>
            </div>
            {file && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">
                  ✓ {file.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setFileName('');
                  }}
                  className="text-slate-500 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
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
              disabled={uploading || !file}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {uploading ? 'Subiendo...' : 'Subir Material'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}