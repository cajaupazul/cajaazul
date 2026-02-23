'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PLACEHOLDERS } from '@/lib/constants';
import { getStorageUrl } from '@/lib/supabase';

interface AvatarWithFrameProps {
    avatarUrl?: string | null;
    frameUrl?: string | null;
    name?: string | null;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
    frameScale?: number;
    offsetX?: number;
    offsetY?: number;
    className?: string;
}

/**
 * AvatarWithFrame - Un sistema premium de avatares con marcos tipo AAA.
 * Asegura que el marco se superponga perfectamente al avatar circular.
 * Soporta ajustes de escala y posición (X, Y) para alineación perfecta.
 */
export function AvatarWithFrame({
    avatarUrl,
    frameUrl,
    name,
    size = 'md',
    frameScale = 1.0,
    offsetX = 0,
    offsetY = 0,
    className = '',
}: AvatarWithFrameProps) {
    // Mapeo de tamaños predefinidos
    const sizeMap = {
        xs: 32,   // 32x32 - reply
        sm: 40,   // 40x40 - navbar
        md: 56,   // 56x56 - sidebar/card
        lg: 96,   // 96x96 - card grande
        xl: 140,  // 140x140 - profile
    };

    const actualSize = typeof size === 'number' ? size : sizeMap[size];
    const fallbackChar = name?.charAt(0).toUpperCase() || 'U';

    return (
        <div
            className={`relative flex-shrink-0 ${className}`}
            style={{ width: actualSize, height: actualSize }}
        >
            {/* 1. Contenedor del Avatar (Aplica el recorte circular) */}
            <div className="w-full h-full rounded-full overflow-hidden relative z-10 border-2 border-bb-border/50 bg-bb-sidebar">
                <Avatar className="w-full h-full rounded-none">
                    <AvatarImage src={getStorageUrl(avatarUrl, 'profile-avatars', PLACEHOLDERS.AVATAR)} className="object-cover w-full h-full" />
                    <AvatarFallback className="text-white font-bold rounded-none" style={{ fontSize: actualSize * 0.4 }}>
                        {fallbackChar}
                    </AvatarFallback>
                </Avatar>
            </div>

            {/* 2. Capa del Marco (Superposición con <img> para soporte nativo de animaciones) */}
            {frameUrl && (
                <div
                    className="absolute inset-0 pointer-events-none z-20"
                    style={{
                        transform: `translate(${offsetX}px, ${offsetY}px) scale(${frameScale})`,
                    }}
                >
                    <img
                        src={frameUrl}
                        alt="Frame"
                        className="w-full h-full object-contain"
                        loading="eager"
                    />
                </div>
            )}
        </div>
    );
}
