'use client';

import React, { useState, useEffect } from 'react';
import { supabase, Profile, getStorageUrl } from '@/lib/supabase';
import { PLACEHOLDERS } from '@/lib/constants';
import { useTheme } from '@/lib/theme-context';
import {
    ArrowLeft,
    Users,
    MessageCircle,
    Settings,
    Trash2,
    Instagram,
    FileText,
    Upload,
    ExternalLink,
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
    const { colors, themeMode } = useTheme();

    const [activeTab, setActiveTab] = useState<'pizarra' | 'miembros' | 'galeria' | 'recursos'>('pizarra');
    const [miembros, setMiembros] = useState<Miembro[]>(initialMiembros);
    const [isMember, setIsMember] = useState(initialIsMember);
    const [hoveredMiembro, setHoveredMiembro] = useState<string | null>(null);
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        setMiembros(initialMiembros);
        setIsMember(initialIsMember);
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
                .eq('id', grupo.id)
                .eq('user_id', profile?.id);

            if (error) throw error;
            router.refresh();
        } catch (error) {
            console.error('Error abandonando:', error);
        }
    };


    const handleDeleteGrupo = async () => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar este grupo? Esta acción borrará permanentemente todos los datos e imágenes asociados.')) return;

        try {
            // 1. Eliminar archivos del storage si existen
            const filesToDelete = [];
            if (grupo.logo_url && !grupo.logo_url.startsWith('http')) filesToDelete.push(grupo.logo_url);
            if (grupo.banner_url && !grupo.banner_url.startsWith('http')) filesToDelete.push(grupo.banner_url);

            if (filesToDelete.length > 0) {
                console.log('[DELETE_GRUPO] Eliminando archivos del storage:', filesToDelete);
                await supabase.storage.from('grupos').remove(filesToDelete);
            }

            // 2. Eliminar registro del grupo
            const { error } = await supabase
                .from('grupos')
                .delete()
                .eq('id', grupo.id);

            if (error) throw error;
            router.push('/dashboard/grupos');
        } catch (error) {
            console.error('Error eliminando:', error);
            alert('Error al eliminar el grupo. Por favor intenta de nuevo.');
        }
    };

    return (
        <div className={`min-h-screen ${themeMode === 'light' ? 'bg-gray-50 text-gray-900' : 'bg-[#0a0a0a] text-white'}`}>
            {/* Minimalist Header / Banner */}
            <div className="relative h-[30vh] md:h-[45vh] overflow-hidden">
                <div className="absolute inset-0 transition-transform duration-700 hover:scale-105">
                    {grupo.banner_url && (
                        <img
                            src={getStorageUrl(grupo.banner_url, 'grupos')}
                            alt="Banner"
                            className="w-full h-full object-cover"
                        />
                    )}
                    <div
                        className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent"
                        style={{ backgroundColor: !grupo.banner_url ? (colors?.primary + '20') : undefined }}
                    />
                </div>

                <div className="absolute top-0 left-0 right-0 p-4 md:p-8 flex justify-between items-center z-30">
                    <Link
                        href="/dashboard/grupos"
                        className="p-2 md:p-3 rounded-full bg-black/40 hover:bg-black/80 transition-all border border-white/5 backdrop-blur-sm"
                    >
                        <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
                    </Link>

                    {isAdmin && (
                        <Link
                            href={`/dashboard/grupos/edit?id=${grupo.id}`}
                            className="p-2 md:p-3 rounded-full bg-black/40 hover:bg-black/80 transition-all border border-white/5 backdrop-blur-sm text-white"
                        >
                            <Settings className="w-5 h-5 md:w-6 md:h-6" />
                        </Link>
                    )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 z-20">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8">
                        {/* Logo Fluid */}
                        <div
                            className="w-24 h-24 md:w-32 md:h-32 rounded-2xl md:rounded-3xl border-4 border-[#0a0a0a] shadow-2xl flex-shrink-0 flex items-center justify-center text-3xl md:text-5xl font-black transition-all overflow-hidden relative bg-bb-dark"
                            style={{
                                backgroundColor: colors?.primary,
                                boxShadow: `0 20px 50px ${colors?.primary}40`
                            }}
                        >
                            {grupo.logo_url ? (
                                <img
                                    src={getStorageUrl(grupo.logo_url, 'grupos')}
                                    alt={grupo.nombre}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                grupo.nombre.charAt(0).toUpperCase()
                            )}
                        </div>

                        <div className="text-center md:text-left flex-1 min-w-0 pb-2">
                            <h1 className="text-3xl md:text-5xl font-black mb-2 tracking-tight truncate w-full shadow-black drop-shadow-lg">
                                {grupo.nombre}
                            </h1>
                            <div className="flex items-center justify-center md:justify-start gap-3 opacity-90">
                                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">{grupo.tipo}</span>
                                <span className="text-[10px] md:text-xs font-bold bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-1">
                                    <Users className="w-3 h-3" /> {miembros.length} Miembros
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabbed Navigation Minimalist & Sticky Actions */}
            <div className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-colors duration-300 ${themeMode === 'light' ? 'bg-white/80 border-gray-200' : 'bg-[#0a0a0a]/80 border-white/5'}`}>
                <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between gap-4">
                    <div className="flex overflow-x-auto no-scrollbar gap-6 md:gap-8">
                        {[
                            { id: 'pizarra', label: 'Pizarra' },
                            { id: 'miembros', label: 'Miembros' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`py-4 md:py-5 text-xs md:text-sm font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${activeTab === tab.id
                                    ? (themeMode === 'light' ? 'border-blue-600 text-blue-600' : 'border-white text-white')
                                    : (themeMode === 'light' ? 'border-transparent text-gray-400 hover:text-gray-600' : 'border-transparent text-white/40 hover:text-white/70')
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Actions moved here */}
                    <div className="flex items-center gap-2 md:gap-3 py-2">
                        {isMember && grupo.link_whatsapp && (
                            <a
                                href={grupo.link_whatsapp}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 md:p-2.5 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-all shadow-lg hover:shadow-green-500/20"
                                title="WhatsApp Group"
                            >
                                <MessageCircle className="w-4 h-4 md:w-5 md:h-5" />
                            </a>
                        )}

                        {isMember ? (
                            <button
                                onClick={handleAbandonar}
                                className="px-4 md:px-6 py-2 md:py-2.5 rounded-xl border border-red-500/20 text-red-500 bg-red-500/5 hover:bg-red-500 hover:text-white font-bold transition-all text-xs uppercase tracking-wide"
                            >
                                Abandonar
                            </button>
                        ) : (
                            <button
                                onClick={handleUnirse}
                                className={`px-5 md:px-8 py-2 md:py-2.5 rounded-xl font-bold transition-all text-xs uppercase tracking-wide shadow-lg ${themeMode === 'light' ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-600/30' : 'bg-white text-black hover:bg-gray-200 hover:shadow-white/20'}`}
                            >
                                Unirse
                            </button>
                        )}
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
                                <p className={`text-base md:text-lg leading-relaxed font-medium whitespace-pre-wrap break-all md:break-words ${themeMode === 'light' ? 'text-gray-600' : 'text-white/70'}`}>
                                    {grupo.descripcion || 'Sin descripción disponible.'}
                                </p>
                            </section>

                            <section className={`${themeMode === 'light' ? 'bg-white border-gray-100' : 'bg-white/5 border-white/5'} rounded-3xl p-8 border`}>
                                <h3 className="text-sm font-black text-blue-500 uppercase tracking-widest mb-6">Detalles Administrativos</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <p className="text-[10px] uppercase font-black opacity-30 tracking-widest mb-1">Fecha de Creación</p>
                                        <p className="text-sm font-bold">
                                            {new Date(grupo.created_at).toLocaleDateString('es-ES', {
                                                year: 'numeric', month: 'long', day: 'numeric',
                                            })}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-black opacity-30 tracking-widest mb-1">Categoría</p>
                                        <p className="text-sm font-bold uppercase">{grupo.tipo}</p>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="space-y-8">
                            <div className="bg-blue-600 rounded-3xl p-8 shadow-2xl shadow-blue-600/10 text-white">
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
                            <div className={`text-center py-20 rounded-3xl border ${themeMode === 'light' ? 'bg-white border-gray-100 text-gray-900' : 'bg-white/5 border-white/5 text-white'}`}>
                                <Users className="w-16 h-16 opacity-20 mx-auto mb-6" />
                                <h3 className="text-xl font-bold mb-2">Contenido Exclusivo</h3>
                                <p className="opacity-50 mb-8 max-w-md mx-auto">Únete al grupo para ver quiénes forman parte de esta comunidad y conectar con ellos.</p>
                                <button
                                    onClick={handleUnirse}
                                    className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${themeMode === 'light' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white text-black hover:bg-gray-200'}`}
                                >
                                    Unirse al Grupo
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                                {miembros.map((miembro) => {
                                    const p = miembro.profile;
                                    const esCreador = grupo.created_by === miembro.user_id;
                                    return (
                                        <div
                                            key={miembro.user_id}
                                            className={`group border rounded-2xl p-4 transition-all duration-300 relative overflow-hidden ${themeMode === 'light' ? 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-lg' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                            onMouseEnter={(e) => handleMiembroHover(e, miembro.user_id)}
                                            onMouseLeave={() => setHoveredMiembro(null)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <Avatar className="w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 border-white/5 group-hover:border-blue-500/50 transition-all">
                                                    <AvatarImage src={getStorageUrl(p?.avatar_url)} />
                                                    <AvatarFallback className="bg-white/10 font-bold">{p?.nombre?.charAt(0).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold truncate">{p?.nombre || 'Usuario'}</p>
                                                        {esCreador && <span className="bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter shrink-0">Admin</span>}
                                                    </div>
                                                    <p className="text-[10px] opacity-40 truncate uppercase font-bold tracking-widest">{p?.carrera || 'Estudiante'}</p>
                                                </div>
                                            </div>

                                            {/* Hover Detail Card */}
                                            {hoveredMiembro === miembro.user_id && (
                                                <div
                                                    className="fixed bg-[#121212] border border-white/10 rounded-[2rem] shadow-[0_30px_100px_rgba(0,0,0,0.8)] z-[100] w-[300px] overflow-hidden animate-in fade-in zoom-in-95 duration-300 hidden md:block text-white"
                                                    style={{ left: `${hoverPosition.x}px`, top: `${hoverPosition.y}px` }}
                                                >
                                                    <div className="h-24 bg-cover bg-center" style={{ backgroundImage: p?.background_url ? `url('${p.background_url}')` : 'none', backgroundColor: colors?.primary + '20' }} />
                                                    <div className="px-6 pb-6 -mt-10 flex flex-col items-center">
                                                        <Avatar className="w-20 h-20 border-4 border-[#121212] shadow-2xl rounded-2xl">
                                                            <AvatarImage src={getStorageUrl(p?.avatar_url)} />
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
                    <div className={`pt-10 border-t flex flex-col md:flex-row justify-between items-center gap-8 gap-y-6 ${themeMode === 'light' ? 'border-gray-100' : 'border-white/5'}`}>
                        <div className="text-center md:text-left">
                            <h4 className="text-lg font-black text-red-500 mb-1 uppercase tracking-tight">Zona de Riesgo</h4>
                            <p className="text-xs opacity-30 font-medium">Como administrador, puedes eliminar este grupo de forma permanente.</p>
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
        </div>
    );
}
