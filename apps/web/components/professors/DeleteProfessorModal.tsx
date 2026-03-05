
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2, FileText, MessageSquare, Sparkles } from 'lucide-react';

interface DeleteProfessorModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (deleteMaterials: boolean) => void;
    professorName: string;
    isDeleting?: boolean;
}

export default function DeleteProfessorModal({
    open,
    onOpenChange,
    onConfirm,
    professorName,
    isDeleting = false
}: DeleteProfessorModalProps) {
    const [deleteMaterials, setDeleteMaterials] = useState(false);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-bb-card border-bb-border text-bb-text sm:max-w-md rounded-3xl overflow-hidden p-0">
                <div className="bg-red-500/10 p-6 flex flex-col items-center border-b border-bb-border">
                    <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mb-4 border border-red-500/30">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <DialogTitle className="text-2xl font-black text-center">Eliminar Profesor</DialogTitle>
                    <DialogDescription className="text-bb-text-secondary text-center">
                        Estás a punto de eliminar a <span className="text-white font-bold">{professorName}</span>
                    </DialogDescription>
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <p className="text-sm font-semibold text-bb-text-secondary uppercase tracking-wider">Acciones automáticas:</p>
                        <div className="grid grid-cols-1 gap-2">
                            <div className="flex items-center gap-3 p-3 bg-bb-darker/50 rounded-xl border border-bb-border/50 opacity-70">
                                <MessageSquare className="w-4 h-4 text-blue-400" />
                                <span className="text-sm">Se borrarán todos los comentarios</span>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-bb-darker/50 rounded-xl border border-bb-border/50 opacity-70">
                                <Sparkles className="w-4 h-4 text-yellow-400" />
                                <span className="text-sm">Se borrarán todas las decoraciones</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <p className="text-sm font-semibold text-bb-text-secondary uppercase tracking-wider">Opciones de archivos:</p>
                        <button
                            onClick={() => setDeleteMaterials(!deleteMaterials)}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${deleteMaterials
                                    ? 'bg-red-500/10 border-red-500/50 shadow-lg shadow-red-500/5'
                                    : 'bg-bb-sidebar/50 border-bb-border hover:bg-bb-sidebar hover:border-bb-border-hover'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${deleteMaterials ? 'bg-red-500/20 text-red-400' : 'bg-bb-darker text-bb-text-secondary'}`}>
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <p className={`font-bold text-sm ${deleteMaterials ? 'text-red-400' : 'text-bb-text'}`}>Eliminar materiales asociados</p>
                                    <p className="text-xs text-bb-text-secondary">Borrar archivos subidos por este profesor</p>
                                </div>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${deleteMaterials ? 'bg-red-500 border-red-500' : 'border-bb-border'
                                }`}>
                                {deleteMaterials && <div className="w-2 h-2 bg-white rounded-full" />}
                            </div>
                        </button>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-bb-sidebar/30 border-t border-bb-border gap-3 sm:gap-0">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="flex-1 font-bold text-bb-text-secondary h-12 rounded-xl"
                        disabled={isDeleting}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={() => onConfirm(deleteMaterials)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-red-500/20"
                        disabled={isDeleting}
                    >
                        {isDeleting ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Eliminando...</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Trash2 className="w-4 h-4" />
                                <span>Eliminar Profesor</span>
                            </div>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
