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
        placement: 'bottom-start',
        strategy: 'fixed',
        middleware: [
            offset(8),
            flip({ padding: 10 }),
            shift({ padding: 10 }),
        ],
        whileElementsMounted: autoUpdate,
    });

    const hover = useHover(context, {
        delay: { open: 200, close: 100 },
        handleClose: safePolygon(),
    });

    const role = useRole(context);
    const { getReferenceProps, getFloatingProps } = useInteractions([hover, role]);

    const stats = statsCache.get(profile.id || '');
    const isLoading = loadingIds.has(profile.id || '');

    const badgeConfig = useMemo(() => {
        if (profile.role === 'admin' || profile.role === 'superadmin') {
            return { label: 'ADMIN', color: 'bg-red-500/20 text-red-500 border-red-500/20' };
        }
        if (profile.es_vip) {
            return { label: 'VIP', color: 'bg-amber-500/20 text-amber-500 border-amber-500/20' };
        }
        return { label: 'USER', color: 'bg-zinc-500/20 text-zinc-500 border-zinc-500/20' };
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

    return (
        <>
            <div
                ref={refs.setReference}
                {...getReferenceProps({
                    onMouseEnter: handleMouseEnter,
                    onMouseLeave: handleMouseLeave
                })}
                className="inline-flex"
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
                            initial={{ opacity: 0, y: 5, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="z-[9999] outline-none"
                        >
                            <div className="w-[320px] bg-zinc-950 rounded-xl border border-zinc-800 shadow-2xl overflow-hidden">
                                {/* Banner Area with Avatar Overhang */}
                                <div className="relative h-[80px]">
                                    <div
                                        className="absolute inset-0 bg-cover bg-center"
                                        style={{
                                            backgroundImage: `url(${profile.background_url ? getStorageUrl(profile.background_url, 'profile-avatars') : PLACEHOLDERS.BACKGROUND})`
                                        }}
                                    >
                                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="absolute top-2 right-2 flex gap-1 z-10">
                                        {profile.link_instagram && (
                                            <a
                                                href={profile.link_instagram}
                                                target="_blank"
                                                className="p-1.5 rounded-full bg-black/30 text-white/70 hover:bg-black/50 hover:text-white transition-colors border border-white/10"
                                            >
                                                <Instagram className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* Content Area */}
                                <div className="px-4 pb-3 relative">
                                    {/* Avatar */}
                                    <div className="absolute -top-10 left-4">
                                        <div className="w-[72px] h-[72px] rounded-xl border-[3px] border-zinc-950 overflow-hidden bg-zinc-900 shadow-lg">
                                            <img
                                                src={getStorageUrl(profile.avatar_url, 'profile-avatars', PLACEHOLDERS.AVATAR)}
                                                alt={profile.nombre}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    </div>

                                    {/* Header Info (Right of Avatar) */}
                                    <div className="pl-[84px] pt-2 min-h-[40px] flex flex-col justify-center">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-white text-sm truncate">
                                                {profile.nombre}
                                            </h3>
                                            <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase border ${badgeConfig.color}`}>
                                                {badgeConfig.label}
                                            </span>
                                        </div>
                                        {profile.bio && (
                                            <p className="text-zinc-400 text-xs line-clamp-1 mt-0.5">
                                                {profile.bio}
                                            </p>
                                        )}
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="mt-4 grid grid-cols-3 gap-2 py-3 border-t border-zinc-800/50">
                                        <div className="text-center">
                                            <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider mb-0.5">Mensajes</div>
                                            <div className="text-white font-bold text-sm flex items-center justify-center gap-1.5">
                                                <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                                                {stats?.messages_count || 0}
                                            </div>
                                        </div>
                                        <div className="text-center border-l border-zinc-800/50">
                                            <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider mb-0.5">Reacción</div>
                                            <div className="text-white font-bold text-sm flex items-center justify-center gap-1.5">
                                                <Star className="w-3.5 h-3.5 text-amber-500" />
                                                {stats?.reaction_score || 0}
                                            </div>
                                        </div>
                                        <div className="text-center border-l border-zinc-800/50">
                                            <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider mb-0.5">Puntos</div>
                                            <div className="text-white font-bold text-sm flex items-center justify-center gap-1.5">
                                                <Trophy className="w-3.5 h-3.5 text-emerald-500" />
                                                {profile.puntos || 0}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
                                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-medium">
                                            <Calendar className="w-3 h-3" />
                                            <span>Se unió en {joinedDate}</span>
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
