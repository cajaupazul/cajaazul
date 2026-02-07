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
  MapPin,
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

  // Cleanup function removed in favor of direct file deletion

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

  // Fetch equipped frame data
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
      // Ensure full URL for Instagram
      const dataToSave = { ...formData };
      if (dataToSave.link_instagram) {
        let username = dataToSave.link_instagram.trim();
        // Remove common URL prefixes if present to extract the username
        username = username.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, '');
        // Remove @ symbol if present at the start
        username = username.replace(/^@/, '');
        // Remove any trailing slashes
        username = username.replace(/\/$/, '');

        dataToSave.link_instagram = `https://instagram.com/${username}`;
      }

      const { error } = await supabase
        .from('profiles')
        .update(dataToSave)
        .eq('id', profile.id);

      if (error) throw error;

      // Cleanup: Delete OLD files if they were replaced
      // We check if the new URL is different from the original profile URL
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

    // Cleanup: Delete NEWly uploaded files if we cancel
    // Use dynamic import to avoid circular dependencies or heavy initial load
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-faculty-primary"></div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-bb-dark text-bb-text selection:bg-blue-500/30 transition-colors duration-500">
      {/* Background Banner */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden">
        <img
          key={backgroundImage}
          src={getStorageUrl(backgroundImage, 'profile-avatars', PLACEHOLDERS.BACKGROUND)}
          alt="Profile Background"
          className="w-full h-full object-cover opacity-90 transition-opacity duration-700 hover:opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bb-dark via-bb-dark/20 to-transparent" />

        {editing && !uploadingBackground && (
          <label className="absolute top-6 right-6 p-2.5 rounded-xl bg-bb-card/60 hover:bg-bb-card/80 backdrop-blur-md border border-white/10 transition-all cursor-pointer group active:scale-95 z-30">
            <Camera className="w-4 h-4 text-bb-text/70 group-hover:text-bb-text" />
            <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBackgroundUpload} className="hidden" />
          </label>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 relative z-10 pb-20">
        {/* Main Header Card */}
        <div className="bg-bb-card/40 backdrop-blur-3xl border border-bb-border rounded-[2.5rem] p-6 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden relative group transition-all duration-500">
          {/* Subtle accent light */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none transition-opacity duration-500" />

          <div className="flex flex-col md:flex-row items-center md:items-start gap-10 relative z-10 text-center md:text-left">
            {/* Avatar Section */}
            <div className="relative shrink-0">
              <div className="relative p-1.5 rounded-full bg-gradient-to-tr from-blue-500/30 via-transparent to-pink-500/30 shadow-2xl">
                <AvatarWithFrame
                  size={160}
                  avatarUrl={getStorageUrl(formData.avatar_url || profile.avatar_url, 'profile-avatars', PLACEHOLDERS.AVATAR)}
                  frameUrl={equippedFrame?.image_url}
                  frameScale={equippedFrame?.frame_settings?.profile?.scale}
                  offsetX={equippedFrame?.frame_settings?.profile?.x}
                  offsetY={equippedFrame?.frame_settings?.profile?.y}
                  name={profile.nombre}
                  className="shadow-2xl"
                />
              </div>

              {editing && !uploadingAvatar && (
                <label className="absolute bottom-4 right-4 cursor-pointer group scale-110">
                  <div className="p-3 rounded-full bg-blue-600 shadow-2xl group-hover:bg-blue-500 transition-all border-4 border-bb-card">
                    <Camera className="w-4 h-4 text-white" />
                  </div>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              )}
            </div>

            {/* Info Section */}
            <div className="flex-1 pt-4">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 mb-8">
                <div>
                  <h1 className="text-4xl md:text-6xl font-black tracking-tight text-bb-text flex items-center justify-center md:justify-start gap-4 mb-3">
                    {editing ? (
                      <input
                        type="text"
                        name="nombre"
                        value={formData.nombre || ''}
                        onChange={handleInputChange}
                        className="bg-bb-card border border-bb-border rounded-2xl px-5 py-2 text-bb-text text-3xl md:text-5xl font-black focus:ring-4 focus:ring-blue-500/20 outline-none w-full transition-all"
                      />
                    ) : (
                      <>
                        <span className="drop-shadow-sm">{profile.nombre}</span>
                        {(profile.role === 'admin' || profile.role === 'superadmin') && (
                          <ShieldCheck className="w-8 h-8 md:w-10 md:h-10 text-blue-400 fill-blue-400/10" />
                        )}
                      </>
                    )}
                  </h1>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-5 text-bb-text-secondary text-sm font-semibold">
                    <span className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-bb-card/50 border border-bb-border">
                      <Mail className="w-4 h-4 text-blue-500/70" />
                      {userEmail}
                    </span>
                    {profile.link_instagram && !editing && (
                      <a
                        href={profile.link_instagram.startsWith('http') ? profile.link_instagram : `https://instagram.com/${profile.link_instagram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-bb-card/50 border border-bb-border hover:bg-pink-500/5 hover:border-pink-500/30 text-bb-text-secondary hover:text-pink-500 transition-all"
                      >
                        <Instagram className="w-4 h-4 text-pink-500" />
                        <span>@{profile.link_instagram.replace(/.*\//, '').replace('@', '')}</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => editing ? handleSave() : setEditing(true)}
                    className="flex-1 md:flex-none px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-blue-500/25 active:scale-95 text-xs"
                  >
                    {editing ? 'Guardar Cambios' : 'Personalizar Perfil'}
                  </button>
                  {editing && (
                    <button
                      onClick={handleCancel}
                      className="px-5 py-3.5 bg-bb-card hover:bg-bb-hover text-bb-text font-bold rounded-2xl border border-bb-border transition-all active:scale-95"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Minimalist Stats Strip */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-12 border-t border-bb-border/50 pt-8 mt-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-bb-text-secondary/50">Puntos</span>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-500/10">
                      <Zap className="w-5 h-5 text-blue-500" />
                    </div>
                    <span className="text-2xl font-black text-bb-text">{profile.puntos}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-bb-text-secondary/50">Miembro</span>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-teal-500/10">
                      <Calendar className="w-5 h-5 text-teal-500" />
                    </div>
                    <span className="text-2xl font-black text-bb-text">{new Date(profile.created_at).getFullYear()}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-bb-text-secondary/50">Logros</span>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-pink-500/10">
                      <Award className="w-5 h-5 text-pink-500" />
                    </div>
                    <span className="text-2xl font-black text-bb-text">{Math.floor(profile.puntos / 50)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Info & Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mt-10">
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-10">
            {/* Bio Section */}
            <div className="bg-bb-card/40 backdrop-blur-xl border border-bb-border rounded-[2rem] p-10 transition-all duration-300">
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-bb-text-secondary/60 mb-8 flex items-center gap-4">
                <span className="w-1.5 h-4 bg-blue-500 rounded-full" />
                Descripción Personal
              </h2>
              {editing ? (
                <textarea
                  name="bio"
                  value={formData.bio || ''}
                  onChange={handleInputChange}
                  placeholder="Escribe algo sobre ti..."
                  className="w-full bg-bb-sidebar/50 border border-bb-border rounded-2xl px-6 py-5 text-bb-text placeholder-bb-text-secondary/30 focus:outline-none focus:ring-4 focus:ring-blue-500/10 resize-none min-h-[160px] text-base leading-relaxed transition-all"
                />
              ) : (
                <p className="text-bb-text-secondary leading-relaxed text-lg font-medium opacity-80">
                  {profile.bio || 'Esta sección está esperando por tu gran historia. Haz clic en "Personalizar Perfil" para empezar.'}
                </p>
              )}
            </div>

            {/* Customization & Settings Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="bg-bb-card/40 backdrop-blur-xl border border-bb-border rounded-[2rem] p-10 transform transition-all hover:scale-[1.01]">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-bb-text-secondary/60 mb-8 flex items-center gap-4">
                  <span className="w-1.5 h-4 bg-pink-500 rounded-full" />
                  Tema & Apariencia
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setThemeMode('light')}
                    className={`flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 transition-all duration-300 ${themeMode === 'light' ? 'bg-blue-600 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.5)] text-white' : 'bg-bb-sidebar/40 border-bb-border text-bb-text-secondary hover:border-bb-text/30 hover:text-bb-text'}`}
                  >
                    <Sun className="w-6 h-6" />
                    <span className="text-xs font-black uppercase tracking-tighter">Claro</span>
                  </button>
                  <button
                    onClick={() => setThemeMode('dark')}
                    className={`flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 transition-all duration-300 ${themeMode === 'dark' ? 'bg-blue-600 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.5)] text-white' : 'bg-bb-sidebar/40 border-bb-border text-bb-text-secondary hover:border-bb-text/30 hover:text-bb-text'}`}
                  >
                    <Moon className="w-6 h-6" />
                    <span className="text-xs font-black uppercase tracking-tighter">Oscuro</span>
                  </button>
                </div>
              </div>

              <div className="bg-red-500/[0.03] backdrop-blur-xl border border-red-500/10 rounded-[2rem] p-10">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-red-500/60 mb-8 flex items-center gap-4">
                  <span className="w-1.5 h-4 bg-red-500 rounded-full" />
                  Zona de Seguridad
                </h2>
                <div className="space-y-4">
                  <p className="text-[10px] text-bb-text-secondary/60 leading-tight">Acciones irreversibles sobre tu cuenta de usuario.</p>
                  <button
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="w-full flex items-center justify-between group p-4 rounded-2xl bg-red-500/5 border border-red-500/20 hover:bg-red-500 hover:border-red-500 transition-all text-red-500 hover:text-white"
                  >
                    <span className="text-xs font-black uppercase tracking-widest">Cerrar Cuenta</span>
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-8">
            <div className="bg-bb-card/40 backdrop-blur-xl border border-bb-border rounded-[2rem] p-10">
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-bb-text-secondary/60 mb-10 flex items-center gap-4">
                <span className="w-1.5 h-4 bg-teal-500 rounded-full" />
                Info Académica
              </h2>

              <div className="space-y-10">
                <div className="group">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-bb-text-secondary/40 block mb-3 transition-colors group-hover:text-bb-text-secondary">Universidad</label>
                  <div className="flex items-center gap-4 text-bb-text">
                    <div className="p-2.5 rounded-xl bg-bb-sidebar/50 border border-bb-border">
                      <MapPin className="w-5 h-5 text-teal-500" />
                    </div>
                    <span className="text-base font-black">{profile.universidad || 'No vinculada'}</span>
                  </div>
                </div>

                <div className="group">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-bb-text-secondary/40 block mb-3 transition-colors group-hover:text-bb-text-secondary">Facultad / Carrera</label>
                  <div className="flex items-center gap-4 text-bb-text">
                    <div className="p-2.5 rounded-xl bg-bb-sidebar/50 border border-bb-border">
                      <BookOpen className="w-5 h-5 text-teal-500" />
                    </div>
                    <span className="text-base font-black truncate">{profile.carrera || 'No especificada'}</span>
                  </div>
                </div>

                <div className="group">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-bb-text-secondary/40 block mb-3 transition-colors group-hover:text-bb-text-secondary">Instagram</label>
                  {editing ? (
                    <div className="flex items-center gap-3 bg-bb-sidebar/50 border border-bb-border rounded-2xl px-4 py-3 text-sm focus-within:ring-2 focus-within:ring-pink-500/20 transition-all">
                      <Instagram className="w-5 h-5 text-pink-500" />
                      <input
                        type="text"
                        value={formData.link_instagram?.replace('https://instagram.com/', '') || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, link_instagram: e.target.value }))}
                        className="bg-transparent outline-none flex-1 text-bb-text font-bold"
                        placeholder="usuario"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 text-bb-text">
                      <div className="p-2.5 rounded-xl bg-bb-sidebar/50 border border-bb-border">
                        <Instagram className="w-5 h-5 text-pink-500" />
                      </div>
                      <span className="text-base font-black truncate">@{profile.link_instagram || '---'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Verification Badge (if applicable) */}
            <div className="bg-gradient-to-br from-blue-600/10 to-teal-600/5 dark:from-blue-600/20 dark:to-teal-600/5 border border-bb-border rounded-[2rem] p-8 flex items-center gap-6 group cursor-default">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/20 flex items-center justify-center transition-transform group-hover:scale-110">
                <ShieldCheck className="w-7 h-7 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-black text-bb-text uppercase tracking-tight">Verificado</p>
                <p className="text-[10px] text-bb-text-secondary/60 font-bold uppercase tracking-widest mt-1">Status Estudiante</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-16 text-center text-[10px] font-black uppercase tracking-[0.4em] text-bb-text-secondary/30">
          Sync: {new Date(profile.updated_at).toLocaleDateString('es-ES')} • {profile.id.substring(0, 8)}
        </div>
      </div>

      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
