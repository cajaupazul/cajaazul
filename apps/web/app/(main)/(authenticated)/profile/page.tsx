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
    <div className="min-h-screen bg-bb-dark text-bb-text pb-12">
      <div className="max-w-none mx-auto px-3 sm:px-4 lg:px-8 pt-4 sm:pt-8 space-y-4 sm:space-y-6">

        {/* ============================================ */}
        {/* MAIN PROFILE CARD - Gaming Style             */}
        {/* ============================================ */}
        <div className="rounded-2xl sm:rounded-3xl overflow-hidden bg-[#0D0F14] border border-white/[0.06] shadow-2xl shadow-black/40">

          {/* Banner */}
          <div className="relative h-36 sm:h-48 md:h-56 w-full overflow-hidden group">
            <img
              key={backgroundImage}
              src={getStorageUrl(backgroundImage, 'profile-avatars', PLACEHOLDERS.BACKGROUND)}
              alt="Banner"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0D0F14] via-[#0D0F14]/30 to-transparent" />

            {editing && !uploadingBackground && (
              <label className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-xl bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/10 transition-all cursor-pointer active:scale-95 z-30">
                <Camera className="w-4 h-4 text-white/70" />
                <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBackgroundUpload} className="hidden" />
              </label>
            )}
          </div>

          {/* Profile Info Bar */}
          <div className="relative px-4 sm:px-6 pb-5 sm:pb-6 -mt-12 sm:-mt-16">
            <div className="flex items-end gap-3 sm:gap-4">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="rounded-full ring-4 ring-[#0D0F14] bg-[#0D0F14]">
                  <AvatarWithFrame
                    size={80}
                    avatarUrl={getStorageUrl(formData.avatar_url || profile.avatar_url, 'profile-avatars', PLACEHOLDERS.AVATAR)}
                    frameUrl={equippedFrame?.image_url}
                    frameScale={equippedFrame?.frame_settings?.profile?.scale}
                    offsetX={equippedFrame?.frame_settings?.profile?.x}
                    offsetY={equippedFrame?.frame_settings?.profile?.y}
                    name={profile.nombre}
                    className="sm:hidden"
                  />
                  <AvatarWithFrame
                    size={110}
                    avatarUrl={getStorageUrl(formData.avatar_url || profile.avatar_url, 'profile-avatars', PLACEHOLDERS.AVATAR)}
                    frameUrl={equippedFrame?.image_url}
                    frameScale={equippedFrame?.frame_settings?.profile?.scale}
                    offsetX={equippedFrame?.frame_settings?.profile?.x}
                    offsetY={equippedFrame?.frame_settings?.profile?.y}
                    name={profile.nombre}
                    className="hidden sm:block"
                  />
                </div>

                {editing && !uploadingAvatar && (
                  <label className="absolute -bottom-1 -right-1 cursor-pointer z-30">
                    <div className="p-1.5 sm:p-2 rounded-full bg-blue-600 shadow-lg hover:bg-blue-500 transition-all border-2 border-[#0D0F14]">
                      <Camera className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                    </div>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                )}
              </div>

              {/* Name + Badges */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {editing ? (
                    <input
                      type="text"
                      name="nombre"
                      value={formData.nombre || ''}
                      onChange={handleInputChange}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-white text-lg sm:text-xl font-black focus:ring-2 focus:ring-blue-500/40 outline-none w-full max-w-[200px] sm:max-w-xs"
                    />
                  ) : (
                    <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-white tracking-tight truncate">
                      {profile.nombre}
                    </h1>
                  )}

                  {isAdmin && (
                    <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400 fill-blue-400/20 shrink-0" />
                  )}

                  {isVip && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/20">
                      <Crown className="w-3 h-3" />
                      VIP
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons - Absolute positioned top right of info bar */}
            <div className="absolute top-0 right-4 sm:right-6 translate-y-14 sm:translate-y-16 flex items-center gap-2">
              {editing ? (
                <>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg transition-all active:scale-95 shadow-lg shadow-blue-500/25"
                  >
                    <Save className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span className="hidden sm:inline">Guardar</span>
                  </button>
                  <button
                    onClick={handleCancel}
                    className="p-1.5 sm:p-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg border border-white/10 transition-all active:scale-95"
                  >
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg transition-all active:scale-95 shadow-lg shadow-blue-500/25"
                >
                  <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span className="hidden sm:inline">Personalizar</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Info Pills (Move these above stats Row) */}
          <div className="px-4 sm:px-6 pb-4 sm:pb-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-white/[0.04] text-white/50 text-[10px] sm:text-xs font-medium border border-white/[0.04]">
              <Mail className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400/70" />
              <span className="truncate max-w-[150px] sm:max-w-none">{userEmail}</span>
            </span>

            {instagramUsername && !editing && (
              <a
                href={profile.link_instagram?.startsWith('http') ? profile.link_instagram : `https://instagram.com/${instagramUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-white/[0.04] text-white/50 text-[10px] sm:text-xs font-medium border border-white/[0.04] hover:bg-pink-500/10 hover:border-pink-500/20 hover:text-pink-400 transition-all"
              >
                <Instagram className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-pink-400" />
                @{instagramUsername}
              </a>
            )}

            {profile.monedas > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-amber-500/5 text-amber-400/70 text-[10px] sm:text-xs font-bold border border-amber-500/10">
                <Coins className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {profile.monedas} monedas
              </span>
            )}
          </div>

          {/* Stats Row (Moved here) */}
          <div className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-white/[0.03] rounded-xl sm:rounded-2xl p-3 sm:p-4 text-center border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/30">Puntos</span>
                </div>
                <span className="text-xl sm:text-2xl font-black text-white">{profile.puntos}</span>
              </div>
              <div className="bg-white/[0.03] rounded-xl sm:rounded-2xl p-3 sm:p-4 text-center border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-400" />
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/30">Miembro</span>
                </div>
                <span className="text-xl sm:text-2xl font-black text-white">{memberYear}</span>
              </div>
              <div className="bg-white/[0.03] rounded-xl sm:rounded-2xl p-3 sm:p-4 text-center border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-400" />
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/30">Logros</span>
                </div>
                <span className="text-xl sm:text-2xl font-black text-white">{achievements}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* ABOUT SECTION                                */}
        {/* ============================================ */}
        <div className="rounded-2xl sm:rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-4 sm:p-6">
          <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-white/25 mb-3 sm:mb-4 flex items-center gap-2">
            <span className="w-1 h-3 sm:h-4 bg-blue-500 rounded-full" />
            Descripción
          </h2>
          {editing ? (
            <textarea
              name="bio"
              value={formData.bio || ''}
              onChange={handleInputChange}
              placeholder="Escribe algo sobre ti..."
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none min-h-[100px] leading-relaxed transition-all"
            />
          ) : (
            <p className="text-sm sm:text-base text-white/40 leading-relaxed">
              {profile.bio || 'Sin descripción aún. Haz clic en "Personalizar" para agregarte una.'}
            </p>
          )}
        </div>

        {/* ============================================ */}
        {/* ACADEMIC INFO                                */}
        {/* ============================================ */}
        <div className="rounded-2xl sm:rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-4 sm:p-6">
          <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-white/25 mb-3 sm:mb-4 flex items-center gap-2">
            <span className="w-1 h-3 sm:h-4 bg-teal-500 rounded-full" />
            Info Académica
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="p-2 rounded-lg bg-teal-500/10 shrink-0">
                <MapPin className="w-4 h-4 text-teal-400" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/25 block">Universidad</span>
                <span className="text-sm font-bold text-white truncate block">{profile.universidad || 'No vinculada'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="p-2 rounded-lg bg-teal-500/10 shrink-0">
                <BookOpen className="w-4 h-4 text-teal-400" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/25 block">Carrera</span>
                <span className="text-sm font-bold text-white truncate block">{profile.carrera || 'No especificada'}</span>
              </div>
            </div>
          </div>

          {/* Instagram edit in academic section */}
          {editing && (
            <div className="mt-3 sm:mt-4">
              <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm focus-within:ring-2 focus-within:ring-pink-500/20 transition-all">
                <Instagram className="w-4 h-4 text-pink-400 shrink-0" />
                <input
                  type="text"
                  value={formData.link_instagram?.replace('https://instagram.com/', '') || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, link_instagram: e.target.value }))}
                  className="bg-transparent outline-none flex-1 text-white font-medium placeholder-white/20"
                  placeholder="Tu usuario de Instagram"
                />
              </div>
            </div>
          )}
        </div>

        {/* ============================================ */}
        {/* SETTINGS ROW                                 */}
        {/* ============================================ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Theme */}
          <div className="rounded-2xl sm:rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-4 sm:p-6">
            <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-white/25 mb-3 sm:mb-4 flex items-center gap-2">
              <span className="w-1 h-3 sm:h-4 bg-purple-500 rounded-full" />
              Apariencia
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                onClick={() => setThemeMode('light')}
                className={`flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 ${themeMode === 'light'
                  ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                  : 'bg-white/[0.02] border-white/[0.06] text-white/30 hover:border-white/[0.12] hover:text-white/50'
                  }`}
              >
                <Sun className="w-5 h-5" />
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-tight">Claro</span>
              </button>
              <button
                onClick={() => setThemeMode('dark')}
                className={`flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 ${themeMode === 'dark'
                  ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                  : 'bg-white/[0.02] border-white/[0.06] text-white/30 hover:border-white/[0.12] hover:text-white/50'
                  }`}
              >
                <Moon className="w-5 h-5" />
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-tight">Oscuro</span>
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-2xl sm:rounded-3xl bg-[#0D0F14] border border-red-500/10 p-4 sm:p-6">
            <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-red-400/40 mb-3 sm:mb-4 flex items-center gap-2">
              <span className="w-1 h-3 sm:h-4 bg-red-500 rounded-full" />
              Zona de Peligro
            </h2>
            <p className="text-[10px] text-white/20 mb-3">Acciones irreversibles sobre tu cuenta.</p>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/15 hover:bg-red-500 hover:border-red-500 transition-all text-red-400 hover:text-white active:scale-[0.98]"
            >
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">Cerrar Cuenta</span>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.3em] text-white/15 pt-2 pb-4">
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
