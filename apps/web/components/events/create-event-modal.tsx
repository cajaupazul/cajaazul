'use client';
import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Trash2,
    Maximize,
    Save,
    Image as ImageIcon,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    LayoutGrid,
    Type
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getStorageUrl } from '@/lib/supabase';

interface Event {
    id?: string;
    titulo: string;
    descripcion: string;
    fecha_inicio: Date | string;
    tipo: string;
    imagen_url?: string;
    metadata?: any;
    participantes?: number;
}

interface CreateEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onEventCreated: () => void;
    initialData?: Event | null; // If provided, we are editing
}

export default function CreateEventModal({
    isOpen,
    onClose,
    onEventCreated,
    initialData
}: CreateEventModalProps) {
    const isEditing = !!initialData;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Event>>({
        titulo: '',
        descripcion: '',
        fecha_inicio: '',
        tipo: 'Académico',
        metadata: {}
    });

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Pixel Art Specific State
    const isPixelArt = formData.tipo === 'Cultural' && (formData.titulo?.toLowerCase().includes('pixel') || initialData?.metadata?.is_pixel_art);

    useEffect(() => {
        if (isOpen && initialData) {
            setFormData({
                ...initialData,
                fecha_inicio: new Date(initialData.fecha_inicio).toISOString().split('T')[0]
            });
            if (initialData.imagen_url) {
                setPreviewUrl(getStorageUrl(initialData.imagen_url));
            }
        } else if (isOpen && !initialData) {
            // Reset for new event
            setFormData({
                titulo: '',
                descripcion: '',
                fecha_inicio: new Date().toISOString().split('T')[0],
                tipo: 'Académico',
                metadata: {}
            });
            setPreviewUrl(null);
            setImageFile(null);
        }
    }, [isOpen, initialData]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            let imageUrl = formData.imagen_url;

            // 1. Upload Image if changed
            if (imageFile) {
                const fileExt = imageFile.name.split('.').pop();
                const fileName = `events/${Date.now()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('r2-images') // Verify bucket name
                    .upload(fileName, imageFile);

                if (uploadError) throw uploadError;

                // R2 Public URL logic (assuming standardize helper or direct path)
                // For now, storing relative path or full URL depending on app logic.
                // Using relative path standard for getStorageUrl
                imageUrl = fileName;
            }

            // 2. Insert/Update Event
            const eventPayload = {
                titulo: formData.titulo,
                descripcion: formData.descripcion,
                fecha_inicio: new Date(formData.fecha_inicio!).toISOString(),
                tipo: formData.tipo,
                imagen_url: imageUrl,
                metadata: formData.metadata
            };

            let error;
            if (isEditing && initialData?.id) {
                const res = await supabase
                    .from('events')
                    .update(eventPayload)
                    .eq('id', initialData.id);
                error = res.error;
            } else {
                const res = await supabase
                    .from('events')
                    .insert([eventPayload]);
                error = res.error;
            }

            if (error) throw error;

            setSuccess(isEditing ? 'Evento actualizado correctamente' : 'Evento creado correctamente');
            setTimeout(() => {
                onEventCreated();
                onClose();
            }, 1000);

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error al guardar el evento');
        } finally {
            setLoading(false);
        }
    };

    // Pixel Art Actions
    const handleClearCanvas = async () => {
        if (!initialData?.id) return;
        if (!confirm("⚠️ ¿PELIGRO EXTREMO: Estás seguro de borrar TODO el lienzo? \n\nEsto eliminará permanentemente todos los píxeles dibujados por los usuarios. No hay forma de deshacer esto.")) return;

        setLoading(true);
        try {
            // NEW LOGIC: Delete all rows for this event_id
            // RLS Policy "Admins can delete board state" must be enabled
            const { error: clearError } = await supabase
                .from('pixel_board_state')
                .delete()
                .eq('event_id', initialData.id);

            if (clearError) throw clearError;
            setSuccess("Canvas limpiado correctamente (Todos los píxeles eliminados)");
        } catch (err: any) {
            console.error("Error clearing canvas:", err);
            setError(err.message || "Error al limpiar el lienzo");
        } finally {
            setLoading(false);
        }
    };

    const handleResizeCanvas = async (w: number, h: number) => {
        if (!initialData?.id) return;
        if (!confirm(`¿Cambiar dimensiones a ${w}x${h}? \n\nEsto actualizará la configuración del evento. Los píxeles fuera del nuevo rango no serán visibles.`)) return;

        setLoading(true);
        try {
            // 1. Get current metadata to preserve other fields
            const currentMeta = initialData.metadata || {};

            // 2. Update Event Metadata (Width/Height are stored in metadata now)
            const newMeta = {
                ...currentMeta,
                width: w,
                height: h,
                is_pixel_art: true // Ensure flag remains
            };

            const { error: resizeError } = await supabase
                .from('events')
                .update({ metadata: newMeta })
                .eq('id', initialData.id);

            if (resizeError) throw resizeError;

            setSuccess(`Dimensiones actualizadas a ${w}x${h}`);

            // Refresh parent if needed
            onEventCreated();

        } catch (err: any) {
            console.error("Error resizing canvas:", err);
            setError(err.message || "Error al redimensionar");
        } finally {
            setLoading(false);
        }
    };


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#1a1b1e] text-white border-gray-800 max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        {isEditing ? 'Editar Evento' : 'Crear Nuevo Evento'}
                        {isPixelArt && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">Pixel Art Mode</span>}
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Configura los detalles del evento{isPixelArt ? ' y administra el tablero de Pixel Art' : ''}.
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 p-3 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}
                {success && (
                    <div className="bg-green-500/10 border border-green-500/50 p-3 rounded-lg flex items-center gap-2 text-green-400 text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        {success}
                    </div>
                )}

                <div className="space-y-6 py-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                            <Label>Título del Evento</Label>
                            <Input
                                value={formData.titulo}
                                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                                className="bg-[#25262b] border-gray-700 focus:border-blue-500"
                                placeholder="Ej: Pixel Art 2025"
                            />
                        </div>

                        <div className="space-y-2 col-span-2">
                            <Label>Descripción</Label>
                            <Textarea
                                value={formData.descripcion}
                                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                className="bg-[#25262b] border-gray-700 focus:border-blue-500 min-h-[80px]"
                                placeholder="Describe el evento..."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Fecha de Inicio</Label>
                            <Input
                                type="date"
                                value={formData.fecha_inicio as string}
                                onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                                className="bg-[#25262b] border-gray-700"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Tipo de Evento</Label>
                            <Select
                                value={formData.tipo}
                                onValueChange={(val) => setFormData({ ...formData, tipo: val })}
                            >
                                <SelectTrigger className="bg-[#25262b] border-gray-700">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#25262b] border-gray-700 text-white">
                                    <SelectItem value="Académico">Académico</SelectItem>
                                    <SelectItem value="Cultural">Cultural</SelectItem>
                                    <SelectItem value="Deportivo">Deportivo</SelectItem>
                                    <SelectItem value="Gaming">Gaming</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Image Upload */}
                    <div className="space-y-2">
                        <Label>Imagen de Portada</Label>
                        <div className="flex items-start gap-4">
                            <div className="w-32 h-20 bg-[#25262b] rounded-lg border border-gray-700 flex items-center justify-center overflow-hidden relative group">
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon className="text-gray-500 w-8 h-8" />
                                )}
                            </div>
                            <div className="flex-1">
                                <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="bg-[#25262b] border-gray-700 text-sm file:text-blue-400 file:font-semibold"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    JPG, PNG o WEBP. Máx 5MB.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* PIXEL ART ADMIN CONTROLS */}
                    {isEditing && isPixelArt && (
                        <div className="border-t border-gray-800 pt-6">
                            <div className="flex items-center gap-2 mb-4">
                                <LayoutGrid className="w-5 h-5 text-purple-400" />
                                <h3 className="font-bold text-lg">Zona de Peligro Pixel Art</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 space-y-3">
                                    <h4 className="text-sm font-bold text-red-400 flex items-center gap-2">
                                        <Trash2 className="w-4 h-4" /> Limpiar Lienzo
                                    </h4>
                                    <p className="text-xs text-gray-400">
                                        Borra todos los píxeles. Esta acción es irreversible.
                                    </p>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleClearCanvas}
                                        disabled={loading}
                                        className="w-full"
                                    >
                                        Limpiar Todo
                                    </Button>
                                </div>

                                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-3">
                                    <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                                        <Maximize className="w-4 h-4" /> Redimensionar
                                    </h4>
                                    <div className="flex gap-2">
                                        <Input
                                            id="new-w"
                                            placeholder="W"
                                            className="h-8 bg-black/20 border-blue-500/30 text-xs"
                                            defaultValue={1000}
                                        />
                                        <Input
                                            id="new-h"
                                            placeholder="H"
                                            className="h-8 bg-black/20 border-blue-500/30 text-xs"
                                            defaultValue={1000}
                                        />
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const w = parseInt((document.getElementById('new-w') as HTMLInputElement).value);
                                            const h = parseInt((document.getElementById('new-h') as HTMLInputElement).value);
                                            if (w && h) handleResizeCanvas(w, h);
                                        }}
                                        disabled={loading}
                                        className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                    >
                                        Aplicar Tamaño
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} className="hover:bg-white/5 mx-2">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
                    >
                        {loading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                        {isEditing ? 'Guardar Cambios' : 'Crear Evento'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
