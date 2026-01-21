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

    const [activeTab, setActiveTab] = useState<'pizarra' | 'miembros' | 'galeria' | 'recursos'>('pizarra');
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
        if (window.innerWidth < 768) return; // No hover on mobile
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
        <div className="min-h-screen bg-[#0a0a0a] text-white">
            {/* Minimalist Header / Banner */}
            <div className="relative h-[30vh] md:h-[45vh] overflow-hidden">
                <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
                    style={{
                        backgroundImage: grupo.banner_url ? `url(${grupo.banner_url})` : undefined,
                        backgroundColor: colors?.primary + '20',
                    }}
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />
                </div>

                <div className="absolute top-0 left-0 right-0 p-4 md:p-8 flex justify-between items-center z-30">
                    <Link
                        href="/dashboard/grupos"
                        className="p-2 md:p-3 rounded-full bg-black/40 hover:bg-black/80 transition-all border border-white/5 backdrop-blur-sm"
                    >
                        <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
                    </Link>

                    {isAdmin && (
                        <button
                            onClick={() => setShowEditModal(true)}
                            className="p-2 md:p-3 rounded-full bg-black/40 hover:bg-black/80 transition-all border border-white/5 backdrop-blur-sm"
                        >
                            <Settings className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 z-20">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8">
                        {/* Logo Fluid */}
                        <div
                            className="w-24 h-24 md:w-40 md:h-40 rounded-2xl md:rounded-3xl border-4 border-[#0a0a0a] shadow-2xl flex-shrink-0 bg-cover bg-center flex items-center justify-center text-3xl md:text-5xl font-black transition-all"
                            style={{
                                backgroundImage: grupo.logo_url ? `url(${grupo.logo_url})` : undefined,
                                backgroundColor: colors?.primary,
                                boxShadow: `0 20px 50px ${colors?.primary}40`
                            }}
                        >
                            {!grupo.logo_url && grupo.nombre.charAt(0).toUpperCase()}
                        </div>

                        <div className="text-center md:text-left flex-1 min-w-0">
                            <h1 className="text-3xl md:text-6xl font-black mb-2 tracking-tight truncate w-full">
                                {grupo.nombre}
                            </h1>
                            <div className="flex items-center justify-center md:justify-start gap-3 opacity-70">
                                <span className="text-xs md:text-sm font-black uppercase tracking-[0.2em]">{grupo.tipo}</span>
                                <span className="w-1 h-1 bg-white rounded-full" />
                                <span className="text-xs md:text-sm font-bold">{miembros.length} Miembros</span>
                            </div>
                        </div>

                        <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
                            {isMember ? (
                                <button
                                    onClick={handleAbandonar}
                                    className="flex-1 md:flex-initial px-8 py-3 rounded-xl border border-white/10 hover:bg-white/5 font-bold transition-all text-sm md:text-base whitespace-nowrap"
                                >
                                    Abandonar
                                </button>
                            ) : (
                                <button
                                    onClick={handleUnirse}
                                    className="flex-1 md:flex-initial px-10 py-3 rounded-xl font-bold bg-white text-black hover:bg-gray-200 transition-all text-sm md:text-base shadow-xl"
                                >
                                    Unirse
                                </button>
                            )}
                            {isMember && grupo.link_whatsapp && (
                                <a
                                    href={grupo.link_whatsapp}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-3 rounded-xl bg-green-500 hover:bg-green-600 transition-all shadow-lg"
                                >
                                    <MessageCircle className="w-6 h-6 text-white" />
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabbed Navigation Minimalist */}
            <div className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 md:px-8">
                    <div className="flex overflow-x-auto no-scrollbar gap-6 md:gap-12">
                        {[
                            { id: 'pizarra', label: 'Pizarra', icon: Users },
                            { id: 'miembros', label: 'Miembros', icon: Users },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`py-4 md:py-6 text-xs md:text-sm font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${activeTab === tab.id ? 'border-white text-white opacity-100' : 'border-transparent text-white/40 hover:text-white/70'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16">
                {/* Tab Content */}
                {activeTab === 'pizarra' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="lg:col-span-2 space-y-12">
                            <section>
                                <h2 className="text-xl md:text-2xl font-black mb-6 flex items-center gap-3">
                                    <span className="w-2 h-8 bg-blue-600 rounded-full" />
                                    SOBRE ESTE GRUPO
                                </h2>
                                <p className="text-base md:text-lg text-white/70 leading-relaxed font-medium whitespace-pre-wrap break-all md:break-words">
                                    {grupo.descripcion || 'Sin descripción disponible.'}
                                </p>
                            </section>

                            <section className="bg-white/5 rounded-3xl p-8 border border-white/5">
                                <h3 className="text-sm font-black text-blue-500 uppercase tracking-widest mb-6">Detalles Administrativos</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <p className="text-[10px] uppercase font-black text-white/30 tracking-widest mb-1">Fecha de Creación</p>
                                        <p className="text-sm font-bold">
                                            {new Date(grupo.created_at).toLocaleDateString('es-ES', {
                                                year: 'numeric', month: 'long', day: 'numeric',
                                            })}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-black text-white/30 tracking-widest mb-1">Categoría</p>
                                        <p className="text-sm font-bold uppercase">{grupo.tipo}</p>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="space-y-8">
                            <div className="bg-blue-600 rounded-3xl p-8 shadow-2xl shadow-blue-600/10">
                                <h3 className="text-xl font-black mb-4">¿Quieres unirte?</h3>
                                <p className="text-sm font-medium mb-6 opacity-80">Conecta con tus compañeros y accede a contenido exclusivo para miembros.</p>
                                {!isMember && (
                                    <button
                                        onClick={handleUnirse}
                                        className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-100 transition-all shadow-xl"
                                    >
                                        Unirse Ahora
                                    </button>
                                )}
                                {isMember && (
                                    <div className="space-y-3">
                                        <p className="text-[10px] uppercase font-black tracking-widest text-center py-2 bg-black/20 rounded-lg">Ya eres parte del equipo</p>
                                        {grupo.link_whatsapp && (
                                            <a href={grupo.link_whatsapp} target="_blank" rel="noopener noreferrer" className="block w-full py-4 bg-green-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-green-600 transition-all text-center shadow-lg">
                                                WhatsApp Chat
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'miembros' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-xl md:text-2xl font-black mb-8 flex items-center gap-3">
                            <span className="w-2 h-8 bg-emerald-600 rounded-full" />
                            COMUNIDAD ({miembros.length})
                        </h2>

                        {!isMember ? (
                            <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/5">
                                <Users className="w-16 h-16 text-white/20 mx-auto mb-6" />
                                <h3 className="text-xl font-bold mb-2">Contenido Exclusivo</h3>
                                <p className="text-white/50 mb-8 max-w-md mx-auto">Únete al grupo para ver quiénes forman parte de esta comunidad y conectar con ellos.</p>
                                <button
                                    onClick={handleUnirse}
                                    className="px-8 py-3 bg-white text-black rounded-xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all"
                                >
                                    Unirse al Grupo
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                                {miembros.map((miembro) => {
                                    const esAdmin = grupo.created_by === miembro.user_id;
                                    const p = miembro.profile;
                                    return (
                                        <div
                                            key={miembro.user_id}
                                            className="group bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl p-4 transition-all duration-300 relative overflow-hidden"
                                            onMouseEnter={(e) => handleMiembroHover(e, miembro.user_id)}
                                            onMouseLeave={() => setHoveredMiembro(null)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <Avatar className="w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 border-white/5 group-hover:border-blue-500/50 transition-all">
                                                    <AvatarImage src={p?.avatar_url || ''} />
                                                    <AvatarFallback className="bg-white/10 font-bold">{p?.nombre?.charAt(0).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold truncate">{p?.nombre || 'Usuario'}</p>
                                                        {esAdmin && <span className="bg-blue-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter shrink-0">Admin</span>}
                                                    </div>
                                                    <p className="text-[10px] text-white/40 truncate uppercase font-bold tracking-widest">{p?.carrera || 'Estudiante'}</p>
                                                </div>
                                            </div>

                                            {/* Hover Detail Card Mobile Fallback / Style */}
                                            {hoveredMiembro === miembro.user_id && (
                                                <div
                                                    className="fixed bg-[#121212] border border-white/10 rounded-[2rem] shadow-[0_30px_100px_rgba(0,0,0,0.8)] z-[100] w-[300px] overflow-hidden animate-in fade-in zoom-in-95 duration-300 hidden md:block"
                                                    style={{ left: `${hoverPosition.x}px`, top: `${hoverPosition.y}px` }}
                                                >
                                                    <div className="h-24 bg-cover bg-center" style={{ backgroundImage: p?.background_url ? `url('${p.background_url}')` : 'none', backgroundColor: colors?.primary + '20' }} />
                                                    <div className="px-6 pb-6 -mt-10 flex flex-col items-center">
                                                        <Avatar className="w-20 h-20 border-4 border-[#121212] shadow-2xl rounded-2xl">
                                                            <AvatarImage src={p?.avatar_url || ''} />
                                                            <AvatarFallback className="text-2xl font-black">{p?.nombre?.charAt(0).toUpperCase()}</AvatarFallback>
                                                        </Avatar>
                                                        <h4 className="mt-4 font-black text-lg text-center tracking-tight truncate w-full">{p?.nombre}</h4>
                                                        <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest mb-4">{p?.carrera || 'Miembro'}</p>
                                                        {p?.bio && <p className="text-xs text-center text-white/50 leading-tight italic line-clamp-3 mb-4 px-2">"{p.bio}"</p>}
                                                        <div className="flex gap-4 opacity-50">
                                                            {p?.link_instagram && <Instagram className="w-4 h-4 cursor-pointer hover:text-pink-500 transition-colors" />}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Admin Delete Section (Solo visible en Pizarrra para Admin) */}
            {isAdmin && activeTab === 'pizarra' && (
                <div className="max-w-7xl mx-auto px-4 md:px-8 pb-20">
                    <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 gap-y-6">
                        <div className="text-center md:text-left">
                            <h4 className="text-lg font-black text-red-500 mb-1 uppercase tracking-tight">Zona de Riesgo</h4>
                            <p className="text-xs text-white/30 font-medium">Como administrador, puedes eliminar este grupo de forma permanente.</p>
                        </div>
                        <button
                            onClick={handleDeleteGrupo}
                            className="w-full md:w-auto px-8 py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-red-500 hover:text-white transition-all"
                        >
                            Eliminar Grupo
                        </button>
                    </div>
                </div>
            )}

            {/* Edit Modal (Manteniendo funcionalidad original) */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                    <div className="bg-[#121212] rounded-[2rem] w-full max-w-md border border-white/10 shadow-3xl p-8 animate-in zoom-in-95 duration-300">
                        <h2 className="text-2xl font-black mb-6 uppercase tracking-tighter">Ajustes del Grupo</h2>
                        <div className="mb-8">
                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2 px-1">Enlace de WhatsApp</label>
                            <input
                                type="url"
                                value={editData.link_whatsapp}
                                onChange={(e) => setEditData({ ...editData, link_whatsapp: e.target.value })}
                                placeholder="https://chat.whatsapp.com/..."
                                className="w-full px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500 transition-all text-sm"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowEditModal(false)} className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-white/40 font-bold hover:text-white/70 transition-all text-sm">Cancelar</button>
                            <button onClick={handleUpdateWhatsapp} className="flex-1 px-4 py-3 rounded-xl bg-white text-black font-black uppercase tracking-widest text-xs shadow-xl shadow-white/10 hover:bg-gray-200 transition-all">Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
