'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
    useFloating,
    autoUpdate,
    offset,
    flip,
    shift,
    useHover,
    useRole,
    useInteractions,
    FloatingPortal,
    safePolygon
} from '@floating-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MessageCircle, Star, Trophy, Instagram } from 'lucide-react';
import { Profile, getStorageUrl } from '@/lib/supabase';
import { useUserHoverCard } from './UserHoverCardProvider';
import { PLACEHOLDERS } from '@/lib/constants';

interface UserHoverCardProps {
    profile: Partial<Profile>;
    children: React.ReactNode;
}

export function UserHoverCard({ profile, children }: UserHoverCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { statsCache, framesCache, loadingIds, prefetchUserStats, fetchFrame, cancelPrefetch } = useUserHoverCard();

    const { x, y, strategy, refs, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: 'top-start',
        strategy: 'fixed',
        middleware: [
            offset(8),
            flip(),
            shift({ padding: 8 }),
        ],
        whileElementsMounted: autoUpdate,
    });

    const hover = useHover(context, {
        delay: { open: 150, close: 100 },
        handleClose: safePolygon(),
    });

    const role = useRole(context);
    const { getReferenceProps, getFloatingProps } = useInteractions([hover, role]);

    const stats = statsCache.get(profile.id || '');
    const frame = profile.active_frame_key ? framesCache.get(profile.active_frame_key) : null;
    const isLoading = loadingIds.has(profile.id || '');

    useEffect(() => {
        if (isOpen && profile.active_frame_key) {
            fetchFrame(profile.active_frame_key);
        }
    }, [isOpen, profile.active_frame_key, fetchFrame]);

    const badgeConfig = useMemo(() => {
        if (profile.role === 'admin' || profile.role === 'superadmin') {
            return { label: 'Admin', color: 'bg-red-600 border-red-600 text-white' };
        }
        if (profile.es_vip) {
            return { label: 'VIP', color: 'bg-purple-600 border-purple-600 text-white' };
        }
        return { label: 'Colaborador', color: 'bg-zinc-600 border-zinc-600 text-white' };
    }, [profile]);

    const joinedDate = useMemo(() => {
        if (!profile.created_at) return '';
        return new Date(profile.created_at).toLocaleDateString('es-ES', {
            month: 'long',
            year: 'numeric'
        });
    }, [profile.created_at]);

    const handleMouseEnter = () => {
        if (profile.id) prefetchUserStats(profile.id);
    };

    const handleMouseLeave = () => {
        if (profile.id) cancelPrefetch(profile.id);
    };

    // Construct the background URL correctly
    const backgroundUrl = profile.background_url
        ? getStorageUrl(profile.background_url, 'profile-avatars')
        : null;

    return (
        <>
            <span
                ref={refs.setReference}
                {...getReferenceProps({
                    onMouseEnter: handleMouseEnter,
                    onMouseLeave: handleMouseLeave
                })}
                className="inline-flex cursor-pointer"
            >
                {children}
            </span>

            <FloatingPortal>
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            ref={refs.setFloating}
                            style={{
                                position: strategy,
                                top: y ?? 0,
                                left: x ?? 0,
                                width: 'max-content',
                                zIndex: 9999
                            }}
                            {...getFloatingProps()}
                            initial={{ opacity: 0, scale: 0.96, y: 4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 4 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="outline-none"
                        >
                            <div className="w-[360px] max-w-[380px] bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden font-sans">
                                {/* Cover Background */}
                                <div className="relative h-[120px] w-full overflow-hidden bg-[#0c0c0c]">
                                    {backgroundUrl ? (
                                        <img
                                            src={backgroundUrl}
                                            alt="Cover"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-b from-zinc-800 to-black" />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/80" />
                                </div>

                                {/* Content Area with Overlapping Avatar */}
                                <div className="px-5 pt-0 pb-4 relative">
                                    {/* Avatar - Strictly positioned */}
                                    <div className="absolute -top-9 left-4">
                                        <div className="relative w-[80px] h-[80px]">
                                            <div className="w-full h-full rounded-full border-[3px] border-[#1a1a1a] overflow-hidden bg-[#1a1a1a] shadow-lg relative z-10">
                                                <img
                                                    src={getStorageUrl(profile.avatar_url, 'profile-avatars', PLACEHOLDERS.AVATAR)}
                                                    alt={profile.nombre}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            {/* Frame Overlay */}
                                            {frame && (
                                                <div
                                                    className="absolute inset-0 z-20 pointer-events-none"
                                                    style={{
                                                        transform: `translate(${frame.frame_settings?.profile?.x || 0}px, ${frame.frame_settings?.profile?.y || 0}px) scale(${frame.frame_settings?.profile?.scale || 1})`
                                                    }}
                                                >
                                                    <img
                                                        src={getStorageUrl(frame.image_url, 'shop-items')}
                                                        alt="Frame"
                                                        className="w-full h-full object-contain"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Header Info (Pushed Right) */}
                                    <div className="pl-[92px] pt-3 min-h-[46px] flex flex-col justify-center">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <h3 className="font-semibold text-white text-lg tracking-tight truncate shadow-black drop-shadow-sm">
                                                {profile.nombre}
                                            </h3>
                                            <span className={`px-2 py-[1px] rounded text-[10px] uppercase font-bold tracking-wide border ${badgeConfig.color}`}>
                                                {badgeConfig.label}
                                            </span>
                                        </div>
                                        {profile.bio && (
                                            <p className="text-gray-400 text-sm line-clamp-1">
                                                {profile.bio}
                                            </p>
                                        )}
                                    </div>

                                    {/* Secondary Info & Instagram */}
                                    <div className="mt-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
                                            <span className="text-zinc-500">Se unió:</span>
                                            <span className="text-zinc-400">{joinedDate}</span>
                                        </div>

                                        {profile.link_instagram && (
                                            <a
                                                href={profile.link_instagram}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group flex items-center justify-center p-1.5 rounded-lg transition-all hover:scale-110"
                                                title="Instagram"
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] opacity-80 group-hover:opacity-100 rounded-lg blur-[2px] transition-opacity" />
                                                <div className="relative bg-black p-1 rounded-md">
                                                    <Instagram className="w-3.5 h-3.5 text-white" />
                                                </div>
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* Stats Bar (Forum Style) - Strictly 56px */}
                                <div className="h-[56px] bg-[#151515] border-t border-[#2a2a2a] flex items-center">
                                    <div className="flex-1 h-full flex flex-col items-center justify-center border-r border-[#2a2a2a]">
                                        <span className="text-base font-semibold text-zinc-200 leading-none mb-1">{stats?.messages_count || 0}</span>
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-bold">Mensajes</span>
                                    </div>
                                    <div className="flex-1 h-full flex flex-col items-center justify-center border-r border-[#2a2a2a]">
                                        <span className="text-base font-semibold text-zinc-200 leading-none mb-1">{stats?.reaction_score || 0}</span>
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-bold">Puntuación</span>
                                    </div>
                                    <div className="flex-1 h-full flex flex-col items-center justify-center">
                                        <span className="text-base font-semibold text-zinc-200 leading-none mb-1">{profile.puntos || 0}</span>
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-bold">Puntos</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </FloatingPortal>
        </>
    );
}
