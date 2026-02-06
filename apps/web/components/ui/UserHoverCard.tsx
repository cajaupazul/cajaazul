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
                            <div className="w-[340px] bg-[#111] rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden pointer-events-auto">
                                {/* Header / Cover */}
                                <div className="relative h-[110px] w-full bg-[#111]">
                                    <div
                                        className="absolute inset-0 bg-cover bg-center"
                                        style={{
                                            backgroundImage: `url(${profile.background_url ? getStorageUrl(profile.background_url, 'profile-avatars') : PLACEHOLDERS.BACKGROUND})`
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#111]" />

                                    {/* Social Icons (Overlay) */}
                                    <div className="absolute top-3 right-3 flex gap-1.5">
                                        {profile.link_instagram && (
                                            <a href={profile.link_instagram} target="_blank" className="p-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-colors">
                                                <Instagram className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* Content Section */}
                                <div className="px-4 pb-4 relative">
                                    {/* Avatar & Name Area - Overlapping */}
                                    <div className="flex items-end gap-3 -mt-10 mb-4 relative z-10">
                                        <div className="w-20 h-20 rounded-xl border-4 border-[#111] overflow-hidden bg-zinc-900 shadow-xl flex-shrink-0 ring-1 ring-zinc-800">
                                            <img
                                                src={getStorageUrl(profile.avatar_url, 'profile-avatars', PLACEHOLDERS.AVATAR)}
                                                alt={profile.nombre}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="pb-1 min-w-0">
                                            <h3 className="text-xl font-bold text-white tracking-tight truncate leading-tight">
                                                {profile.nombre}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border leading-none ${badgeConfig.color}`}>
                                                    {badgeConfig.label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bio & Details */}
                                    <div className="space-y-3 px-1">
                                        {profile.bio ? (
                                            <p className="text-zinc-400 text-xs line-clamp-2 italic leading-relaxed">
                                                "{profile.bio}"
                                            </p>
                                        ) : (
                                            <p className="text-zinc-600 text-xs italic">Sin descripción...</p>
                                        )}

                                        <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                                            <Calendar className="w-3 h-3" />
                                            Se unió en {joinedDate}
                                        </div>
                                    </div>
                                </div>

                                {/* Stats Bar - Compact style */}
                                <div className="grid grid-cols-3 bg-[#161616] border-t border-zinc-800/50">
                                    <div className="py-2.5 flex flex-col items-center justify-center border-r border-zinc-800/50 hover:bg-white/5 transition-colors group">
                                        {isLoading ? (
                                            <div className="h-5 w-6 bg-zinc-800 rounded animate-pulse mb-1" />
                                        ) : (
                                            <span className="text-base font-black text-zinc-100 group-hover:text-blue-400 transition-colors">
                                                {stats?.messages_count || 0}
                                            </span>
                                        )}
                                        <div className="flex items-center gap-1 text-[8px] text-zinc-500 font-black uppercase tracking-widest">
                                            <MessageCircle className="w-2.5 h-2.5" />
                                            Mensajes
                                        </div>
                                    </div>
                                    <div className="py-2.5 flex flex-col items-center justify-center border-r border-zinc-800/50 hover:bg-white/5 transition-colors group">
                                        {isLoading ? (
                                            <div className="h-5 w-6 bg-zinc-800 rounded animate-pulse mb-1" />
                                        ) : (
                                            <span className="text-base font-black text-zinc-100 group-hover:text-yellow-400 transition-colors">
                                                {stats?.reaction_score || 0}
                                            </span>
                                        )}
                                        <div className="flex items-center gap-1 text-[8px] text-zinc-500 font-black uppercase tracking-widest">
                                            <Star className="w-2.5 h-2.5" />
                                            Score
                                        </div>
                                    </div>
                                    <div className="py-2.5 flex flex-col items-center justify-center hover:bg-white/5 transition-colors group">
                                        <span className="text-base font-black text-zinc-100 group-hover:text-green-400 transition-colors">
                                            {profile.puntos || 0}
                                        </span>
                                        <div className="flex items-center gap-1 text-[8px] text-zinc-500 font-black uppercase tracking-widest">
                                            <Trophy className="w-2.5 h-2.5" />
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
