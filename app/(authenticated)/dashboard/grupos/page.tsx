'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';
import { useTheme } from '@/lib/theme-context';
import {
  Plus,
  Search,
  Users,
  Settings,
  X,
  Upload,
  Loader,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

export default function GruposPage() {
  const { profile, loading: profileLoading } = useProfile();
  const { colors } = useTheme();
  const [grupos, setGrupos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState<any>(null);

  // Form State
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

  const [miembrosCuenta, setMiembrosCuenta] = useState<Record<string, number>>({});
  const [userGrupos, setUserGrupos] = useState(new Set());

  // Memoized fetch function
  const fetchGrupos = useCallback(async () => {
    try {
      // Only show local loading if we don't have data yet
      // We check the current state implicitly without making it a dependency of the callback
      setLoading(prevLoading => {
        // This is a pattern to access current state without adding it to dependencies
        // but since we want to skip if already loaded, we can just check 'grupos' 
        // inside the function if we use a Ref or just accept it's fast.
        return true;
      });

      const { data, error } = await supabase
        .from('grupos')
        .select(`
          *,
          grupo_miembros(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setGrupos(data || []);

      const counts: Record<string, number> = {};
      data?.forEach(grupo => {
        counts[grupo.id] = grupo.grupo_miembros?.[0]?.count || 0;
      });
      setMiembrosCuenta(counts);
    } catch (error) {
      console.error('Error cargando grupos:', error);
    } finally {
      setLoading(false);
    }
  }, []); // Remove dependency on grupos.length to avoid infinite loops

  const fetchUserGrupos = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('grupo_miembros')
        .select('grupo_id')
        .eq('user_id', profile.id);

      if (error) throw error;
      setUserGrupos(new Set(data?.map(m => m.grupo_id) || []));
    } catch (error) {
      console.error('Error cargando grupos del usuario:', error);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!profileLoading) {
      if (profile) {
        fetchGrupos();
        fetchUserGrupos();
      } else {
        // Optional: Redirect if needed, or handle unauth state
        // router.push('/auth/login');
      }
    }

    // Safety timeout to ensure loading spinner persists no longer than 3s
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timer);
  }, [profile, profileLoading, fetchGrupos, fetchUserGrupos]);

  const triggerConfetti = () => {
    const end = Date.now() + 1000;
    const confettiColors = [colors?.primary || '#3b82f6', '#ffffff'];

    (function frame() {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: confettiColors
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: confettiColors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

  const handleUnirse = async (e: React.MouseEvent, grupoId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('grupo_miembros')
        .insert([{ grupo_id: grupoId, user_id: profile?.id }]);

      if (error) throw error;

      setUserGrupos(prev => new Set([...prev, grupoId]));
      setMiembrosCuenta(prev => ({ ...prev, [grupoId]: (prev[grupoId] || 0) + 1 }));
      triggerConfetti();
    } catch (error) {
      console.error('Error uniéndose al grupo:', error);
    }
  };

  const handleAbandonar = async (e: React.MouseEvent, grupoId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('¿Estás seguro de abandonar este grupo?')) return;

    try {
      const { error } = await supabase
        .from('grupo_miembros')
        .delete()
        .eq('grupo_id', grupoId)
        .eq('user_id', profile?.id);

      if (error) throw error;

      const newUserGrupos = new Set(userGrupos);
      newUserGrupos.delete(grupoId);
      setUserGrupos(newUserGrupos);
      setMiembrosCuenta(prev => ({ ...prev, [grupoId]: Math.max(0, (prev[grupoId] || 0) - 1) }));
    } catch (error) {
      console.error('Error abandonando grupo:', error);
    }
  };

  const uploadFile = async (file: File, tipo: string) => {
    if (!file || !profile?.id) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${profile.id}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('grupos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('grupos').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      console.error(`Error subiendo ${tipo}:`, error);
      return null;
    }
  };

  const handleCreateGrupo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombre || !formData.tipo) {
      alert('Por favor completa los campos requeridos');
      return;
    }

    const grupoExistente = grupos.some(
      g => g.tipo === formData.tipo && g.nombre === formData.nombre && g.id !== editingGrupo?.id
    );

    if (grupoExistente) {
      alert('Ya existe un grupo con este nombre y tipo');
      return;
    }

    try {
      let logoUrl = editingGrupo?.logo_url;
      let bannerUrl = editingGrupo?.banner_url;

      if (logoFile) {
        setUploadingLogo(true);
        logoUrl = await uploadFile(logoFile, 'logo');
        setUploadingLogo(false);
      }

      if (bannerFile) {
        setUploadingBanner(true);
        bannerUrl = await uploadFile(bannerFile, 'banner');
        setUploadingBanner(false);
      }

      const groupData = {
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        tipo: formData.tipo,
        link_whatsapp: formData.link_whatsapp,
        logo_url: logoUrl,
        banner_url: bannerUrl,
      };

      if (editingGrupo) {
        const { error } = await supabase
          .from('grupos')
          .update(groupData)
          .eq('id', editingGrupo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('grupos')
          .insert([{ ...groupData, created_by: profile?.id }]);
        if (error) throw error;
        triggerConfetti();
      }

      setShowModal(false);
      setFormData({ nombre: '', descripcion: '', tipo: '', link_whatsapp: '' });
      setLogoFile(null);
      setBannerFile(null);
      setEditingGrupo(null);
      fetchGrupos();
    } catch (error) {
      console.error('Error operando grupo:', error);
      alert('Ocurrió un error');
    }
  };

  const openEditModal = (e: React.MouseEvent, grupo: any) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingGrupo(grupo);
    setFormData({
      nombre: grupo.nombre,
      descripcion: grupo.descripcion || '',
      tipo: grupo.tipo,
      link_whatsapp: grupo.link_whatsapp || '',
    });
    setShowModal(true);
  };

  const filteredGrupos = grupos.filter(grupo =>
    grupo.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    grupo.tipo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bb-dark">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-t-2" style={{ borderColor: colors?.primary }}></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Users className="w-6 h-6 text-gray-400 opacity-50" />
          </div>
        </div>
        <p className="text-gray-400 mt-4 animate-pulse">Cargando comunidad...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bb-dark p-8 relative overflow-hidden">

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-5xl font-black text-bb-text mb-2 tracking-tight flex items-center gap-3">
              Grupos <span className="text-blue-400">Universitarios</span>
            </h1>
            <p className="text-bb-text-secondary text-lg max-w-xl">
              Conecta, aprende y diviértete. Únete a comunidades lideradas por estudiantes como tú.
            </p>
          </motion.div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setEditingGrupo(null);
              setFormData({ nombre: '', descripcion: '', tipo: '', link_whatsapp: '' });
              setLogoFile(null);
              setBannerFile(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all"
          >
            <Plus className="w-6 h-6" />
            Crear Nuevo Grupo
          </motion.button>
        </div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 relative max-w-2xl"
        >
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-bb-text-secondary" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-bb-card border border-bb-border text-bb-text placeholder:text-bb-text-secondary focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </motion.div>

        {/* Grupos Grid */}
        {filteredGrupos.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="bg-white/5 p-8 rounded-full mb-6">
              <Users className="w-16 h-16 text-gray-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No encontramos grupos</h3>
            <p className="text-gray-400">Sé el primero en crear uno para esta categoría.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence>
              {filteredGrupos.map((grupo, index) => {
                const isUserMember = userGrupos.has(grupo.id);
                const isAdmin = grupo.created_by === profile?.id;

                return (
                  <motion.div
                    key={grupo.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Link
                      href={`/dashboard/grupos/${grupo.id}`}
                      className="group block h-full rounded-2xl overflow-hidden bg-bb-card border border-bb-border hover:border-blue-500/30 transition-all shadow-xl hover:shadow-2xl relative"
                    >
                      {/* Banner Image */}
                      <div className="h-40 relative overflow-hidden">
                        <div
                          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                          style={{
                            backgroundImage: grupo.banner_url ? `url(${grupo.banner_url})` : undefined,
                            backgroundColor: colors?.secondary || '#1e293b'
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-bb-card to-transparent" />

                        {isAdmin && (
                          <button
                            onClick={(e) => openEditModal(e, grupo)}
                            className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        )}

                        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-black/60 backdrop-blur text-white border border-white/10">
                            {grupo.tipo}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-6 pt-12 relative">
                        {/* Logo Floating */}
                        <div className="absolute -top-10 left-6">
                          <motion.div
                            whileHover={{ rotate: 5, scale: 1.1 }}
                            className="w-20 h-20 rounded-2xl border-4 border-bb-card bg-bb-card shadow-lg overflow-hidden flex items-center justify-center text-2xl font-bold text-white"
                            style={{ backgroundColor: grupo.logo_url ? 'transparent' : (colors?.primary || '#3b82f6') }}
                          >
                            {grupo.logo_url ? (
                              <img src={grupo.logo_url} alt={grupo.nombre} className="w-full h-full object-cover" />
                            ) : (
                              grupo.nombre.charAt(0).toUpperCase()
                            )}
                          </motion.div>
                        </div>

                        <div className="flex justify-between items-start mb-2 pl-24">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 bg-white/5 px-2 py-1 rounded-lg">
                            <Users className="w-3.5 h-3.5" />
                            {miembrosCuenta[grupo.id] || 0}
                          </div>
                        </div>

                        <div className="mt-4">
                          <h3 className="text-xl font-bold text-white mb-2 line-clamp-1 group-hover:text-blue-400 transition-colors">
                            {grupo.nombre}
                          </h3>
                          <p className="text-sm text-gray-400 line-clamp-2 mb-6 h-10">
                            {grupo.descripcion || 'Sin descripción disponible.'}
                          </p>

                          <div className="flex gap-3 mt-auto">
                            {isUserMember ? (
                              <button
                                onClick={(e) => handleAbandonar(e, grupo.id)}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 font-semibold transition-all text-sm border border-red-500/20"
                              >
                                Abandonar
                              </button>
                            ) : (
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={(e) => handleUnirse(e, grupo.id)}
                                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2"
                                style={{ backgroundColor: colors?.primary || '#3b82f6' }}
                              >
                                Unirse
                                <ArrowRight className="w-4 h-4 opacity-50" />
                              </motion.button>
                            )}
                          </div>
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

      {/* Modal - Modernized */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#242424] rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
                  <div>
                    <h2 className="text-3xl font-bold text-white">
                      {editingGrupo ? 'Editar Grupo' : 'Crear Comunidad'}
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">Comparte tus intereses con toda la universidad.</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-gray-400 hover:text-white">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleCreateGrupo} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nombre</label>
                      <input
                        type="text"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Ej: Club de Ajedrez"
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Categoría</label>
                      <input
                        type="text"
                        value={formData.tipo}
                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                        placeholder="Ej: Deporte, Arte..."
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Descripción</label>
                    <textarea
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                      placeholder="¿De qué trata este grupo?"
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">WhatsApp / Discord Link</label>
                    <input
                      type="url"
                      value={formData.link_whatsapp}
                      onChange={(e) => setFormData({ ...formData, link_whatsapp: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Logo Upload */}
                    <div className="p-4 rounded-xl border-2 border-dashed border-white/10 hover:border-blue-500/50 transition-colors bg-white/5 text-center">
                      <label className="cursor-pointer block">
                        <span className="block text-xs font-bold text-gray-400 mb-2">LOGO DEL GRUPO</span>
                        <div className="w-16 h-16 mx-auto bg-black/50 rounded-lg flex items-center justify-center mb-2">
                          {logoFile ? <img src={URL.createObjectURL(logoFile)} className="w-full h-full object-cover rounded-lg" /> : <Upload className="text-gray-500" />}
                        </div>
                        <span className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                          {logoFile ? 'Cambiar imagen' : 'Subir imagen'}
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>

                    {/* Banner Upload */}
                    <div className="p-4 rounded-xl border-2 border-dashed border-white/10 hover:border-blue-500/50 transition-colors bg-white/5 text-center">
                      <label className="cursor-pointer block">
                        <span className="block text-xs font-bold text-gray-400 mb-2">PORTADA GRANDE</span>
                        <div className="w-full h-16 mx-auto bg-black/50 rounded-lg flex items-center justify-center mb-2 overflow-hidden">
                          {bannerFile ? <img src={URL.createObjectURL(bannerFile)} className="w-full h-full object-cover" /> : <Upload className="text-gray-500" />}
                        </div>
                        <span className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                          {bannerFile ? 'Cambiar banner' : 'Subir banner'}
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => setBannerFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-4 justify-end pt-6 border-t border-white/10 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:bg-white/5 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={uploadingLogo || uploadingBanner}
                      className="px-8 py-3 rounded-xl font-bold text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: colors?.primary || '#3b82f6' }}
                    >
                      {uploadingLogo || uploadingBanner ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        editingGrupo ? 'Guardar Cambios' : 'Crear Grupo'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div >
  );
}