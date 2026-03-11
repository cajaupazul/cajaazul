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
  CheckCircle2,
} from 'lucide-react';
import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';

const FREE_AVATARS = [
  '253c9a8cd0487a5122f258a1460cca0a.webp',
  '3bd519875bfced605a8a122008642edf.webp',
  '9783a6c83b1d53c32ada9e13f14c8528.png',
  '9d5a510ff16a7f765e788807b05af374.png',
  'b343981037001258bff31df1dab37068.png',
  'c5f29ee9f3c14ef4bd64838e8512338c.png',
  'fb470742d03cd388a65c4ffb20ee1771.png'
];

const FACULTY_LOGOS_MAP: Record<string, string> = {
  'Facultad de Ciencias Empresariales': '/logo/fce.png',
  'Facultad de Derecho': '/logo/fd.png',
  'Facultad de Economía y Finanzas': '/logo/fef.png',
  'Facultad de Ingeniería': '/logo/fi.png'
};

const DEFAULT_BACKGROUND = '/backgrounds/default_background.d35fbf.png';

// Permission keys for the shop/inventory items
const PERMISSIONS = {
  CUSTOM_AVATAR: 'PERM_CUSTOM_AVATAR',
  CUSTOM_BACKGROUND: 'PERM_CUSTOM_BACKGROUND'
};

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
  const [inventory, setInventory] = useState<string[]>([]);
  const [isAvatarSelectorOpen, setIsAvatarSelectorOpen] = useState(false);
  const [sidebarVisibility, setSidebarVisibility] = useState<Record<string, boolean>>({});
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
      setBackgroundImage(contextProfile.background_url || DEFAULT_BACKGROUND);
      setLoading(false);
      fetchInventory(contextProfile.id);
    }
  }, [contextProfile]);

  const fetchInventory = async (userId: string) => {
    const { data } = await supabase
      .from('user_inventory')
      .select('shop_items(frame_key)')
      .eq('user_id', userId);

    if (data) {
      const keys = data
        .map((item: any) => item.shop_items?.frame_key)
        .filter(Boolean);
      setInventory(keys);
    }
  };

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
    fetchVisibility(); // Call fetchVisibility here
  }, [contextProfile?.active_frame_key, contextProfile?.id, profile]); // Added profile to dependencies

  const fetchVisibility = async () => {
    try {
      const { data } = await supabase
        .from('sidebar_visibility')
        .select('section_key, is_hidden');
      if (data) {
        const settings: Record<string, boolean> = {};
        data.forEach(item => {
          settings[item.section_key] = item.is_hidden;
        });
        setSidebarVisibility(settings);
      }
    } catch (err) {
      console.error('Error fetching visibility:', err);
    }
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    if (!inventory.includes(PERMISSIONS.CUSTOM_BACKGROUND) && profile.role === 'user') {
      alert('Debes comprar el permiso "Fondo Personalizado" en la tienda para subir tus propias imágenes.');
      return;
    }

    setUploadingBackground(true);
    // ... rest of logic
    try {
      const { uploadFileToR2, deleteFileFromR2 } = await import('@/lib/r2-storage');

      // Cleanup previous staged background if it exists and hasn't been saved
      if (stagedBackgroundUrl && stagedBackgroundUrl !== profile.background_url) {
        await deleteFileFromR2('profile-avatars', stagedBackgroundUrl);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `bg-${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `backgrounds/${fileName}`;

      await uploadFileToR2('profile-avatars', filePath, file);

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

    if (!inventory.includes(PERMISSIONS.CUSTOM_AVATAR) && profile.role === 'user') {
      alert('Debes comprar el permiso "Avatar Personalizado" en la tienda para subir tus propias imágenes.');
      return;
    }

    setUploadingAvatar(true);
    // ... rest of logic
    try {
      const { uploadFileToR2, deleteFileFromR2 } = await import('@/lib/r2-storage');

      // Cleanup previous staged avatar if it exists and hasn't been saved
      if (stagedAvatarUrl && stagedAvatarUrl !== profile.avatar_url) {
        await deleteFileFromR2('profile-avatars', stagedAvatarUrl);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      await uploadFileToR2('profile-avatars', filePath, file);

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
    <div className={`min-h-screen transition-colors duration-500 selection:bg-blue-500/30 ${themeMode === 'light' ? 'bg-[#F8FAFC] text-[#0F172A]' : 'bg-[#060709] text-[#E1E7EF]'}`}>

      {/* ============================================ */}
      {/* 1. EDGE-TO-EDGE BANNER                      */}
      {/* ============================================ */}
      <div className={`relative h-48 sm:h-64 md:h-80 w-full overflow-hidden border-b ${themeMode === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
        <img
          key={backgroundImage}
          src={getStorageUrl(backgroundImage, 'profile-avatars', PLACEHOLDERS.BACKGROUND)}
          alt="Banner"
          className="w-full h-full object-cover"
        />

        {instagramUsername && !editing && (
          <a
            href={profile.link_instagram?.startsWith('http') ? profile.link_instagram : `https://instagram.com/${instagramUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 right-4 p-2 sm:p-2.5 rounded-xl bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 shadow-xl shadow-black/40 hover:scale-110 transition-all active:scale-95 z-20 border border-white/20"
            title="Instagram"
          >
            <Instagram className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </a>
        )}

        {editing && !uploadingBackground && (isAdmin || inventory.includes(PERMISSIONS.CUSTOM_BACKGROUND) || !sidebarVisibility['Tienda']) && (
          <button
            onClick={() => {
              if (inventory.includes(PERMISSIONS.CUSTOM_BACKGROUND) || isAdmin) {
                bgInputRef.current?.click();
              } else if (!sidebarVisibility['Tienda']) {
                router.push('/dashboard/store');
              }
            }}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2.5 sm:p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 transition-all cursor-pointer z-30"
          >
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-white/70" />
              {(!inventory.includes(PERMISSIONS.CUSTOM_BACKGROUND) && !isAdmin) && !sidebarVisibility['Tienda'] && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/20 text-amber-500 text-[8px] font-black uppercase">
                  Tienda
                </div>
              )}
            </div>
            <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBackgroundUpload} className="hidden" />
          </button>
        )}
      </div>

      {/* ============================================ */}
      {/* 2. MAIN CONTENT AREA                       */}
      {/* ============================================ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 -mt-16 sm:-mt-24 relative z-10">

        {/* Header Section: Avatar + Name + Core Info */}
        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 mb-10 sm:mb-12 text-center md:text-left">

          {/* Large Avatar Overlay */}
          <div className="relative shrink-0 group">
            <div className={`rounded-full ring-[6px] sm:ring-[8px] shadow-2xl transition-colors duration-500 ${themeMode === 'light' ? 'ring-[#F8FAFC] bg-white' : 'ring-[#060709] bg-[#060709]'}`}>
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
              <button
                onClick={() => setIsAvatarSelectorOpen(true)}
                className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 cursor-pointer z-30"
              >
                <div className={`p-2 sm:p-2.5 rounded-full bg-blue-600 shadow-xl hover:bg-blue-500 transition-all border-4 flex items-center justify-center ${themeMode === 'light' ? 'border-[#F8FAFC]' : 'border-[#060709]'}`}>
                  <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </div>
              </button>
            )}
          </div>

          {/* Name, Description & Quick Links */}
          <div className="flex-1 pb-1 sm:pb-2 w-full">
            <div className="flex flex-col gap-2 sm:gap-3">
              <div className="flex flex-col md:flex-row items-center md:items-baseline gap-3 md:gap-4">
                {editing ? (
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre || ''}
                    onChange={handleInputChange}
                    className={`bg-transparent border-b-2 px-0 py-1 text-2xl sm:text-4xl md:text-5xl font-black focus:border-blue-500 outline-none w-full max-w-lg transition-all ${themeMode === 'light' ? 'border-slate-200 text-slate-900' : 'border-white/10 text-white'}`}
                  />
                ) : (
                  <h1
                    className={`text-2xl sm:text-4xl md:text-5xl font-black tracking-tighter transition-colors duration-500 ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}
                    style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4), 0 0 2px rgba(0,0,0,1)' }}
                  >
                    {profile.nombre}
                  </h1>
                )}

                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 fill-blue-500/10" />
                  )}
                  {isVip && (
                    <img src="/vip-icon.png" alt="VIP" className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-lg" />
                  )}
                </div>
              </div>

              {/* DESCRIPTION (Moved under name) */}
              <div className="max-w-xl mx-auto md:mx-0">
                {editing ? (
                  <textarea
                    name="bio"
                    value={formData.bio || ''}
                    onChange={handleInputChange}
                    placeholder="Escribe algo sobre ti..."
                    className={`w-full bg-white/5 border rounded-xl px-4 py-2 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/20 resize-none min-h-[60px] sm:min-h-[80px] leading-relaxed transition-all text-xs sm:text-sm italic ${themeMode === 'light' ? 'border-slate-200 text-slate-600' : 'border-white/10 text-white/60'}`}
                  />
                ) : (
                  <p
                    className={`text-base sm:text-lg md:text-xl font-medium leading-relaxed italic font-serif transition-colors duration-500 ${themeMode === 'light' ? 'text-slate-600' : 'text-white/70'}`}
                    style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
                  >
                    {profile.bio || 'Sin descripción aún...'}
                  </p>
                )}
              </div>

              {/* Minimal Info Strips */}
              <div className="flex flex-wrap justify-center md:justify-start gap-4 sm:gap-6 text-[10px] sm:text-xs md:text-sm font-semibold pt-1 sm:pt-2">
                <div className="flex items-center gap-2 opacity-60">
                  <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{userEmail}</span>
                </div>

                {profile.monedas > 0 && (
                  <div className="flex items-center gap-2 text-amber-500/80">
                    <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="font-bold">{profile.monedas} monedas</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Area: Buttons */}
          <div className="flex flex-col items-center md:items-end gap-3 sm:gap-4 mb-1 sm:mb-2 shrink-0 w-full md:w-auto">

            <div className="flex gap-2 sm:gap-3">
              {editing ? (
                <>
                  <button
                    onClick={handleSave}
                    className="px-4 sm:px-6 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-full transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2"
                  >
                    <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Guardar
                  </button>
                  <button
                    onClick={handleCancel}
                    className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-full border transition-all active:scale-95 ${themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600' : 'bg-white/5 border-white/10 text-white/50'}`}
                  >
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className={`px-5 sm:px-6 py-2 sm:py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-full border transition-all active:scale-95 flex items-center gap-2 ${themeMode === 'light' ? 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-900/10' : 'bg-[#1B1F24] border-white/5 text-white hover:bg-[#252A30]'}`}
                >
                  <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Personalizar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* 3. GRID CONTENT: STATS & DETAILS           */}
        {/* ============================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12 mb-16 sm:mb-20">

          {/* Main Column */}
          <div className="lg:col-span-3 space-y-12 sm:space-y-16">

            {/* Stats Strip */}
            <div className={`grid grid-cols-1 sm:grid-cols-3 gap-0 border-y transition-colors duration-500 ${themeMode === 'light' ? 'border-slate-200' : 'border-white/[0.05]'}`}>
              <div className={`py-6 sm:py-8 sm:pr-8 border-b sm:border-b-0 sm:border-r ${themeMode === 'light' ? 'border-slate-200' : 'border-white/[0.05]'}`}>
                <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] block mb-3 sm:mb-4 ${themeMode === 'light' ? 'text-blue-600/60' : 'text-blue-500/60'}`}>Puntos de Actividad</span>
                <div className="flex items-end gap-3 justify-between sm:justify-start">
                  <span className={`text-4xl sm:text-5xl font-black ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>{profile.puntos}</span>
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 mb-1.5 sm:mb-2" />
                </div>
              </div>
              <div className={`py-6 sm:py-8 sm:px-8 border-b sm:border-b-0 sm:border-r ${themeMode === 'light' ? 'border-slate-200' : 'border-white/[0.05]'}`}>
                <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] block mb-3 sm:mb-4 ${themeMode === 'light' ? 'text-teal-600/60' : 'text-teal-500/60'}`}>Año de Ingreso</span>
                <div className="flex items-end gap-3 justify-between sm:justify-start">
                  <span className={`text-4xl sm:text-5xl font-black ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>{memberYear}</span>
                  <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-teal-500 mb-1.5 sm:mb-2" />
                </div>
              </div>
              <div className="py-6 sm:py-8 sm:pl-8">
                <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] block mb-3 sm:mb-4 ${themeMode === 'light' ? 'text-pink-600/60' : 'text-pink-500/60'}`}>Logros Obtenidos</span>
                <div className="flex items-end gap-3 justify-between sm:justify-start">
                  <span className={`text-4xl sm:text-5xl font-black ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>{achievements}</span>
                  <Award className="w-5 h-5 sm:w-6 sm:h-6 text-pink-500 mb-1.5 sm:mb-2" />
                </div>
              </div>
            </div>

            {/* ACADEMIC INFO */}
            <section>
              <h2 className={`text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] mb-6 sm:mb-8 ${themeMode === 'light' ? 'text-slate-400' : 'text-white/20'}`}>ESPECIFICACIONES ACADÉMICAS</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12">
                <div className="space-y-2">
                  <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${themeMode === 'light' ? 'text-slate-400' : 'text-[#52525B]'}`}>UNIVERSIDAD</span>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-teal-500/50" />
                    <p className={`text-base sm:text-lg font-bold transition-colors ${themeMode === 'light' ? 'text-slate-800' : 'text-white'}`}>{profile.universidad || 'Pendiente'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${themeMode === 'light' ? 'text-slate-400' : 'text-[#52525B]'}`}>FACULTAD / CARRERA</span>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-teal-500/50" />
                    <p className={`text-base sm:text-lg font-bold transition-colors ${themeMode === 'light' ? 'text-slate-800' : 'text-white'}`}>{profile.carrera || 'No especificado'}</p>
                  </div>
                </div>
              </div>

              {editing && (
                <div className="mt-6 sm:mt-8">
                  <div className={`flex items-center gap-3 sm:gap-4 border-b py-2 focus-within:border-pink-500 transition-all ${themeMode === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
                    <Instagram className="w-4 h-4 sm:w-5 sm:h-5 text-pink-500/50" />
                    <input
                      type="text"
                      value={formData.link_instagram?.replace('https://instagram.com/', '') || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, link_instagram: e.target.value }))}
                      className={`bg-transparent outline-none flex-1 text-sm sm:text-base font-medium placeholder-slate-400 ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}
                      placeholder="Usuario de Instagram"
                    />
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Sidebar Area - Settings & Appearance */}
          <aside className={`space-y-10 sm:space-y-12 pl-0 lg:pl-8 border-t lg:border-t-0 lg:border-l pt-10 lg:pt-0 transition-colors duration-500 ${themeMode === 'light' ? 'border-slate-200' : 'border-white/[0.05]'}`}>

            {/* Theme Toggle */}
            <div className="space-y-4">
              <h3 className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${themeMode === 'light' ? 'text-slate-400' : 'text-white/20'}`}>APARIENCIA</h3>
              <div className={`flex gap-2 p-1 rounded-2xl w-fit ${themeMode === 'light' ? 'bg-slate-200/50' : 'bg-white/5'}`}>
                <button
                  onClick={() => setThemeMode('light')}
                  className={`p-2 sm:p-3 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-wider ${themeMode === 'light' ? 'bg-white text-slate-900 shadow-md' : 'text-white/30 hover:text-white/60'}`}
                >
                  <Sun className="w-4 h-4" />
                  <span className="lg:hidden xl:inline">Claro</span>
                </button>
                <button
                  onClick={() => setThemeMode('dark')}
                  className={`p-2 sm:p-3 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-wider ${themeMode === 'dark' ? 'bg-[#060709] text-white shadow-xl shadow-black/40' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Moon className="w-4 h-4" />
                  <span className="lg:hidden xl:inline">Oscuro</span>
                </button>
              </div>
            </div>

            {/* Security/Danger */}
            <div className="space-y-4">
              <h3 className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${themeMode === 'light' ? 'text-red-600/40' : 'text-red-500/40'}`}>ZONA CRÍTICA</h3>
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className={`group flex items-center gap-3 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors ${themeMode === 'light' ? 'text-slate-400 hover:text-red-600' : 'text-white/20 hover:text-red-500'}`}
              >
                <Trash2 className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
                Eliminar Cuenta
              </button>
            </div>

            {/* ID Sync */}
            <div className="pt-6 sm:pt-12">
              <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.4em] opacity-30 ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                SYNC: {new Date(profile.updated_at).toLocaleDateString()}
              </p>
              <p className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.4em] mt-2 opacity-15 ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                ID: {profile.id.substring(0, 16).toUpperCase()}...
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* Footer Decoration */}
      <div className={`w-full h-px opacity-10 ${themeMode === 'light' ? 'bg-slate-900' : 'bg-white'}`} />

      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      />

      {/* Free Avatar Selector Modal */}
      {isAvatarSelectorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className={`w-full max-w-lg rounded-3xl border p-6 shadow-2xl transition-colors duration-500 ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-[#0F172A] border-white/10'}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-black tracking-tight ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>Selecciona un Avatar</h2>
              <button onClick={() => setIsAvatarSelectorOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <X className="w-5 h-5 opacity-40" />
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
              {FREE_AVATARS.map((avatar) => {
                const url = `/avatars/${avatar}`;
                const isSelected = formData.avatar_url === url;
                return (
                  <button
                    key={avatar}
                    onClick={() => {
                      setFormData(prev => ({ ...prev, avatar_url: url }));
                      setIsAvatarSelectorOpen(false);
                    }}
                    className={`relative aspect-square rounded-2xl overflow-hidden border-4 transition-all hover:scale-105 active:scale-95 ${isSelected ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-transparent opacity-80 hover:opacity-100'}`}
                  >
                    <img src={url} alt="Avatar" className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-blue-500 fill-blue-500/20" />
                      </div>
                    )}
                  </button>
                );
              })}

              <div className="col-span-full mt-6 mb-2">
                <p className="text-[10px] font-bold text-bb-text-secondary uppercase tracking-widest opacity-60">Logo de tu Facultad</p>
              </div>

              {Object.entries(FACULTY_LOGOS_MAP)
                .filter(([facName]) => isAdmin || facName === profile.carrera)
                .map(([facName, url]) => {
                  const isSelected = formData.avatar_url === url;
                  return (
                    <button
                      key={url}
                      onClick={() => {
                        setFormData(prev => ({ ...prev, avatar_url: url }));
                        setIsAvatarSelectorOpen(false);
                      }}
                      className={`relative aspect-square rounded-2xl overflow-hidden border-4 bg-white transition-all hover:scale-105 active:scale-95 ${isSelected ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-transparent opacity-80 hover:opacity-100'}`}
                      title={facName}
                    >
                      <img src={url} alt={facName} className="w-full h-full object-contain p-2" />
                      {isSelected && (
                        <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-blue-500" />
                        </div>
                      )}
                    </button>
                  );
                })}

              {/* Only show custom upload if user has permission, is admin, or if store is not hidden for users */}
              {(isAdmin || inventory.includes(PERMISSIONS.CUSTOM_AVATAR) || !sidebarVisibility['Tienda']) && (
                <div className="col-span-full mt-4 pt-4 border-t border-white/5">
                  <p className="text-[10px] font-bold text-bb-text-secondary uppercase tracking-widest mb-3 opacity-60">Personalización Pro</p>
                  <div
                    onClick={() => {
                      if (inventory.includes(PERMISSIONS.CUSTOM_AVATAR) || isAdmin) {
                        avatarInputRef.current?.click();
                        setIsAvatarSelectorOpen(false);
                      } else if (!sidebarVisibility['Tienda']) {
                        router.push('/dashboard/store');
                      }
                    }}
                    className={`flex items-center gap-4 p-4 rounded-2xl border border-dashed transition-all cursor-pointer ${themeMode === 'light' ? 'bg-slate-50 border-slate-300 hover:bg-slate-100' : 'bg-white/5 border-white/20 hover:bg-white/10'}`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`text-sm font-black ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>Subir desde PC</p>
                      <p className="text-[10px] font-bold text-bb-text-secondary">Necesitas permiso de tienda</p>
                    </div>
                    {(!inventory.includes(PERMISSIONS.CUSTOM_AVATAR) && !isAdmin) && (
                      <ExternalLink className="w-4 h-4 opacity-30" />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
