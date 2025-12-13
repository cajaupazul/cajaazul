import React from 'react';
import { Plus, Minus, Home, Move } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavigationControlsProps {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onReset: () => void;
    scale: number;
    isPanning: boolean;
    onTogglePan: () => void;
    className?: string;
}

export function NavigationControls({
    onZoomIn,
    onZoomOut,
    onReset,
    scale,
    isPanning,
    onTogglePan,
    className
}: NavigationControlsProps) {
    return (
        <div className={cn("flex flex-col gap-2", className)}>
            <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full shadow-lg p-1.5 flex flex-col gap-1 items-center">
                <button
                    onClick={onZoomIn}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-700 transition-colors"
                    title="Acercar (+)"
                >
                    <Plus className="w-5 h-5" />
                </button>

                <div className="text-[10px] font-mono font-bold text-gray-500 py-1">
                    {Math.round(scale * 100)}%
                </div>

                <button
                    onClick={onZoomOut}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-700 transition-colors"
                    title="Alejar (-)"
                >
                    <Minus className="w-5 h-5" />
                </button>
            </div>

            <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full shadow-lg p-1.5 flex flex-col gap-1 items-center">
                <button
                    onClick={onReset}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-700 transition-colors"
                    title="Resetear Vista"
                >
                    <Home className="w-5 h-5" />
                </button>

                <button
                    onClick={onTogglePan}
                    className={cn(
                        "p-2 rounded-full transition-colors",
                        isPanning
                            ? "bg-blue-500 text-white shadow-md active:scale-95"
                            : "hover:bg-gray-100 text-gray-700"
                    )}
                    title={isPanning ? "Modo Panear (Activo)" : "Activar Modo Panear"}
                >
                    <Move className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
