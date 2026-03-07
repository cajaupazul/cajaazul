
'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, User, FileText, ArrowLeft, ExternalLink, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface Material {
    id: string;
    titulo: string;
    descripcion?: string;
    tipo: string;
    url_archivo: string;
    created_at: string;
    user_id: string;
    professor_id: string | null;
    profiles?: {
        id: string;
        full_name?: string;
        avatar_url?: string;
        email?: string;
    };
}

interface Professor {
    id: string;
    nombre: string;
}

interface AdminMaterialManagerProps {
    isOpen: boolean;
    onClose: () => void;
    materials: Material[];
    allProfessors: Professor[];
    courseName: string;
}

export default function AdminMaterialManager({
    isOpen,
    onClose,
    materials,
    allProfessors,
    courseName
}: AdminMaterialManagerProps) {
    const router = useRouter();
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    // Group materials by user
    const usersWithMaterials = useMemo(() => {
        const usersMap = new Map();

        materials.forEach(material => {
            if (!material.profiles) return;

            const userId = material.user_id;
            if (!usersMap.has(userId)) {
                usersMap.set(userId, {
                    user: material.profiles,
                    materialCount: 0,
                    materials: []
                });
            }

            const userData = usersMap.get(userId);
            userData.materialCount++;
            userData.materials.push(material);
        });

        return Array.from(usersMap.values());
    }, [materials]);

    const selectedUserMatches = useMemo(() => {
        if (!selectedUserId) return null;
        return usersWithMaterials.find(u => u.user.id === selectedUserId);
    }, [selectedUserId, usersWithMaterials]);

    const handleUpdateProfessor = async (materialId: string, newProfessorId: string) => {
        setIsUpdating(materialId);
        try {
            const professorId = newProfessorId === 'none' ? null : newProfessorId;
            const { error } = await supabase
                .from('materials')
                .update({ professor_id: professorId })
                .eq('id', materialId);

            if (error) throw error;
            router.refresh();
        } catch (error) {
            console.error('Error updating material:', error);
            alert('Error al actualizar el material');
        } finally {
            setIsUpdating(null);
        }
    };

    const handleDeleteMaterial = async (material: Material) => {
        if (!confirm('¿Estás seguro de eliminar este material? Esta acción es irreversible.')) return;

        setIsDeleting(material.id);
        try {
            // Delete from storage first
            const { deleteFileFromR2 } = await import('@/lib/r2-storage');
            await deleteFileFromR2('course-materials', material.url_archivo);

            const { error } = await supabase
                .from('materials')
                .delete()
                .eq('id', material.id);

            if (error) throw error;

            // If user has no more materials, go back to list
            if (selectedUserMatches?.materials.length === 1) {
                setSelectedUserId(null);
            }

            router.refresh();
        } catch (error) {
            console.error('Error deleting material:', error);
            alert('Error al eliminar el material');
        } finally {
            setIsDeleting(null);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 bg-bb-background border-bb-border text-bb-text overflow-hidden">
                <DialogHeader className="p-6 border-b border-bb-border/50 bg-bb-dark/50 backdrop-blur-sm z-10">
                    <div className="flex items-center gap-3">
                        {selectedUserId && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedUserId(null)}
                                className="h-8 w-8 -ml-2 mr-1 text-bb-text-secondary hover:text-white"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        )}
                        <div>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                    Gestión de Materiales
                                </span>
                            </DialogTitle>
                            <DialogDescription className="text-bb-text-secondary">
                                {courseName}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden relative">
                    {!selectedUserId ? (
                        <div className="h-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-bb-border scrollbar-track-transparent">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {usersWithMaterials.length === 0 ? (
                                    <div className="col-span-full py-12 text-center text-bb-text-secondary">
                                        <div className="w-16 h-16 bg-bb-dark/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-bb-border">
                                            <User className="w-8 h-8 opacity-50" />
                                        </div>
                                        <p>No hay materiales subidos por usuarios aún.</p>
                                    </div>
                                ) : (
                                    usersWithMaterials.map(({ user, materialCount }) => (
                                        <button
                                            key={user.id}
                                            onClick={() => setSelectedUserId(user.id)}
                                            className="flex items-center gap-4 p-4 rounded-xl bg-bb-card/50 border border-bb-border/50 hover:bg-bb-card hover:border-blue-500/30 transition-all group text-left"
                                        >
                                            <Avatar className="h-12 w-12 border-2 border-bb-border group-hover:border-blue-500/50 transition-colors">
                                                <AvatarImage src={user.avatar_url} />
                                                <AvatarFallback className="bg-bb-dark text-bb-text font-bold">
                                                    {user.full_name?.charAt(0) || '?'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-bb-text truncate group-hover:text-blue-400 transition-colors">
                                                    {user.full_name || 'Usuario desconocido'}
                                                </h4>
                                                <p className="text-xs text-bb-text-secondary truncate">
                                                    {user.email}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-2xl font-black text-bb-text group-hover:scale-110 transition-transform">
                                                    {materialCount}
                                                </span>
                                                <span className="text-[10px] uppercase font-bold text-bb-text-secondary tracking-wider">
                                                    Materiales
                                                </span>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            {selectedUserMatches && (
                                <div className="p-4 bg-blue-500/5 border-b border-blue-500/10 flex items-center gap-4">
                                    <Avatar className="h-10 w-10 border border-blue-500/20">
                                        <AvatarImage src={selectedUserMatches.user.avatar_url} />
                                        <AvatarFallback>{selectedUserMatches.user.full_name?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-bold text-sm text-blue-100">
                                            Materiales de {selectedUserMatches.user.full_name}
                                        </h3>
                                        <p className="text-xs text-blue-300/70">
                                            {selectedUserMatches.materialCount} archivos encontrados
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-bb-border scrollbar-track-transparent">
                                <div className="space-y-3">
                                    {selectedUserMatches?.materials.map((material: Material) => (
                                        <div
                                            key={material.id}
                                            className="group flex flex-col md:flex-row gap-4 p-4 rounded-xl bg-bb-card border border-bb-border hover:border-bb-border-active transition-all"
                                        >
                                            <div className="flex-1 min-w-0  space-y-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-bb-dark text-bb-text-secondary border border-bb-border">
                                                            {material.tipo}
                                                        </span>
                                                        <span className="text-xs text-bb-text-secondary flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            {format(new Date(material.created_at), "d MMM yyyy", { locale: es })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <a
                                                    href={material.url_archivo}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block font-bold text-base hover:text-blue-400 transition-colors line-clamp-1 group-hover:line-clamp-none"
                                                >
                                                    {material.titulo}
                                                </a>
                                                {material.descripcion && (
                                                    <p className="text-sm text-bb-text-secondary line-clamp-1 group-hover:line-clamp-none">
                                                        {material.descripcion}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-bb-border/50 mt-2 md:mt-0">
                                                <div className="flex-1 md:w-64">
                                                    <Select
                                                        value={material.professor_id || 'none'}
                                                        onValueChange={(val) => handleUpdateProfessor(material.id, val)}
                                                        disabled={isUpdating === material.id}
                                                    >
                                                        <SelectTrigger className="h-9 bg-bb-dark border-bb-border text-xs">
                                                            <SelectValue placeholder="Asignar profesor" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">General (Ninguno)</SelectItem>
                                                            {allProfessors.map(prof => (
                                                                <SelectItem key={prof.id} value={prof.id}>
                                                                    {prof.nombre}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <Button
                                                    variant="destructive"
                                                    size="icon"
                                                    className="h-9 w-9 shrink-0 opacity-100 hover:bg-red-500/20 text-red-400 border border-transparent hover:border-red-500/50"
                                                    onClick={() => handleDeleteMaterial(material)}
                                                    disabled={isDeleting === material.id}
                                                    title="Eliminar material permanentemente"
                                                >
                                                    {isDeleting === material.id ? (
                                                        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
