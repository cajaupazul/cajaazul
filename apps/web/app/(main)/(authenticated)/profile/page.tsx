'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase, Profile, ShopItem, getStorageUrl } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { useRouter } from 'next/navigation';
import { AvatarWithFrame } from '@/components/ui/AvatarWithFrame';
import { PLACEHOLDERS } from '@/lib/constants';
import {
  Camera,
  Mail,
  Zap,
  Calendar,
  X,
  Award,
  BookOpen,
  Sun,
  Moon,
  Instagram,
  ShieldCheck,
  Trash2,
  Crown,
  MapPin,
  Coins,
  Sparkles,
  ExternalLink,
  Pencil,
  Save,
} from 'lucide-react';
import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';

export default function ProfilePage() {
  const router = useRouter();
  const { colors, themeMode, setThemeMode } = useTheme();
  const { profile: contextProfile, updateProfile } = useProfile();
  const [profile, setProfile] = useState<Profile | null>(contextProfile || null);
  const [loading, setLoading] = useState(!contextProfile);
  const [editing, setEditing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [formData, setFormData] = useState<Partial<Profile>>({});
  const [userEmail, setUserEmail] = useState('');
  const [backgroundImage, setBackgroundImage] = useState('');
  const [equippedFrame, setEquippedFrame] = useState<ShopItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [stagedAvatarUrl, setStagedAvatarUrl] = useState<string | null>(null);
  const [stagedBackgroundUrl, setStagedBackgroundUrl] = useState<string | null>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    fetchUserEmail();

    if (contextProfile) {
      setProfile(contextProfile);
      setFormData(contextProfile);
      if (contextProfile.email) {
        setUserEmail(contextProfile.email);
      }
      if (contextProfile.background_url) {
        setBackgroundImage(contextProfile.background_url);
      }
      setLoading(false);
    }
  }, [contextProfile]);

  useEffect(() => {
    const fetchEquippedFrame = async () => {
      if (!contextProfile?.id || !contextProfile?.active_frame_key) {
        setEquippedFrame(null);
        return;
      }

      const { data, error } = await supabase
        .from('shop_items')
        .select('*')
        .eq('frame_key', contextProfile.active_frame_key)
        .single();

      if (!error && data) {
        setEquippedFrame(data);
      }
    };

    fetchEquippedFrame();
  }, [contextProfile?.active_frame_key, contextProfile?.id]);

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploadingBackground(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `bg-${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `backgrounds/${fileName}`;

      await import('@/lib/r2-storage').then(({ uploadFileToR2 }) =>
        uploadFileToR2('profile-avatars', filePath, file)
      );

      setStagedBackgroundUrl(filePath);
      setBackgroundImage(filePath);
      setFormData(prev => ({ ...prev, background_url: filePath }));
    } catch (error) {
      console.error('Error uploading background:', error);
      alert('Error al subir la imagen de fondo');
    } finally {
      setUploadingBackground(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      await import('@/lib/r2-storage').then(({ uploadFileToR2 }) =>
        uploadFileToR2('profile-avatars', filePath, file)
      );

      setStagedAvatarUrl(filePath);
      setFormData(prev => ({ ...prev, avatar_url: filePath }));
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    try {
      const dataToSave = { ...formData };
      if (dataToSave.link_instagram) {
        let username = dataToSave.link_instagram.trim();
        username = username.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, '');
        username = username.replace(/^@/, '');
        username = username.replace(/\/$/, '');
        dataToSave.link_instagram = `https://instagram.com/${username}`;
      }

      const { error } = await supabase
        .from('profiles')
        .update(dataToSave)
        .eq('id', profile.id);

      if (error) throw error;

      if (profile.avatar_url && dataToSave.avatar_url && profile.avatar_url !== dataToSave.avatar_url) {
        await import('@/lib/r2-storage').then(({ deleteFileFromR2 }) =>
          deleteFileFromR2('profile-avatars', profile.avatar_url!)
        );
      }

      if (profile.background_url && dataToSave.background_url && profile.background_url !== dataToSave.background_url) {
        await import('@/lib/r2-storage').then(({ deleteFileFromR2 }) =>
          deleteFileFromR2('profile-avatars', profile.background_url!)
        );
      }

      setProfile({ ...profile, ...dataToSave });
      updateProfile({ ...profile, ...dataToSave });
      setEditing(false);
      setStagedAvatarUrl(null);
      setStagedBackgroundUrl(null);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleCancel = async () => {
    if (!profile) return;

    const { deleteFileFromR2 } = await import('@/lib/r2-storage');

    if (stagedAvatarUrl && stagedAvatarUrl !== profile.avatar_url) {
      await deleteFileFromR2('profile-avatars', stagedAvatarUrl);
    }

    if (stagedBackgroundUrl && stagedBackgroundUrl !== profile.background_url) {
      await deleteFileFromR2('profile-avatars', stagedBackgroundUrl);
    }

    setEditing(false);
    setFormData(profile);
    setBackgroundImage(profile.background_url || '');
    setStagedAvatarUrl(null);
    setStagedBackgroundUrl(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!profile) return null;

  const isVip = profile.es_vip;
  const isAdmin = profile.role === 'admin' || profile.role === 'superadmin';
  const memberYear = new Date(profile.created_at).getFullYear();
  const achievements = Math.floor(profile.puntos / 50);
  const instagramUsername = profile.link_instagram?.replace(/.*\//, '').replace('@', '') || '';

  return (
    <div className="min-h-screen bg-[#060709] text-[#E1E7EF] selection:bg-blue-500/30">

      {/* ============================================ */}
      {/* 1. EDGE-TO-EDGE BANNER                      */}
      {/* ============================================ */}
      <div className="relative h-48 sm:h-64 md:h-80 w-full overflow-hidden">
        <img
          key={backgroundImage}
          src={getStorageUrl(backgroundImage, 'profile-avatars', PLACEHOLDERS.BACKGROUND)}
          alt="Banner"
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060709] via-transparent to-black/20" />

        {editing && !uploadingBackground && (
          <label className="absolute top-6 right-6 p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 transition-all cursor-pointer z-30">
            <Camera className="w-5 h-5 text-white/70" />
            <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBackgroundUpload} className="hidden" />
          </label>
        )}
      </div>

      {/* ============================================ */}
      {/* 2. MAIN CONTENT AREA (OPEN DESIGN)         */}
      {/* ============================================ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 -mt-20 sm:-mt-24 relative z-10">

        {/* Header Section: Avatar + Name + Core Info */}
        <div className="flex flex-col md:flex-row items-end gap-6 md:gap-8 mb-12">

          {/* Large Avatar Overlay */}
          <div className="relative shrink-0 group">
            <div className="rounded-full ring-[8px] ring-[#060709] bg-[#060709] shadow-2xl">
              <AvatarWithFrame
                size={160}
                avatarUrl={getStorageUrl(formData.avatar_url || profile.avatar_url, 'profile-avatars', PLACEHOLDERS.AVATAR)}
                frameUrl={equippedFrame?.image_url}
                frameScale={equippedFrame?.frame_settings?.profile?.scale}
                offsetX={equippedFrame?.frame_settings?.profile?.x}
                offsetY={equippedFrame?.frame_settings?.profile?.y}
                name={profile.nombre}
                className="hidden sm:block"
              />
              <AvatarWithFrame
                size={120}
                avatarUrl={getStorageUrl(formData.avatar_url || profile.avatar_url, 'profile-avatars', PLACEHOLDERS.AVATAR)}
                frameUrl={equippedFrame?.image_url}
                frameScale={equippedFrame?.frame_settings?.profile?.scale}
                offsetX={equippedFrame?.frame_settings?.profile?.x}
                offsetY={equippedFrame?.frame_settings?.profile?.y}
                name={profile.nombre}
                className="sm:hidden"
              />
            </div>

            {editing && !uploadingAvatar && (
              <label className="absolute bottom-2 right-2 cursor-pointer z-30">
                <div className="p-2.5 rounded-full bg-blue-600 shadow-xl hover:bg-blue-500 transition-all border-4 border-[#060709]">
                  <Camera className="w-4 h-4 text-white" />
                </div>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            )}
          </div>

          {/* Name & Quick Links */}
          <div className="flex-1 pb-2">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                {editing ? (
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre || ''}
                    onChange={handleInputChange}
                    className="bg-white/5 border-b-2 border-white/10 px-0 py-2 text-white text-3xl sm:text-5xl font-black focus:border-blue-500 outline-none w-full max-w-lg transition-all"
                  />
                ) : (
                  <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tighter">
                    {profile.nombre}
                  </h1>
                )}

                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 fill-blue-500/10" />
                  )}
                  {isVip && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-600/20 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                      <Crown className="w-3.5 h-3.5" />
                      VIP Account
                    </div>
                  )}
                </div>
              </div>

              {/* Minimal Info Strips */}
              <div className="flex flex-wrap gap-6 text-xs sm:text-sm font-medium text-white/40">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-white/20" />
                  <span>{userEmail}</span>
                </div>

                {instagramUsername && !editing && (
                  <a
                    href={profile.link_instagram?.startsWith('http') ? profile.link_instagram : `https://instagram.com/${instagramUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-pink-500 transition-colors"
                  >
                    <Instagram className="w-4 h-4 text-white/20" />
                    @{instagramUsername}
                  </a>
                )}

                {profile.monedas > 0 && (
                  <div className="flex items-center gap-2 text-amber-500/80">
                    <Coins className="w-4 h-4" />
                    <span className="font-bold">{profile.monedas} monedas</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-2 shrink-0 self-start md:self-end">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded-full transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Guardar
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-full border border-white/10 transition-all active:scale-95"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="px-6 py-2.5 bg-[#1B1F24] hover:bg-[#252A30] text-white text-xs font-black uppercase tracking-widest rounded-full border border-white/5 transition-all active:scale-95 flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                Personalizar
              </button>
            )}
          </div>
        </div>

        {/* ============================================ */}
        {/* 3. GRID CONTENT: STATS & DETAILS           */}
        {/* ============================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 mb-20">

          {/* Main Column */}
          <div className="lg:col-span-3 space-y-16">

            {/* Stats Strip - No cards, just pure minimalist layout */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border-y border-white/[0.05]">
              <div className="py-8 sm:pr-8 border-b sm:border-b-0 sm:border-r border-white/[0.05]">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500/60 block mb-4">Puntos de Actividad</span>
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-black text-white">{profile.puntos}</span>
                  <Zap className="w-6 h-6 text-blue-500 mb-2" />
                </div>
              </div>
              <div className="py-8 sm:px-8 border-b sm:border-b-0 sm:border-r border-white/[0.05]">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-500/60 block mb-4">Año de Ingreso</span>
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-black text-white">{memberYear}</span>
                  <Calendar className="w-6 h-6 text-teal-500 mb-2" />
                </div>
              </div>
              <div className="py-8 sm:pl-8">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-pink-500/60 block mb-4">Logros Obtenidos</span>
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-black text-white">{achievements}</span>
                  <Award className="w-6 h-6 text-pink-500 mb-2" />
                </div>
              </div>
            </div>

            {/* DESCRIPTION */}
            <section>
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white/20 mb-6 flex items-center gap-2">
                DESCRIPCIÓN
              </h2>
              {editing ? (
                <textarea
                  name="bio"
                  value={formData.bio || ''}
                  onChange={handleInputChange}
                  placeholder="Escribe algo sobre ti..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none min-h-[160px] leading-relaxed transition-all"
                />
              ) : (
                <p className="text-xl sm:text-2xl font-medium text-white/60 leading-relaxed max-w-4xl italic">
                  "{profile.bio || 'Esta sección está esperando por tu gran historia...'}"
                </p>
              )}
            </section>

            {/* ACADEMIC INFO */}
            <section>
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white/20 mb-8">ESPECIFICACIONES ACADÉMICAS</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#52525B]">UNIVERSIDAD</span>
                  <div className="flex items-center gap-4">
                    <MapPin className="w-5 h-5 text-teal-500/50" />
                    <p className="text-lg font-bold text-white">{profile.universidad || 'Pendiente'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#52525B]">FACULTAD / CARRERA</span>
                  <div className="flex items-center gap-4">
                    <BookOpen className="w-5 h-5 text-teal-500/50" />
                    <p className="text-lg font-bold text-white">{profile.carrera || 'No especificado'}</p>
                  </div>
                </div>
              </div>

              {editing && (
                <div className="mt-8">
                  <div className="flex items-center gap-4 border-b border-white/10 py-2 focus-within:border-pink-500 transition-all">
                    <Instagram className="w-5 h-5 text-pink-500/50" />
                    <input
                      type="text"
                      value={formData.link_instagram?.replace('https://instagram.com/', '') || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, link_instagram: e.target.value }))}
                      className="bg-transparent outline-none flex-1 text-white font-medium placeholder-white/10"
                      placeholder="Usuario de Instagram"
                    />
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Sidebar Area - Settings & Appearance */}
          <aside className="space-y-12 border-l border-white/[0.05] pl-8 hidden lg:block">

            {/* Theme Toggle */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white/20">APARIENCIA</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setThemeMode('light')}
                  className={`p-3 rounded-xl border transition-all ${themeMode === 'light' ? 'bg-white text-black border-white' : 'bg-transparent border-white/10 text-white/40 hover:text-white'}`}
                >
                  <Sun className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setThemeMode('dark')}
                  className={`p-3 rounded-xl border transition-all ${themeMode === 'dark' ? 'bg-white text-black border-white' : 'bg-transparent border-white/10 text-white/40 hover:text-white'}`}
                >
                  <Moon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Security/Danger */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-red-500/40">ZONA CRÍTICA</h3>
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                Eliminar Cuenta
              </button>
            </div>

            {/* ID Sync */}
            <div className="pt-12">
              <p className="text-[10px] font-bold text-white/10 uppercase tracking-[0.4em]">
                SYNC: {new Date(profile.updated_at).toLocaleDateString()}
              </p>
              <p className="text-[9px] font-bold text-white/5 uppercase tracking-[0.4em] mt-2">
                ID: {profile.id.substring(0, 16)}...
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* Footer Decoration (Subtle line) */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
