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
    safePolygon,
    Strategy
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
        strategy: 'fixed',
        middleware: [
            offset(6),
            flip({ fallbackAxisSideDirection: 'end', padding: 10 }),
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
                            initial={{ opacity: 0, y: 5, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 5, scale: 0.98 }}
                            transition={{ duration: 0.1, ease: 'easeOut' }}
                            className="z-[9999] outline-none"
                        >
                            <div className="w-[380px] bg-[#0c0c0c] rounded-xl border border-zinc-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto">
                                {/* Main Content Row */}
                                <div className="relative flex h-[100px]">
                                    {/* Cover Background (Left Half / Fixed Width or Full Overlay) */}
                                    <div className="absolute inset-0 z-0">
                                        <div
                                            className="w-full h-full bg-cover bg-center"
                                            style={{
                                                backgroundImage: `url(${profile.background_url ? getStorageUrl(profile.background_url, 'profile-avatars') : PLACEHOLDERS.BACKGROUND})`
                                            }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-r from-[#0c0c0c] via-[#0c0c0c]/40 to-[#0c0c0c]" />
                                    </div>

                                    {/* Avatar Column */}
                                    <div className="relative z-10 pl-3 flex items-center">
                                        <div className="w-[72px] h-[72px] rounded-lg border-2 border-white/5 overflow-hidden bg-zinc-900 shadow-xl flex-shrink-0 ring-1 ring-black">
                                            <img
                                                src={getStorageUrl(profile.avatar_url, 'profile-avatars', PLACEHOLDERS.AVATAR)}
                                                alt={profile.nombre}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    </div>

                                    {/* Info Column */}
                                    <div className="relative z-10 flex-1 px-4 flex flex-col justify-center min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-base font-black text-white tracking-tight truncate leading-tight">
                                                {profile.nombre}
                                            </h3>
                                            <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase border leading-none ${badgeConfig.color}`}>
                                                {badgeConfig.label}
                                            </span>
                                        </div>

                                        {profile.bio && (
                                            <p className="text-zinc-300 text-[10px] line-clamp-2 leading-tight italic opacity-80 mb-1.5">
                                                "{profile.bio}"
                                            </p>
                                        )}

                                        <div className="flex items-center gap-1.5 text-zinc-500 text-[8px] font-bold uppercase tracking-wider">
                                            <Calendar className="w-2.5 h-2.5" />
                                            {joinedDate}
                                        </div>
                                    </div>

                                    {/* Quick Actions (Right Top) */}
                                    <div className="absolute top-2 right-2 flex gap-1 z-20">
                                        {profile.link_instagram && (
                                            <a href={profile.link_instagram} target="_blank" className="p-1 rounded-md bg-black/40 backdrop-blur-md border border-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                                                <Instagram className="w-3 h-3" />
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* Bottom Info / Stats Bar - Ultra Compact */}
                                <div className="flex bg-black/40 border-t border-white/[0.03]">
                                    <div className="flex-1 py-1.5 flex items-center justify-center gap-2 border-r border-white/[0.03] group hover:bg-white/[0.02] transition-colors">
                                        <MessageCircle className="w-2.5 h-2.5 text-blue-500/50 group-hover:text-blue-400" />
                                        <span className="text-[10px] font-black text-zinc-100">{stats?.messages_count || 0}</span>
                                    </div>
                                    <div className="flex-1 py-1.5 flex items-center justify-center gap-2 border-r border-white/[0.03] group hover:bg-white/[0.02] transition-colors">
                                        <Star className="w-2.5 h-2.5 text-yellow-500/50 group-hover:text-yellow-400" />
                                        <span className="text-[10px] font-black text-zinc-100">{stats?.reaction_score || 0}</span>
                                    </div>
                                    <div className="flex-1 py-1.5 flex items-center justify-center gap-2 group hover:bg-white/[0.02] transition-colors">
                                        <Trophy className="w-2.5 h-2.5 text-emerald-500/50 group-hover:text-emerald-400" />
                                        <span className="text-[10px] font-black text-zinc-100">{profile.puntos || 0}</span>
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
