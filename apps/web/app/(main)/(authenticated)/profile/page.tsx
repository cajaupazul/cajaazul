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
    <div className="min-h-screen bg-[#070708] text-white selection:bg-blue-500/30">
      {/* Background Banner */}
      <div className="relative h-48 md:h-64 w-full overflow-hidden">
        <img
          key={backgroundImage}
          src={getStorageUrl(backgroundImage, 'profile-avatars', PLACEHOLDERS.BACKGROUND)}
          alt="Profile Background"
          className="w-full h-full object-cover grayscale-[20%] opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070708] via-transparent to-transparent" />

        {editing && !uploadingBackground && (
          <label className="absolute top-6 right-6 p-2.5 rounded-xl bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 transition-all cursor-pointer group active:scale-95 z-30">
            <Camera className="w-4 h-4 text-white/70 group-hover:text-white" />
            <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBackgroundUpload} className="hidden" />
          </label>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 relative z-10 pb-20">
        {/* Main Header Card */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 md:p-10 shadow-2xl shadow-black/50 overflow-hidden relative group">
          {/* Subtle accent light */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
            {/* Avatar Section */}
            <div className="relative">
              <div className="relative p-1 rounded-full bg-gradient-to-tr from-blue-500/20 via-transparent to-pink-500/20">
                <AvatarWithFrame
                  size={140}
                  avatarUrl={getStorageUrl(formData.avatar_url || profile.avatar_url, 'profile-avatars', PLACEHOLDERS.AVATAR)}
                  frameUrl={equippedFrame?.image_url}
                  frameScale={equippedFrame?.frame_settings?.profile?.scale}
                  offsetX={equippedFrame?.frame_settings?.profile?.x}
                  offsetY={equippedFrame?.frame_settings?.profile?.y}
                  name={profile.nombre}
                  className="shadow-xl"
                />
              </div>

              {editing && !uploadingAvatar && (
                <label className="absolute bottom-2 right-2 cursor-pointer group">
                  <div className="p-2.5 rounded-full bg-blue-600 shadow-xl group-hover:bg-blue-500 transition-all border-2 border-[#161617]">
                    <Camera className="w-4 h-4 text-white" />
                  </div>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              )}
            </div>

            {/* Info Section */}
            <div className="flex-1 text-center md:text-left pt-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                <div>
                  <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white flex items-center justify-center md:justify-start gap-3 mb-2">
                    {editing ? (
                      <input
                        type="text"
                        name="nombre"
                        value={formData.nombre || ''}
                        onChange={handleInputChange}
                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-2xl md:text-4xl font-black focus:ring-2 focus:ring-blue-500/50 outline-none w-full"
                      />
                    ) : (
                      <>
                        {profile.nombre}
                        {(profile.role === 'admin' || profile.role === 'superadmin') && (
                          <ShieldCheck className="w-6 h-6 md:w-8 md:h-8 text-blue-400 fill-blue-400/20" />
                        )}
                      </>
                    )}
                  </h1>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-white/50 text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 opacity-60" />
                      {userEmail}
                    </span>
                    {profile.link_instagram && !editing && (
                      <a
                        href={profile.link_instagram.startsWith('http') ? profile.link_instagram : `https://instagram.com/${profile.link_instagram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-pink-400/80 hover:text-pink-400 transition-colors"
                      >
                        <Instagram className="w-3.5 h-3.5" />
                        <span>@{profile.link_instagram.replace(/.*\//, '').replace('@', '')}</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => editing ? handleSave() : setEditing(true)}
                    className="flex-1 md:flex-none px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 text-sm"
                  >
                    {editing ? 'Guardar Cambios' : 'Editar Perfil'}
                  </button>
                  {editing && (
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-all text-sm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Minimalist Stats Strip */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-8 border-t border-white/5 pt-6 mt-6">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Puntos</span>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-500" />
                    <span className="text-xl font-black">{profile.puntos}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Miembro</span>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-white/40" />
                    <span className="text-xl font-black">{new Date(profile.created_at).getFullYear()}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Logros</span>
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-white/40" />
                    <span className="text-xl font-black">{Math.floor(profile.puntos / 50)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Info & Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Bio Section */}
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/30 mb-6 flex items-center gap-3">
                <span className="w-1 h-3 bg-blue-500 rounded-full" />
                Descripción
              </h2>
              {editing ? (
                <textarea
                  name="bio"
                  value={formData.bio || ''}
                  onChange={handleInputChange}
                  placeholder="Escribe algo sobre ti..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none min-h-[140px] text-sm leading-relaxed"
                />
              ) : (
                <p className="text-white/60 leading-relaxed text-base font-medium">
                  {profile.bio || 'Sin biografía disponible. Haz clic en Editar para agregar una.'}
                </p>
              )}
            </div>

            {/* Customization & Settings Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8">
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/30 mb-6 flex items-center gap-3">
                  <span className="w-1 h-3 bg-pink-500 rounded-full" />
                  Personalización
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setThemeMode('light')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${themeMode === 'light' ? 'bg-blue-600 border-blue-500' : 'bg-white/5 border-white/5 hover:border-white/20 text-white/50 hover:text-white'}`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold uppercase tracking-tighter">Claro</span>
                  </button>
                  <button
                    onClick={() => setThemeMode('dark')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${themeMode === 'dark' ? 'bg-blue-600 border-blue-500' : 'bg-white/5 border-white/5 hover:border-white/20 text-white/50 hover:text-white'}`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold uppercase tracking-tighter">Oscuro</span>
                  </button>
                </div>
              </div>

              <div className="bg-red-500/[0.02] border border-red-500/10 rounded-3xl p-8">
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-red-500/40 mb-6 flex items-center gap-3">
                  <span className="w-1 h-3 bg-red-500 rounded-full" />
                  Seguridad
                </h2>
                <button
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="w-full flex items-center justify-between group p-3 rounded-xl bg-red-500/5 border border-red-500/10 hover:bg-red-500 hover:border-red-500 transition-all text-red-500 hover:text-white"
                >
                  <span className="text-xs font-black uppercase">Cerrar Cuenta</span>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-6">
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/30 mb-6 flex items-center gap-3">
                <span className="w-1 h-3 bg-teal-500 rounded-full" />
                Información
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/20 block mb-2">Universidad</label>
                  <div className="flex items-center gap-3 text-white/80">
                    <MapPin className="w-4 h-4 text-teal-400" />
                    <span className="text-sm font-bold">{profile.universidad || 'UP'}</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/20 block mb-2">Facultad</label>
                  <div className="flex items-center gap-3 text-white/80">
                    <BookOpen className="w-4 h-4 text-teal-400" />
                    <span className="text-sm font-bold">{profile.carrera || 'Facultad'}</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/20 block mb-2">Instagram</label>
                  {editing ? (
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs">
                      <Instagram className="w-3.5 h-3.5 text-pink-400" />
                      <input
                        type="text"
                        value={formData.link_instagram?.replace('https://instagram.com/', '') || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, link_instagram: e.target.value }))}
                        className="bg-transparent outline-none flex-1 text-white"
                        placeholder="usuario"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-white/80">
                      <Instagram className="w-4 h-4 text-pink-400" />
                      <span className="text-sm font-bold truncate">@{profile.link_instagram || 'no_vinculado'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Verification Badge (if applicable) */}
            <div className="bg-gradient-to-br from-blue-600/20 to-teal-600/5 border border-white/5 rounded-3xl p-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-black text-white uppercase tracking-tight">Estudiante Verificado</p>
                <p className="text-[10px] text-white/40 font-medium">Cuenta activa y validada</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-12 text-center text-[10px] font-black uppercase tracking-[0.2em] text-white/10">
          Última actualización: {new Date(profile.updated_at).toLocaleDateString('es-ES')} • ID: {profile.id.substring(0, 8)}
        </div>
      </div>

      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
