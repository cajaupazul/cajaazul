'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
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
    /** Mantiene el placeholder mientras el contenedor obtiene la URL del marco. */
    sourcePending?: boolean;
}

/**
 * Avatar con marco que se revela como una sola pieza una vez decodificadas
 * ambas imágenes. Esto evita mostrar descargas progresivas o marcos a medias.
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
    sourcePending = false,
}: AvatarWithFrameProps) {
    const sizeMap = {
        xs: 32,
        sm: 40,
        md: 56,
        lg: 96,
        xl: 140,
    };

    const actualSize = typeof size === 'number' ? size : sizeMap[size];
    const fallbackChar = name?.charAt(0).toUpperCase() || 'U';
    const avatarSrc = getStorageUrl(avatarUrl, 'profile-avatars', PLACEHOLDERS.AVATAR);
    const [avatarReady, setAvatarReady] = React.useState(false);
    const [avatarFailed, setAvatarFailed] = React.useState(false);
    const [frameReady, setFrameReady] = React.useState(!frameUrl);
    const [frameFailed, setFrameFailed] = React.useState(false);

    React.useEffect(() => {
        setAvatarReady(false);
        setAvatarFailed(false);
    }, [avatarSrc]);

    React.useEffect(() => {
        setFrameReady(!frameUrl);
        setFrameFailed(false);
    }, [frameUrl]);

    const mediaReady = !sourcePending
        && (avatarReady || avatarFailed)
        && (!frameUrl || frameReady || frameFailed);

    const markDecoded = (
        image: HTMLImageElement,
        callback: React.Dispatch<React.SetStateAction<boolean>>,
    ) => {
        const decoding = image.decode?.();
        if (decoding) {
            void decoding.catch(() => undefined).finally(() => callback(true));
            return;
        }
        callback(true);
    };

    return (
        <div
            className={`relative flex-shrink-0 ${className}`}
            style={{ width: actualSize, height: actualSize }}
            aria-busy={!mediaReady}
            aria-label={`Foto de perfil de ${name || 'usuario'}`}
            role="img"
        >
            {!mediaReady && (
                <div className="absolute inset-0 z-30 grid place-items-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-800 animate-pulse">
                    <Loader2
                        className="animate-spin text-white/60"
                        style={{ width: Math.max(12, actualSize * 0.28), height: Math.max(12, actualSize * 0.28) }}
                        aria-hidden="true"
                    />
                    <span className="sr-only">Cargando foto de perfil</span>
                </div>
            )}

            <div
                className={`absolute inset-0 transition-opacity duration-200 motion-reduce:transition-none ${mediaReady ? 'opacity-100' : 'opacity-0'}`}
                aria-hidden={!mediaReady}
            >
                <div className="relative z-10 h-full w-full overflow-hidden rounded-full bg-bb-sidebar">
                    {avatarFailed ? (
                        <div
                            className="flex h-full w-full items-center justify-center rounded-full bg-zinc-700 font-bold text-white"
                            style={{ fontSize: actualSize * 0.4 }}
                        >
                            {fallbackChar}
                        </div>
                    ) : (
                        <img
                            key={avatarSrc}
                            src={avatarSrc}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="eager"
                            decoding="async"
                            fetchPriority="high"
                            onLoad={(event) => markDecoded(event.currentTarget, setAvatarReady)}
                            onError={() => setAvatarFailed(true)}
                        />
                    )}
                </div>

                {frameUrl && !frameFailed && (
                    <div
                        className="pointer-events-none absolute inset-0 z-20"
                        style={{
                            transform: `translate(${offsetX}px, ${offsetY}px) scale(${frameScale})`,
                        }}
                    >
                        <img
                            key={frameUrl}
                            src={frameUrl}
                            alt=""
                            className="h-full w-full object-contain"
                            loading="eager"
                            decoding="async"
                            fetchPriority="high"
                            onLoad={(event) => markDecoded(event.currentTarget, setFrameReady)}
                            onError={() => setFrameFailed(true)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
