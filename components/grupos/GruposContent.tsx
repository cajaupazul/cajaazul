'use client';

import React, { useState } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import {
    Plus,
    Search,
    Users,
    Settings,
    X,
    Upload,
    Loader,
    ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useRouter } from 'next/navigation';

interface GruposContentProps {
    initialGrupos: any[];
    userGruposIds: string[];
    miembrosCounts: Record<string, number>;
    profile: Profile | null;
}

export default function GruposContent({
    initialGrupos,
    userGruposIds,
    miembrosCounts,
    profile
}: GruposContentProps) {
    const { colors } = useTheme();
    const router = useRouter();
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
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${profile.id}/${fileName}`;
        try {
            await supabase.storage.from('grupos').upload(filePath, file);
            const { data } = supabase.storage.from('grupos').getPublicUrl(filePath);
            return data.publicUrl;
        } catch (error) { return null; }
    };

    const handleCreateGrupo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nombre || !formData.tipo) return;
        try {
            let logoUrl = editingGrupo?.logo_url;
            let bannerUrl = editingGrupo?.banner_url;
            if (logoFile) { setUploadingLogo(true); logoUrl = await uploadFile(logoFile); setUploadingLogo(false); }
            if (bannerFile) { setUploadingBanner(true); bannerUrl = await uploadFile(bannerFile); setUploadingBanner(false); }

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
        <div className="min-h-screen bg-bb-dark p-8 relative overflow-hidden">
            <div className="max-w-7xl mx-auto relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                        <h1 className="text-5xl font-black text-bb-text mb-2 tracking-tight flex items-center gap-3">
                            Grupos <span className="text-blue-400">Universitarios</span>
                        </h1>
                        <p className="text-bb-text-secondary text-lg max-w-xl">Conecta con comunidades lideradas por estudiantes.</p>
                    </motion.div>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        onClick={() => { setEditingGrupo(null); setFormData({ nombre: '', descripcion: '', tipo: '', link_whatsapp: '' }); setShowModal(true); }}
                        className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all"
                    >
                        <Plus className="w-6 h-6" /> Crear Nuevo Grupo
                    </motion.button>
                </div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10 relative max-w-2xl">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none"><Search className="w-5 h-5 text-bb-text-secondary" /></div>
                    <input
                        type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 rounded-xl bg-bb-card border border-bb-border text-bb-text focus:outline-none transition-all"
                    />
                </motion.div>

                {filteredGrupos.length === 0 ? (
                    <div className="text-center py-20"><Users className="w-16 h-16 text-gray-500 mx-auto mb-6" /><h3 className="text-xl font-bold text-white">Sin grupos</h3></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <AnimatePresence>
                            {filteredGrupos.map((grupo, index) => {
                                const isUserMember = userGrupos.has(grupo.id);
                                const isAdmin = grupo.created_by === profile?.id;
                                return (
                                    <motion.div key={grupo.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                                        <Link href={`/dashboard/grupos/${grupo.id}`} className="group block h-full rounded-2xl overflow-hidden bg-bb-card border border-bb-border hover:border-blue-500/30 transition-all shadow-xl relative">
                                            <div className="h-40 relative overflow-hidden">
                                                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: grupo.banner_url ? `url(${grupo.banner_url})` : undefined, backgroundColor: '#1e293b' }} />
                                                <div className="absolute inset-0 bg-gradient-to-t from-bb-card to-transparent" />
                                                {isAdmin && (
                                                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingGrupo(grupo); setFormData({ nombre: grupo.nombre, descripcion: grupo.descripcion || '', tipo: grupo.tipo, link_whatsapp: grupo.link_whatsapp || '' }); setShowModal(true); }} className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Settings className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <span className="absolute bottom-4 left-4 px-3 py-1 rounded-full text-xs font-bold bg-black/60 text-white border border-white/10">{grupo.tipo}</span>
                                            </div>
                                            <div className="p-6 pt-12 relative text-white">
                                                <div className="absolute -top-10 left-6 w-20 h-20 rounded-2xl border-4 border-bb-card bg-blue-600 flex items-center justify-center text-2xl font-bold overflow-hidden">
                                                    {grupo.logo_url ? <img src={grupo.logo_url} className="w-full h-full object-cover" /> : grupo.nombre.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex justify-between items-start mb-2 pl-24 text-xs text-gray-400">
                                                    <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {miembrosCuenta[grupo.id] || 0}</div>
                                                </div>
                                                <h3 className="text-xl font-bold mb-2 group-hover:text-blue-400 transition-colors truncate">{grupo.nombre}</h3>
                                                <p className="text-sm text-gray-400 line-clamp-2 mb-6 h-10">{grupo.descripcion || 'Sin descripción.'}</p>
                                                <div className="flex gap-3 mt-auto">
                                                    {isUserMember ? (
                                                        <button onClick={(e) => handleAbandonar(e, grupo.id)} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 text-sm font-semibold">Abandonar</button>
                                                    ) : (
                                                        <button onClick={(e) => handleUnirse(e, grupo.id)} className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2">Unirse <ArrowRight className="w-4 h-4" /></button>
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
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-[#242424] rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10 p-8">
                            <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6 text-white">
                                <h2 className="text-3xl font-bold">{editingGrupo ? 'Editar Grupo' : 'Crear Comunidad'}</h2>
                                <button onClick={() => setShowModal(false)} className="text-gray-400"><X /></button>
                            </div>
                            <form onSubmit={handleCreateGrupo} className="space-y-6 text-white">
                                <div className="grid grid-cols-2 gap-6">
                                    <input type="text" placeholder="Nombre" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} className="bg-black/40 border border-white/10 p-3 rounded-xl" />
                                    <input type="text" placeholder="Tipo" value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value })} className="bg-black/40 border border-white/10 p-3 rounded-xl" />
                                </div>
                                <textarea rows={4} placeholder="Descripción" value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} className="w-full bg-black/40 border border-white/10 p-3 rounded-xl" />
                                <input type="url" placeholder="WhatsApp Link" value={formData.link_whatsapp} onChange={e => setFormData({ ...formData, link_whatsapp: e.target.value })} className="w-full bg-black/40 border border-white/10 p-3 rounded-xl" />
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="border-2 border-dashed border-white/10 p-4 rounded-xl text-center">
                                        <label className="cursor-pointer">Logo<input type="file" className="hidden" onChange={e => setLogoFile(e.target.files?.[0] || null)} /></label>
                                    </div>
                                    <div className="border-2 border-dashed border-white/10 p-4 rounded-xl text-center">
                                        <label className="cursor-pointer">Banner<input type="file" className="hidden" onChange={e => setBannerFile(e.target.files?.[0] || null)} /></label>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-4"><button type="button" onClick={() => setShowModal(false)}>Cancelar</button><button type="submit" className="bg-blue-600 px-8 py-3 rounded-xl font-bold">Guardar</button></div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
