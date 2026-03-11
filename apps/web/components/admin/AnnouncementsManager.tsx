'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadFileToR2, deleteFileFromR2 } from '@/lib/r2-storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { Switch } from '@/components/ui/switch'; // Removed
import { Trash2, Plus, Image as ImageIcon, ExternalLink, Loader2, Save, Check, AlertCircle } from 'lucide-react';
// import { toast } from 'sonner'; // Removed to avoid dependency issues

interface Announcement {
    id: string;
    title: string;
    image_url: string;
    link_url: string;
    is_active: boolean;
    priority: number;
    show_once: boolean;
    created_at: string;
}

export default function AnnouncementsManager() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    // New announcement form state
    const [newTitle, setNewTitle] = useState('');
    const [newLink, setNewLink] = useState('');
    const [newPriority, setNewPriority] = useState(0);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .order('priority', { ascending: false });

        if (error) {
            console.error('Error cargando anuncios:', error);
        } else {
            setAnnouncements(data || []);
        }
        setLoading(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleCreate = async () => {
        if (!selectedFile || !newTitle) {
            alert('Nombre e imagen son obligatorios');
            return;
        }

        setIsUploading(true);
        try {
            const fileName = `${Date.now()}-${selectedFile.name.replace(/\s+/g, '_')}`;
            const imageUrl = await uploadFileToR2('announcements', fileName, selectedFile);

            const { error } = await supabase
                .from('announcements')
                .insert([{
                    title: newTitle,
                    image_url: imageUrl,
                    link_url: newLink,
                    priority: newPriority,
                    is_active: true
                }]);

            if (error) throw error;

            alert('Anuncio creado con éxito');
            setNewTitle('');
            setNewLink('');
            setNewPriority(0);
            setSelectedFile(null);
            setPreviewUrl(null);
            fetchAnnouncements();
        } catch (error: any) {
            alert('Error al crear anuncio: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('announcements')
            .update({ is_active: !currentStatus })
            .eq('id', id);

        if (error) {
            alert('Error al actualizar estado');
        } else {
            setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, is_active: !currentStatus } : a));
        }
    };

    const handleDelete = async (announcement: Announcement) => {
        if (!confirm('¿Estás seguro de eliminar este anuncio?')) return;

        try {
            // Delete from R2
            await deleteFileFromR2('announcements', announcement.image_url);

            // Delete from DB
            const { error } = await supabase
                .from('announcements')
                .delete()
                .eq('id', announcement.id);

            if (error) throw error;

            alert('Anuncio eliminado');
            fetchAnnouncements();
        } catch (error: any) {
            alert('Error al eliminar: ' + error.message);
        }
    };

    return (
        <div className="space-y-8 p-6 bg-bb-dark min-h-screen text-bb-text">
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Gestión de Anuncios (Ads)</h1>
                    <p className="text-bb-text-secondary mt-1">Sube y gestiona banners para los usuarios.</p>
                </div>
            </header>

            {/* Create New Announcement Card */}
            <div className="bg-bb-card border border-bb-border rounded-3xl p-8 shadow-xl max-w-4xl">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-blue-400" /> Nuevo Anuncio
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div>
                            <Label>Título del Anuncio</Label>
                            <Input 
                                value={newTitle} 
                                onChange={(e) => setNewTitle(e.target.value)} 
                                placeholder="Ej: Nueva Promoción VIP" 
                                className="bg-bb-darker border-bb-border mt-1"
                            />
                        </div>
                        <div>
                            <Label>Enlace de redirección (Opcional)</Label>
                            <Input 
                                value={newLink} 
                                onChange={(e) => setNewLink(e.target.value)} 
                                placeholder="https://..." 
                                className="bg-bb-darker border-bb-border mt-1"
                            />
                        </div>
                        <div>
                            <Label>Prioridad (Mayor = más arriba)</Label>
                            <Input 
                                type="number" 
                                value={newPriority} 
                                onChange={(e) => setNewPriority(parseInt(e.target.value) || 0)} 
                                className="bg-bb-darker border-bb-border mt-1 w-32"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label>Banner / Imagen del Anuncio</Label>
                        <div 
                            className={`border-2 border-dashed rounded-2xl h-48 flex flex-col items-center justify-center cursor-pointer transition-all ${
                                previewUrl ? 'border-blue-500/50 bg-blue-500/5' : 'border-bb-border hover:border-bb-text/30 bg-bb-sidebar/20'
                            }`}
                            onClick={() => document.getElementById('ad-file')?.click()}
                        >
                            {previewUrl ? (
                                <img src={previewUrl} className="w-full h-full object-contain rounded-xl" alt="Preview" />
                            ) : (
                                <>
                                    <ImageIcon className="w-10 h-10 text-bb-text/20 mb-2" />
                                    <span className="text-xs text-bb-text-secondary">Haz clic para subir imagen</span>
                                </>
                            )}
                            <input type="file" id="ad-file" hidden accept="image/*" onChange={handleFileChange} />
                        </div>
                        <Button 
                            className="w-full bg-blue-600 hover:bg-blue-700 h-12 rounded-xl"
                            onClick={handleCreate}
                            disabled={isUploading}
                        >
                            {isUploading ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                            Crear y Publicar Anuncio
                        </Button>
                    </div>
                </div>
            </div>

            {/* List of active ads */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold">Anuncios Actuales</h2>
                {loading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="animate-spin w-10 h-10 text-blue-500" />
                    </div>
                ) : announcements.length === 0 ? (
                    <div className="bg-bb-card border border-bb-border rounded-2xl p-12 text-center text-bb-text-secondary">
                        No hay anuncios creados todavía.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {announcements.map((ad) => (
                            <div key={ad.id} className="bg-bb-card border border-bb-border rounded-2xl overflow-hidden group shadow-lg">
                                <div className="h-40 bg-zinc-900 flex items-center justify-center overflow-hidden">
                                    <img src={ad.image_url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt={ad.title} />
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-bold text-bb-text truncate max-w-[180px]">{ad.title}</h3>
                                            <p className="text-[10px] text-bb-text-secondary">Prioridad: {ad.priority}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {/* Custom Switch Toggle */}
                                            <button
                                                onClick={() => handleToggleActive(ad.id, ad.is_active)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                                                    ad.is_active ? 'bg-blue-600' : 'bg-bb-sidebar border border-bb-border'
                                                }`}
                                            >
                                                <span
                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                        ad.is_active ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                                />
                                            </button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                                                onClick={() => handleDelete(ad)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    {ad.link_url && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-blue-400 truncate">
                                            <ExternalLink className="w-3 h-3" />
                                            {ad.link_url}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
