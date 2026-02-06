'use client';

import React, { useState, useMemo } from 'react';
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
    FloatingArrow,
    arrow,
    Placement,
    safePolygon
} from '@floating-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MessageCircle, Star, Trophy, Instagram, Music2 } from 'lucide-react';
import { Profile, getStorageUrl } from '@/lib/supabase';
import { useUserHoverCard } from './UserHoverCardProvider';
import { PLACEHOLDERS } from '@/lib/constants';

interface UserHoverCardProps {
    profile: Partial<Profile>;
    children: React.ReactNode;
}

export function UserHoverCard({ profile, children }: UserHoverCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { statsCache, loadingIds, prefetchUserStats, cancelPrefetch } = useUserHoverCard();

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        middleware: [
            offset(8),
            flip({ fallbackAxisSideDirection: 'end' }),
            shift({ padding: 10 }),
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
    const isLoading = loadingIds.has(profile.id || '');

    const badgeConfig = useMemo(() => {
        if (profile.role === 'admin' || profile.role === 'superadmin') {
            return { label: 'Administrador', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
        }
        if (profile.es_vip) {
            return { label: 'VIP', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
        }
        return { label: 'Estudiante', color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' };
    }, [profile]);

    const joinedDate = useMemo(() => {
        if (!profile.created_at) return 'Recientemente';
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

    return (
        <>
            <div
                ref={refs.setReference}
                {...getReferenceProps({
                    onMouseEnter: handleMouseEnter,
                    onMouseLeave: handleMouseLeave
                })}
                className="inline-block"
            >
                {children}
            </div>

            <FloatingPortal>
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            ref={refs.setFloating}
                            style={floatingStyles}
                            {...getFloatingProps()}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="z-[9999] outline-none"
                        >
                            <div className="w-[420px] bg-[#111] rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden pointer-events-auto">
                                {/* Header / Cover */}
                                <div className="relative h-[140px] w-full">
                                    <div
                                        className="absolute inset-0 bg-cover bg-center"
                                        style={{
                                            backgroundImage: `url(${profile.background_url ? getStorageUrl(profile.background_url, 'profile-backgrounds') : PLACEHOLDERS.BACKGROUND})`
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#111]" />

                                    {/* Social Icons (Overlay) */}
                                    <div className="absolute top-4 right-4 flex gap-2">
                                        {profile.link_instagram && (
                                            <a href={profile.link_instagram} target="_blank" className="p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-colors">
                                                <Instagram className="w-4 h-4" />
                                            </a>
                                        )}
                                        {/* Assuming TikTok might be added later, or mapped from another field */}
                                        {profile.google_full_name?.includes('tiktok') && (
                                            <div className="p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white">
                                                <Music2 className="w-4 h-4" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Content Section */}
                                <div className="px-6 pb-6 relative">
                                    {/* Avatar Overlap */}
                                    <div className="absolute -top-12 left-6">
                                        <div className="w-24 h-24 rounded-full border-4 border-[#111] overflow-hidden bg-zinc-900 ring-1 ring-zinc-800">
                                            <img
                                                src={getStorageUrl(profile.avatar_url, 'profile-avatars', PLACEHOLDERS.AVATAR)}
                                                alt={profile.nombre}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    </div>

                                    {/* User Info */}
                                    <div className="pt-16 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-2xl font-bold text-white tracking-tight">
                                                {profile.nombre}
                                            </h3>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${badgeConfig.color}`}>
                                                {badgeConfig.label}
                                            </span>
                                        </div>

                                        {profile.bio ? (
                                            <p className="text-zinc-400 text-sm line-clamp-1 italic">
                                                "{profile.bio}"
                                            </p>
                                        ) : (
                                            <p className="text-zinc-600 text-sm italic">Sin descripción...</p>
                                        )}

                                        <div className="flex items-center gap-4 text-zinc-500 text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5" />
                                                Se unió en {joinedDate}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Stats Bar */}
                                <div className="grid grid-cols-3 bg-[#1a1a1a] border-t border-zinc-800">
                                    <div className="p-4 flex flex-col items-center justify-center border-r border-zinc-800 hover:bg-white/5 transition-colors group">
                                        {isLoading ? (
                                            <div className="h-6 w-8 bg-zinc-800 rounded animate-pulse mb-1" />
                                        ) : (
                                            <span className="text-xl font-black text-white group-hover:text-blue-400 transition-colors">
                                                {stats?.messages_count || 0}
                                            </span>
                                        )}
                                        <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                            <MessageCircle className="w-3 h-3" />
                                            Mensajes
                                        </div>
                                    </div>
                                    <div className="p-4 flex flex-col items-center justify-center border-r border-zinc-800 hover:bg-white/5 transition-colors group">
                                        {isLoading ? (
                                            <div className="h-6 w-8 bg-zinc-800 rounded animate-pulse mb-1" />
                                        ) : (
                                            <span className="text-xl font-black text-white group-hover:text-yellow-400 transition-colors">
                                                {stats?.reaction_score || 0}
                                            </span>
                                        )}
                                        <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                            <Star className="w-3 h-3" />
                                            Reacciones
                                        </div>
                                    </div>
                                    <div className="p-4 flex flex-col items-center justify-center hover:bg-white/5 transition-colors group">
                                        <span className="text-xl font-black text-white group-hover:text-green-400 transition-colors">
                                            {profile.puntos || 0}
                                        </span>
                                        <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                            <Trophy className="w-3 h-3" />
                                            Puntos
                                        </div>
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
