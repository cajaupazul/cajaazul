'use client';

import React, { useState, useEffect } from 'react';
import { supabase, Profile, getStorageUrl } from '@/lib/supabase';
import { PLACEHOLDERS } from '@/lib/constants';
import { useTheme } from '@/lib/theme-context';
import {
    Plus,
    Search,
    Users,
    Settings,
    X,
    Upload,
    ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/lib/profile-context';
import { uploadFileToR2, deleteFileFromR2 } from '@/lib/r2-storage';

let confetti: any = () => { };
if (typeof window !== 'undefined') {
    confetti = require('canvas-confetti');
}

interface GruposContentProps {
    initialGrupos: any[];
    userGruposIds: string[];
    miembrosCounts: Record<string, number>;
    profile: Profile | null;
    isGuest?: boolean;
}

export default function GruposContent({
    initialGrupos,
    userGruposIds,
    miembrosCounts,
}: GruposContentProps) {
    const router = useRouter();
    const { colors } = useTheme();
    const { profile, isGuest } = useProfile();
    const [grupos, setGrupos] = useState(initialGrupos);
    const [userGrupos, setUserGrupos] = useState<Set<string>>(new Set(userGruposIds));
    const [miembrosCuenta, setMiembrosCuenta] = useState(miembrosCounts);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingGrupo, setEditingGrupo] = useState<any>(null);

    const [formData, setFormData] = useState({
        nombre: '',
        descripcion: '',
        tipo: '',
        link_whatsapp: '',
    });

    // Sincronizar estado local cuando los datos iniciales cambian (desde el contexto global)
    useEffect(() => {
        setGrupos(initialGrupos);
    }, [initialGrupos]);

    useEffect(() => {
        setUserGrupos(new Set(userGruposIds));
    }, [userGruposIds]);

    useEffect(() => {
        setMiembrosCuenta(miembrosCounts);
    }, [miembrosCounts]);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);

    const triggerConfetti = () => {
        const end = Date.now() + 1000;
        const confettiColors = [colors?.primary || '#3b82f6', '#ffffff'];
        (function frame() {
            confetti({ particleCount: 2, angle: 60, spread: 55, origin: { x: 0 }, colors: confettiColors });
            confetti({ particleCount: 2, angle: 120, spread: 55, origin: { x: 1 }, colors: confettiColors });
            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    };

    const handleUnirse = async (e: React.MouseEvent, grupoId: string) => {
        e.preventDefault(); e.stopPropagation();
        if (isGuest) {
            alert('Modo Lectura: Inicia sesión para unirte a grupos.');
            router.push('/auth/login');
            return;
        }
        if (!profile?.id) return;
        try {
            const { error } = await supabase.from('grupo_miembros').insert([{ grupo_id: grupoId, user_id: profile.id }]);
            if (error) throw error;
            setUserGrupos(prev => new Set([...prev, grupoId]));
            setMiembrosCuenta(prev => ({ ...prev, [grupoId]: (prev[grupoId] || 0) + 1 }));
            triggerConfetti();
        } catch (error) { console.error(error); }
    };

    const handleAbandonar = async (e: React.MouseEvent, grupoId: string) => {
        e.preventDefault(); e.stopPropagation();
        if (!profile?.id) return;
        if (!confirm('¿Estás seguro?')) return;
        try {
            const { error } = await supabase.from('grupo_miembros').delete().eq('grupo_id', grupoId).eq('user_id', profile.id);
            if (error) throw error;
            setUserGrupos(prev => { const n = new Set(prev); n.delete(grupoId); return n; });
            setMiembrosCuenta(prev => ({ ...prev, [grupoId]: Math.max(0, (prev[grupoId] || 0) - 1) }));
        } catch (error) { console.error(error); }
    };


    const uploadFile = async (file: File) => {
        if (!file || !profile?.id) return null;

        // Validar que sea imagen
        if (!file.type.startsWith('image/')) {
            alert('Por favor, sube solo archivos de imagen.');
            return null;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${profile.id}/${fileName}`;
        try {
            // USAR R2 STORAGE en lugar de Supabase Storage
            await uploadFileToR2('grupos', filePath, file);
            // Retornamos solo el path para guardarlo en la BD (la URL completa se genera al visualizar)
            return filePath;
        } catch (error) {
            console.error('Error uploading file to R2:', error);
            return null;
        }
    };

    const handleCreateGrupo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nombre || !formData.tipo) return;
        try {
            let logoUrl = editingGrupo?.logo_url;
            let bannerUrl = editingGrupo?.banner_url;

            // Lógica de reemplazo de imágenes (Borrar anterior si existe nueva)
            if (logoFile) {
                if (editingGrupo?.logo_url) {
                    await deleteFileFromR2('grupos', editingGrupo.logo_url);
                }
                setUploadingLogo(true);
                logoUrl = await uploadFile(logoFile);
                setUploadingLogo(false);
            }

            if (bannerFile) {
                if (editingGrupo?.banner_url) {
                    await deleteFileFromR2('grupos', editingGrupo.banner_url);
                }
                setUploadingBanner(true);
                bannerUrl = await uploadFile(bannerFile);
                setUploadingBanner(false);
            }

            const groupData = { ...formData, logo_url: logoUrl, banner_url: bannerUrl };
            if (editingGrupo) {
                await supabase.from('grupos').update(groupData).eq('id', editingGrupo.id);
            } else {
                await supabase.from('grupos').insert([{ ...groupData, created_by: profile?.id }]);
                triggerConfetti();
            }
            setShowModal(false);
            router.refresh();
        } catch (error) { console.error(error); }
    };

    const filteredGrupos = grupos.filter(grupo =>
        grupo.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grupo.tipo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-bb-dark p-4 md:p-8 relative overflow-hidden">
            <div className="max-w-7xl mx-auto relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                        <h1 className="text-3xl md:text-5xl font-black text-bb-text mb-2 tracking-tight flex items-center gap-2 md:gap-3 leading-tight">
                            Grupos <span className="text-blue-400">Universitarios</span>
                        </h1>
                        <p className="text-bb-text-secondary text-sm md:text-lg max-w-xl">Conecta con comunidades lideradas por estudiantes.</p>
                    </motion.div>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        onClick={() => {
                            if (!profile?.es_vip) {
                                alert('Solo los miembros VIP pueden crear nuevos grupos.');
                                return;
                            }
                            setEditingGrupo(null);
                            setFormData({ nombre: '', descripcion: '', tipo: '', link_whatsapp: '' });
                            setShowModal(true);
                        }}
                        className={`flex items-center gap-2 px-6 md:px-8 py-3 md:py-4 rounded-xl font-bold text-white transition-all w-full md:w-auto justify-center ${profile?.es_vip ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-600 hover:bg-gray-500 opacity-80'}`}
                    >
                        <Plus className="w-5 h-5 md:w-6 md:h-6" />
                        {profile?.es_vip ? 'Crear Nuevo Grupo' : 'Crear Grupo (VIP)'}
                    </motion.button>
                </div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 md:mb-10 relative max-w-2xl">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none"><Search className="w-5 h-5 text-bb-text-secondary" /></div>
                    <input
                        type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 md:py-4 rounded-xl bg-bb-card border border-bb-border text-bb-text focus:outline-none transition-all"
                    />
                </motion.div>

                {filteredGrupos.length === 0 ? (
                    <div className="text-center py-20"><Users className="w-16 h-16 text-gray-500 mx-auto mb-6" /><h3 className="text-xl font-bold text-bb-text">Sin grupos</h3></div>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8">
                        <AnimatePresence>
                            {filteredGrupos.map((grupo, index) => {
                                const isUserMember = userGrupos.has(grupo.id);
                                const isAdmin = grupo.created_by === profile?.id;
                                return (
                                    <motion.div key={grupo.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                                        <Link href={`/dashboard/grupos/view?id=${grupo.id}`} className="group block h-full rounded-2xl overflow-hidden bg-bb-card border border-bb-border hover:border-blue-500/30 transition-all shadow-xl relative flex flex-col">
                                            {/* Header Banner - Fixed Height */}
                                            <div className="h-32 md:h-40 relative overflow-hidden bg-[#1e293b]">
                                                {grupo.banner_url && (
                                                    <img
                                                        src={getStorageUrl(grupo.banner_url, 'grupos')}
                                                        alt="Banner"
                                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                    />
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                                                {(grupo.created_by === profile?.id || profile?.role === 'admin' || profile?.role === 'superadmin') && (
                                                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingGrupo(grupo); setFormData({ nombre: grupo.nombre, descripcion: grupo.descripcion || '', tipo: grupo.tipo, link_whatsapp: grupo.link_whatsapp || '' }); setShowModal(true); }} className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-black/80">
                                                        <Settings className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-bold bg-black/60 text-white border border-white/10 backdrop-blur-sm z-20 uppercase tracking-wider">{grupo.tipo}</span>
                                            </div>

                                            {/* Content Body */}
                                            <div className="p-4 md:p-6 relative flex-1 flex flex-col pt-12">
                                                {/* Logo Badge - Floating */}
                                                <div className="absolute -top-10 left-4 md:left-6 w-20 h-20 rounded-2xl border-4 border-bb-card bg-bb-card shadow-lg flex items-center justify-center overflow-hidden z-10">
                                                    {grupo.logo_url ? (
                                                        <img src={getStorageUrl(grupo.logo_url, 'grupos')} className="w-full h-full object-cover bg-bb-dark" />
                                                    ) : (
                                                        <div className="w-full h-full bg-blue-600 flex items-center justify-center text-2xl font-bold text-white">
                                                            {grupo.nombre.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Stats Row */}
                                                <div className="flex justify-end items-center mb-3">
                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-white/5 px-2 py-1 rounded-lg">
                                                        <Users className="w-3.5 h-3.5" />
                                                        {miembrosCuenta[grupo.id] || 0}
                                                        <span className="hidden md:inline ml-1">Miembros</span>
                                                    </div>
                                                </div>

                                                <h3 className="text-lg md:text-xl font-bold mb-2 text-bb-text group-hover:text-blue-400 transition-colors line-clamp-1" title={grupo.nombre}>
                                                    {grupo.nombre}
                                                </h3>

                                                <p className="text-xs md:text-sm text-gray-400 line-clamp-2 mb-6 min-h-[2.5rem] leading-relaxed">
                                                    {grupo.descripcion || 'Sin descripción disponible para este grupo.'}
                                                </p>

                                                <div className="mt-auto pt-4 border-t border-white/5">
                                                    {isUserMember ? (
                                                        <button
                                                            onClick={(e) => handleAbandonar(e, grupo.id)}
                                                            className="w-full py-2.5 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-bold uppercase tracking-wide hover:bg-red-500 hover:text-white transition-all"
                                                        >
                                                            Abandonar
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => handleUnirse(e, grupo.id)}
                                                            className="w-full py-2.5 rounded-xl bg-white text-black font-bold text-xs uppercase tracking-wide hover:bg-gray-200 transition-all shadow-lg flex items-center justify-center gap-2"
                                                        >
                                                            Unirse al Grupo <ArrowRight className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {showModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-[#1a1a1a] rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10 p-6 md:p-8 shadow-2xl">
                            <div className="flex justify-between items-center mb-6 md:mb-8 border-b border-white/5 pb-6 text-white">
                                <h2 className="text-2xl md:text-3xl font-bold">{editingGrupo ? 'Editar Grupo' : 'Crear Comunidad'}</h2>
                                <button onClick={() => setShowModal(false)} className="text-gray-400 p-2 hover:bg-white/5 rounded-lg transition-colors"><X /></button>
                            </div>
                            <form onSubmit={handleCreateGrupo} className="space-y-4 md:space-y-6 text-white">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Nombre del Grupo</label>
                                        <input type="text" placeholder="Ej: Facultad de Ciencias" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} className="w-full bg-black/40 border border-white/10 p-3 rounded-xl focus:border-blue-500/50 transition-all outline-none" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Tipo / Categoría</label>
                                        <input type="text" placeholder="Ej: Académico" value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value })} className="w-full bg-black/40 border border-white/10 p-3 rounded-xl focus:border-blue-500/50 transition-all outline-none" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Descripción</label>
                                    <textarea rows={4} placeholder="Cuéntanos de qué trata el grupo..." value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} className="w-full bg-black/40 border border-white/10 p-3 rounded-xl focus:border-blue-500/50 transition-all outline-none resize-none" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Link de WhatsApp (Opcional)</label>
                                    <input type="url" placeholder="https://chat.whatsapp.com/..." value={formData.link_whatsapp} onChange={e => setFormData({ ...formData, link_whatsapp: e.target.value })} className="w-full bg-black/40 border border-white/10 p-3 rounded-xl focus:border-blue-500/50 transition-all outline-none" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                    <div className="border-2 border-dashed border-white/10 p-4 md:p-6 rounded-xl text-center group hover:border-blue-500/30 transition-all">
                                        <label className="cursor-pointer flex flex-col items-center gap-2">
                                            <Upload className="w-6 h-6 text-gray-400 group-hover:text-blue-400 transition-colors" />
                                            <span className="text-sm font-bold text-gray-400 group-hover:text-bb-text transition-colors">Subir Logo</span>
                                            <input type="file" accept="image/png, image/jpeg, image/jpg, image/webp, image/gif" className="hidden" onChange={e => {
                                                const file = e.target.files?.[0];
                                                setLogoFile(file || null);
                                            }} />
                                            {logoFile && <span className="text-[10px] text-blue-400 font-bold uppercase tracking-tight">{logoFile.name}</span>}
                                        </label>
                                    </div>
                                    <div className="border-2 border-dashed border-white/10 p-4 md:p-6 rounded-xl text-center group hover:border-blue-500/30 transition-all">
                                        <label className="cursor-pointer flex flex-col items-center gap-2">
                                            <Upload className="w-6 h-6 text-gray-400 group-hover:text-blue-400 transition-colors" />
                                            <span className="text-sm font-bold text-gray-400 group-hover:text-bb-text transition-colors">Subir Banner</span>
                                            <input type="file" accept="image/png, image/jpeg, image/jpg, image/webp, image/gif" className="hidden" onChange={e => {
                                                const file = e.target.files?.[0];
                                                setBannerFile(file || null);
                                            }} />
                                            {bannerFile && <span className="text-[10px] text-blue-400 font-bold uppercase tracking-tight">{bannerFile.name}</span>}
                                        </label>
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row justify-end gap-3 md:gap-4 pt-4">
                                    <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl font-bold text-bb-text-secondary hover:text-white transition-colors">Cancelar</button>
                                    <button type="submit" className="bg-blue-600 hover:bg-blue-500 px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all">Guardar Grupo</button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
