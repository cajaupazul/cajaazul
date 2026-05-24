'use client';

import { Plus, X, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TemplateSlot } from './use-template-slots';

interface TemplateSlotBarProps {
    slots: TemplateSlot[];
    onRestore: (slot: TemplateSlot) => void;
    onDelete: (image: string) => void;
    onUploadClick: (slotIndex: number) => void;
    className?: string;
}

export function TemplateSlotBar({ slots, onRestore, onDelete, onUploadClick, className }: TemplateSlotBarProps) {
    return (
        <div className={cn("flex items-center gap-1.5 bg-slate-50 p-1 rounded-2xl border border-slate-100 group animate-in slide-in-from-left duration-300", className)}>
            <div className="px-2 border-r border-slate-200 flex items-center gap-1.5 text-slate-400">
                <History className="w-3 h-3" />
                <span className="text-[10px] font-black uppercase tracking-tighter">Continuar</span>
            </div>

            <div className="flex items-center gap-1.5 px-1">
                {[1, 2, 3].map((slotNumber) => {
                    const slot = slots.find(s => s.slot_index === slotNumber);
                    if (slot) {
                        return (
                            <div key={slotNumber} className="relative group/slot">
                                <button
                                    onClick={() => onRestore(slot)}
                                    className="w-10 h-10 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-blue-400 hover:ring-2 hover:ring-blue-100 transition-all hover:scale-110 active:scale-90 shadow-sm bg-white"
                                    title="Continuar con esta plantilla"
                                >
                                    <img src={slot.image} className="w-full h-full object-cover opacity-60 group-hover/slot:opacity-100 transition-opacity" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(slot.image);
                                    }}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-md scale-0 group-hover/slot:scale-100 transition-transform hover:bg-rose-600 z-10"
                                    title="Eliminar este espacio"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        );
                    }
                    return (
                        <label
                            key={slotNumber}
                            htmlFor="guidance-upload"
                            onClick={() => onUploadClick(slotNumber)}
                            className="w-10 h-10 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:text-blue-400 hover:border-blue-200 hover:bg-white transition-all hover:scale-105 cursor-pointer"
                            title="Subir plantilla a este espacio"
                        >
                            <Plus className="w-4 h-4" />
                        </label>
                    );
                })}
            </div>
        </div>
    );
}
