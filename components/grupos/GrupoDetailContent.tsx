'use client';

import React, { useState, useEffect } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import {
    ArrowLeft,
    Users,
    MessageCircle,
    Settings,
    Trash2,
    Instagram,
} from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';

interface Miembro {
    user_id: string;
    joined_at: string;
    profile: Profile | null;
}

interface GrupoDetailContentProps {
    grupo: any;
    initialMiembros: Miembro[];
    initialIsMember: boolean;
    isAdmin: boolean;
    profile: Profile | null;
}

export default function GrupoDetailContent({
    grupo,
    initialMiembros,
    initialIsMember,
    isAdmin,
    profile,
}: GrupoDetailContentProps) {
    const router = useRouter();
    const { colors } = useTheme();

    const [miembros, setMiembros] = useState<Miembro[]>(initialMiembros);
    const [isMember, setIsMember] = useState(initialIsMember);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editData, setEditData] = useState({ link_whatsapp: grupo.link_whatsapp || '' });
    const [hoveredMiembro, setHoveredMiembro] = useState<string | null>(null);
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        setMiembros(initialMiembros);
        setIsMember(initialIsMember);
        setEditData({ link_whatsapp: grupo.link_whatsapp || '' });
    }, [initialMiembros, initialIsMember, grupo]);

    const handleMiembroHover = (e: React.MouseEvent<HTMLElement>, userId: string) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const cardWidth = 320;
        const cardHeight = 280;

        let x = rect.right + 10;
        let y = rect.top;

        if (x + cardWidth > viewportWidth) {
            x = rect.left - cardWidth - 10;
        }

        if (y + cardHeight > window.innerHeight) {
            y = window.innerHeight - cardHeight - 20;
        }

        setHoveredMiembro(userId);
        setHoverPosition({ x, y });
    };

    const handleUnirse = async () => {
        try {
            const { error } = await supabase
                .from('grupo_miembros')
                .insert([{ grupo_id: grupo.id, user_id: profile?.id }]);

            if (error) throw error;
            router.refresh();
        } catch (error) {
            console.error('Error uniéndose:', error);
        }
    };

    const handleAbandonar = async () => {
        try {
            const { error } = await supabase
                .from('grupo_miembros')
                .delete()
                .eq('grupo_id', grupo.id)
                .eq('user_id', profile?.id);

            if (error) throw error;
            router.refresh();
        } catch (error) {
            console.error('Error abandonando:', error);
        }
    };

    const handleUpdateWhatsapp = async () => {
        try {
            const { error } = await supabase
                .from('grupos')
                .update({ link_whatsapp: editData.link_whatsapp })
                .eq('id', grupo.id);

            if (error) throw error;
            setShowEditModal(false);
            router.refresh();
        } catch (error) {
            console.error('Error actualizando:', error);
        }
    };

    const handleDeleteGrupo = async () => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este grupo?')) {
            try {
                const { error } = await supabase
                    .from('grupos')
                    .delete()
                    .eq('id', grupo.id);

                if (error) throw error;
                router.push('/dashboard/grupos');
            } catch (error) {
                console.error('Error eliminando:', error);
            }
        }
    };

    return (
        <div className="min-h-screen bg-bb-dark">
            <div
                className="relative h-64 bg-gradient-to-r"
                style={{
                    backgroundImage: grupo.banner_url ? `url(${grupo.banner_url})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: colors?.primary + '40',
                }}
            >
                <Link
                    href="/dashboard/grupos"
                    className="absolute top-6 left-6 p-2 rounded-lg bg-black bg-opacity-50 hover:bg-opacity-70 transition-all"
                >
                    <ArrowLeft className="w-6 h-6 text-white" />
                </Link>

                {isAdmin && (
                    <button
                        onClick={() => setShowEditModal(true)}
                        className="absolute top-6 right-6 p-2 rounded-lg bg-black bg-opacity-50 hover:bg-opacity-70 transition-all"
                    >
                        <Settings className="w-6 h-6 text-white" />
                    </button>
                )}
            </div>

            <div className="max-w-7xl mx-auto px-6 pb-12">
                <div className="flex flex-col md:flex-row gap-8 -mt-20 relative z-10 mb-12">
                    <div className="flex-1">
                        <div className="flex gap-6 items-start">
                            <div
                                className="w-32 h-32 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0 border-4 border-bb-dark shadow-xl"
                                style={{
                                    backgroundImage: grupo.logo_url ? `url(${grupo.logo_url})` : undefined,
                                    backgroundSize: 'cover',
                                    backgroundColor: colors?.primary,
                                }}
                            >
                                {!grupo.logo_url && grupo.nombre.charAt(0).toUpperCase()}
                            </div>

                            <div className="flex-1 pt-4">
                                <h1 className="text-4xl font-bold text-white mb-2 shadow-sm">{grupo.nombre}</h1>
                                <p className="text-lg text-gray-200 mb-4 font-medium">{grupo.tipo}</p>
                                {grupo.descripcion && (
                                    <p className="text-gray-100 text-base leading-relaxed line-clamp-3 font-medium">{grupo.descripcion}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        {isMember ? (
                            <>
                                {grupo.link_whatsapp && (
                                    <a
                                        href={grupo.link_whatsapp}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold transition-all w-full md:w-auto"
                                    >
                                        <MessageCircle className="w-5 h-5" />
                                        <span>Ir a WhatsApp</span>
                                    </a>
                                )}
                                <button
                                    onClick={handleAbandonar}
                                    className="px-6 py-3 rounded-lg bg-red-500 bg-opacity-20 hover:bg-opacity-30 text-red-400 font-semibold transition-all"
                                >
                                    Abandonar Grupo
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleUnirse}
                                className="px-6 py-3 rounded-lg text-white font-semibold transition-all"
                                style={{ backgroundColor: colors?.primary }}
                            >
                                Unirse al Grupo
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 order-2 lg:order-2">
                        <div className="bg-bb-card rounded-xl p-6 border border-bb-border">
                            <div className="flex items-center gap-2 mb-6">
                                <Users className="w-5 h-5" style={{ color: colors?.primary }} />
                                <h2 className="text-xl font-bold text-bb-text">Miembros ({miembros.length})</h2>
                            </div>

                            <div className="space-y-4 max-h-96 overflow-y-auto">
                                {miembros.map((miembro) => {
                                    const esAdmin = grupo.created_by === miembro.user_id;
                                    const miembroProfile = miembro.profile;

                                    return (
                                        <div key={miembro.user_id} className="relative">
                                            <div
                                                className="flex items-center justify-between p-3 rounded-lg hover:bg-bb-hover transition-all cursor-pointer"
                                                onMouseEnter={(e) => handleMiembroHover(e, miembro.user_id)}
                                                onMouseLeave={() => setHoveredMiembro(null)}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <Avatar className="w-10 h-10 flex-shrink-0">
                                                        <AvatarImage src={miembroProfile?.avatar_url || ''} alt={miembroProfile?.nombre || 'Usuario'} />
                                                        <AvatarFallback style={{ backgroundColor: colors?.primary }}>
                                                            {miembroProfile?.nombre?.charAt(0).toUpperCase() || 'U'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-bb-text truncate">{miembroProfile?.nombre || 'Usuario'}</p>
                                                        {esAdmin && <span className="text-xs text-blue-400 font-semibold">Admin</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            {hoveredMiembro === miembro.user_id && (
                                                <div
                                                    className="fixed bg-bb-card border border-bb-border rounded-xl shadow-2xl z-50 w-64 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                                                    style={{
                                                        left: `${hoverPosition.x + 20}px`,
                                                        top: `${hoverPosition.y}px`,
                                                    }}
                                                >
                                                    <div
                                                        className="h-20 bg-cover bg-center relative"
                                                        style={{
                                                            backgroundImage: miembroProfile?.background_url
                                                                ? `url('${miembroProfile.background_url}')`
                                                                : `linear-gradient(135deg, ${colors?.primary}40, ${colors?.secondary}40)`,
                                                            backgroundColor: colors?.primary + '20',
                                                        }}
                                                    >
                                                        <div className="absolute inset-0 bg-gradient-to-t from-bb-card/80 to-transparent"></div>
                                                    </div>

                                                    <div className="px-4 pb-4 relative">
                                                        <div className="flex flex-col items-center -mt-10">
                                                            <Avatar className="w-20 h-20 ring-4 ring-bb-card shadow-lg">
                                                                <AvatarImage src={miembroProfile?.avatar_url || ''} alt={miembroProfile?.nombre || 'Usuario'} />
                                                                <AvatarFallback style={{ backgroundColor: colors?.primary }}>
                                                                    {miembroProfile?.nombre?.charAt(0).toUpperCase() || 'U'}
                                                                </AvatarFallback>
                                                            </Avatar>

                                                            <div className="text-center mt-2 w-full">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <h3 className="text-lg font-bold text-bb-text truncate leading-tight">{miembroProfile?.nombre || 'Usuario'}</h3>
                                                                    {miembroProfile?.link_instagram && (
                                                                        <a
                                                                            href={miembroProfile.link_instagram.startsWith('http') ? miembroProfile.link_instagram : `https://instagram.com/${miembroProfile.link_instagram}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex-shrink-0 hover:scale-110 transition-transform"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <Instagram className="w-4 h-4 text-pink-500" />
                                                                        </a>
                                                                    )}
                                                                </div>
                                                                {miembroProfile?.carrera && (
                                                                    <p className="text-xs text-bb-text-secondary mt-0.5 truncate">{miembroProfile.carrera}</p>
                                                                )}
                                                                {esAdmin && (
                                                                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                                        Administrador
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {miembroProfile?.bio && (
                                                            <div className="mt-3 pt-3 border-t border-bb-border">
                                                                <p className="text-xs text-bb-text-secondary italic line-clamp-2 text-center">
                                                                    "{miembroProfile.bio}"
                                                                </p>
                                                            </div>
                                                        )}

                                                        <div className="mt-3 flex justify-between items-center text-[10px] text-bb-text-secondary opacity-70">
                                                            <span>Se unió</span>
                                                            <span>
                                                                {new Date(miembro.joined_at).toLocaleDateString('es-ES', {
                                                                    month: 'short',
                                                                    year: 'numeric'
                                                                })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2 order-1 lg:order-1">
                        <div className="bg-bb-card rounded-xl p-6 border border-bb-border">
                            <h2 className="text-xl font-bold text-bb-text mb-4">Detalles del Grupo</h2>

                            <div className="space-y-6">
                                <div>
                                    <p className="text-sm text-bb-text-secondary mb-2">Tipo de Grupo</p>
                                    <p className="text-lg text-bb-text font-semibold">{grupo.tipo}</p>
                                </div>

                                <div>
                                    <p className="text-sm text-bb-text-secondary mb-2">Creado el</p>
                                    <p className="text-bb-text">
                                        {new Date(grupo.created_at).toLocaleDateString('es-ES', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </p>
                                </div>

                                {grupo.link_whatsapp && (
                                    <div>
                                        <p className="text-sm text-bb-text-secondary mb-2">Grupo de WhatsApp</p>
                                        <a
                                            href={grupo.link_whatsapp}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-green-400 hover:text-green-300 break-all"
                                        >
                                            {grupo.link_whatsapp}
                                        </a>
                                    </div>
                                )}

                                {isAdmin && (
                                    <div className="pt-6 border-t border-bb-border">
                                        <button
                                            onClick={() => setShowEditModal(true)}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-all mb-3"
                                        >
                                            <Settings className="w-4 h-4" />
                                            Editar Link WhatsApp
                                        </button>
                                        <button
                                            onClick={handleDeleteGrupo}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Eliminar Grupo
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showEditModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-bb-card rounded-xl w-full max-w-md border border-bb-border">
                        <div className="p-6">
                            <h2 className="text-2xl font-bold text-bb-text mb-4">Editar Link WhatsApp</h2>

                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-bb-text mb-2">Link de WhatsApp</label>
                                <input
                                    type="url"
                                    value={editData.link_whatsapp}
                                    onChange={(e) => setEditData({ ...editData, link_whatsapp: e.target.value })}
                                    placeholder="https://chat.whatsapp.com/..."
                                    className="w-full px-4 py-2 rounded-lg bg-bb-darker border border-bb-border text-bb-text placeholder:text-bb-text-secondary focus:outline-none focus:border-gray-500"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 px-4 py-2 rounded-lg border border-bb-border text-bb-text-secondary font-semibold hover:border-bb-border/80 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleUpdateWhatsapp}
                                    className="flex-1 px-4 py-2 rounded-lg text-white font-semibold transition-all"
                                    style={{ backgroundColor: colors?.primary }}
                                >
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
