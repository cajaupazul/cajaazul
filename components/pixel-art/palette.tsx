import React from 'react';
import { cn } from '@/lib/utils';
import { Palette as PaletteIcon } from 'lucide-react';

export const COLOR_PALETTE = [
    '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
    '#FFC0CB', '#A52A2A', '#808080', '#C0C0C0', '#FFD700',
    '#FF1493', '#00CED1', '#32CD32', '#FFB6C1', '#87CEEB',
    '#4B0082', '#A0522D', '#2F4F4F', '#CD853F', '#D2691E',
];

export const COLOR_MAP = Object.fromEntries(COLOR_PALETTE.map((c, i) => [c, i]));

interface PaletteProps {
    selectedColor: string | null;
    onSelectColor: (color: string) => void;
    className?: string;
}

export function Palette({ selectedColor, onSelectColor, className }: PaletteProps) {
    return (
        <div className={cn("bg-white/95 backdrop-blur shadow-2xl border-t border-gray-200 px-4 py-3 flex items-center justify-center gap-4 transition-all", className)}>

            {/* Color Strip */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[80vw] p-1">
                {COLOR_PALETTE.map((color) => (
                    <button
                        key={color}
                        onClick={() => onSelectColor(color)}
                        className={cn(
                            "w-10 h-10 rounded-lg flex-shrink-0 transition-all transform hover:scale-110 active:scale-95 border-2",
                            selectedColor === color
                                ? "border-black shadow-lg scale-115 ring-2 ring-white z-10"
                                : "border-transparent opacity-90 hover:opacity-100 hover:border-gray-300"
                        )}
                        style={{ backgroundColor: color }}
                        title={color}
                    />
                ))}
            </div>

            {/* Selected Indicator (Optional, functional for "Current") */}
            {selectedColor && (
                <div className="hidden md:flex flex-col items-center gap-1 pl-4 border-l border-gray-200">
                    <div
                        className="w-8 h-8 rounded-full border-2 border-gray-300 shadow-inner"
                        style={{ backgroundColor: selectedColor }}
                    />
                    <span className="text-[10px] font-mono text-gray-500 uppercase">
                        {selectedColor}
                    </span>
                </div>
            )}
        </div>
    );
}
