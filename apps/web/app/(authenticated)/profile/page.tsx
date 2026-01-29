'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase, Profile, ShopItem, getStorageUrl } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { useRouter } from 'next/navigation';
import { AvatarWithFrame } from '@/components/ui/AvatarWithFrame';
import { StickerCanvas } from '@/components/ui/StickerCanvas';
import { PLACEHOLDERS } from '@/lib/constants';
import {
  Camera,
  Mail,
  MapPin,
  Zap,
  Calendar,
  Edit2,
  Save,
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
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<Partial<Profile>>({});
  const [userEmail, setUserEmail] = useState('');
  const [backgroundImage, setBackgroundImage] = useState('');
  const [equippedFrame, setEquippedFrame] = useState<ShopItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [stagedAvatarUrl, setStagedAvatarUrl] = useState<string | null>(null);
  const [stagedBackgroundUrl, setStagedBackgroundUrl] = useState<string | null>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const cleanupStorage = async (keepAvatarUrl?: string | null, keepBgUrl?: string | null) => {
    if (!profile) return;

    const folders = ['avatars', 'backgrounds', ''];
    const keepAvatarFile = keepAvatarUrl?.split('/').pop();
    const keepBgFile = keepBgUrl?.split('/').pop();

    for (const folder of folders) {
      try {
        const { data: files, error } = await supabase.storage
          .from('profile-avatars')
          .list(folder, {
            limit: 100,
          });

        if (error) {
          console.error(`Error listing files in ${folder}:`, error);
          continue;
        }

        if (!files || files.length === 0) continue;

        const filesToDelete = files
          .filter(file => {
            // Check if file belongs to user (starts with profile.id or bg-profile.id)
            const isUserFile = file.name.startsWith(profile.id) ||
              file.name.startsWith(`bg-${profile.id}`);
            if (!isUserFile) return false;

            // Don't delete the ones we want to keep
            if (file.name === keepAvatarFile || file.name === keepBgFile) return false;

            return true;
          })
          .map(file => folder ? `${folder}/${file.name}` : file.name);

        if (filesToDelete.length > 0) {
          console.log(`Cleaning up ${filesToDelete.length} files in ${folder}:`, filesToDelete);
          await supabase.storage.from('profile-avatars').remove(filesToDelete);
        }
      } catch (err) {
        console.error(`Unexpected error cleaning ${folder}:`, err);
      }
    }
  };

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

    setUploading(true);
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
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
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
      setUploading(false);
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

      // Robust cleanup: list and delete ALL user files except the new ones
      await cleanupStorage(dataToSave.avatar_url, dataToSave.background_url);

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

    // Robust cleanup: delete any new files, leaving ONLY the original ones
    await cleanupStorage(profile.avatar_url || undefined, profile.background_url || undefined);

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
    <div className="min-h-screen bg-bb-dark overflow-hidden transition-colors duration-300">
      {/* Background with gradient overlay */}
      <div className="relative min-h-screen">
        {profile && (
          <StickerCanvas
            targetType="profile"
            targetId={profile.id}
            canEdit={true}
          />
        )}

        {/* Background Image */}
        <div
          className="absolute inset-0 h-64 md:h-96 bg-cover bg-center"
          style={{
            backgroundImage: `url('${getStorageUrl(backgroundImage, 'profile-avatars', PLACEHOLDERS.BACKGROUND)}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bb-dark" />

          {/* Background edit button */}
          {editing && (
            <label
              className="absolute top-4 right-4 p-3 rounded-full backdrop-blur-md bg-bb-sidebar/50 hover:bg-bb-sidebar text-bb-text transition-all cursor-pointer hover:scale-110 active:scale-95 z-30 shadow-lg border border-bb-border"
              title="Cambiar fondo"
            >
              <Camera className="w-5 h-5" />
              <input
                ref={bgInputRef}
                type="file"
                accept="image/*"
                onChange={handleBackgroundUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
          {/* Profile Header */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 mb-8 md:mb-12 mt-12 md:mt-20">
            {/* Avatar */}
            <div className="relative">
              <AvatarWithFrame
                size={140}
                avatarUrl={getStorageUrl(formData.avatar_url || profile.avatar_url, 'profile-avatars', PLACEHOLDERS.AVATAR)}
                frameUrl={equippedFrame?.image_url}
                frameScale={equippedFrame?.frame_settings?.profile?.scale}
                offsetX={equippedFrame?.frame_settings?.profile?.x}
                offsetY={equippedFrame?.frame_settings?.profile?.y}
                name={profile.nombre}
                className="shadow-2xl"
              />

              {/* Avatar Upload Button */}
              {editing && (
                <label className="absolute bottom-2 right-2 cursor-pointer z-30">
                  <div
                    className="p-3 rounded-full text-white shadow-lg hover:opacity-90 transition-all hover:scale-110 backdrop-blur-sm bg-opacity-80"
                    style={{ backgroundColor: colors?.primary }}
                  >
                    <Camera className="w-5 h-5" />
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="mb-4">
                <h1 className="text-3xl md:text-5xl font-bold text-bb-text mb-2 leading-tight flex items-center justify-center sm:justify-start gap-3">
                  {editing ? (
                    <input
                      type="text"
                      name="nombre"
                      value={formData.nombre || ''}
                      onChange={handleInputChange}
                      className="bg-bb-card border border-bb-border rounded-lg px-4 py-2 text-bb-text w-full backdrop-blur-md focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                    />
                  ) : (
                    <>
                      {profile.nombre}
                      {(profile.role === 'admin' || profile.role === 'superadmin') && (
                        <ShieldCheck className="w-8 h-8 md:w-10 md:h-10 text-blue-400 fill-blue-400/10 shrink-0" />
                      )}
                    </>
                  )}
                </h1>
                <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4 text-bb-text-secondary text-xs md:text-sm">
                  <div className="flex items-center gap-2 bg-bb-card md:bg-transparent px-3 py-1.5 md:p-0 rounded-full md:rounded-none border border-bb-border md:border-0">
                    <Mail className="w-3.5 h-3.5 md:w-4 md:h-4 text-bb-text-secondary" />
                    <span>{userEmail}</span>
                  </div>
                  {profile.link_instagram && !editing && (
                    <a
                      href={profile.link_instagram.startsWith('http') ? profile.link_instagram : `https://instagram.com/${profile.link_instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 hover:text-bb-text transition-colors"
                    >
                      <Instagram className="w-4 h-4 text-pink-500" />
                      <span>@{profile.link_instagram.replace('https://instagram.com/', '').replace('/', '')}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center sm:justify-start gap-3 flex-wrap mt-4 md:mt-0">
                <button
                  onClick={() => {
                    if (editing) handleSave();
                    else setEditing(true);
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all duration-200 text-white hover:scale-105 shadow-lg shadow-blue-500/10 text-sm md:text-base w-full sm:w-auto justify-center"
                  style={{ backgroundColor: colors?.primary }}
                >
                  {editing ? (
                    <>
                      <Save className="w-4 h-4" />
                      Guardar
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-4 h-4" />
                      Editar Perfil
                    </>
                  )}
                </button>
                {editing && (
                  <button
                    onClick={handleCancel}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold bg-bb-card hover:bg-bb-hover text-bb-text transition-all backdrop-blur text-sm md:text-base w-full sm:w-auto justify-center border border-bb-border"
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {/* Puntos */}
            <div className="rounded-xl p-6 border transition-all hover:shadow-lg bg-bb-card border-bb-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-bb-text-secondary text-[10px] md:text-xs uppercase tracking-widest mb-1 md:mb-2">Puntos</p>
                  <p className="text-3xl md:text-4xl font-bold" style={{ color: colors?.primary }}>
                    {profile.puntos}
                  </p>
                </div>
                <Zap className="w-10 h-10 md:w-12 md:h-12" style={{ color: colors?.primary, opacity: 0.2 }} />
              </div>
            </div>

            {/* Miembro desde */}
            <div className="rounded-xl p-6 border transition-all hover:shadow-lg bg-bb-card border-bb-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-bb-text-secondary text-[10px] md:text-xs uppercase tracking-widest mb-1 md:mb-2">Miembro desde</p>
                  <p className="text-2xl md:text-3xl font-bold text-bb-text">
                    {new Date(profile.created_at).getFullYear()}
                  </p>
                </div>
                <Calendar className="w-10 h-10 md:w-12 md:h-12" style={{ color: colors?.primary, opacity: 0.2 }} />
              </div>
            </div>

            {/* Logros */}
            <div className="rounded-xl p-6 border transition-all hover:shadow-lg bg-bb-card border-bb-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-bb-text-secondary text-[10px] md:text-xs uppercase tracking-widest mb-1 md:mb-2">Logros</p>
                  <p className="text-2xl md:text-3xl font-bold text-bb-text">
                    {Math.floor(profile.puntos / 50)}
                  </p>
                </div>
                <Award className="w-10 h-10 md:w-12 md:h-12" style={{ color: colors?.primary, opacity: 0.2 }} />
              </div>
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="p-4 rounded-lg border bg-bb-card border-bb-border">
              <div className="text-xs text-bb-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" style={{ color: colors?.primary }} />
                Universidad
              </div>
              {editing ? (
                <input
                  type="text"
                  name="universidad"
                  value={formData.universidad || ''}
                  readOnly
                  className="w-full bg-bb-dark border border-bb-border rounded px-3 py-2 text-bb-text/50 focus:outline-none cursor-not-allowed"
                />
              ) : (
                <div className="text-bb-text font-semibold text-lg">
                  {profile.universidad || 'No especificada'}
                </div>
              )}
            </div>

            <div className="p-4 rounded-lg border bg-bb-card border-bb-border">
              <div className="text-xs text-bb-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4" style={{ color: colors?.primary }} />
                Facultad
              </div>
              {editing ? (
                <input
                  type="text"
                  name="carrera"
                  value={formData.carrera || ''}
                  readOnly
                  className="w-full bg-bb-dark border border-bb-border rounded px-3 py-2 text-bb-text/50 focus:outline-none cursor-not-allowed"
                />
              ) : (
                <div className="text-bb-text font-semibold text-lg">
                  {profile.carrera || 'No especificada'}
                </div>
              )}
            </div>

            <div className="p-4 rounded-lg border bg-bb-card border-bb-border">
              <div className="text-xs text-bb-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
                <Instagram className="w-4 h-4" style={{ color: colors?.primary }} />
                Instagram
              </div>
              {editing ? (
                <div className="flex items-center gap-2">
                  <span className="text-bb-text-secondary text-sm">instagram.com/</span>
                  <input
                    type="text"
                    name="link_instagram"
                    value={formData.link_instagram?.replace('https://instagram.com/', '') || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, link_instagram: e.target.value }))}
                    placeholder="usuario"
                    className="w-full bg-bb-dark border border-bb-border rounded px-3 py-2 text-bb-text focus:outline-none focus:border-faculty-primary/50"
                  />
                </div>
              ) : (
                profile.link_instagram ? (
                  <a
                    href={`https://instagram.com/${profile.link_instagram.replace('https://instagram.com/', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-bb-text font-semibold text-lg hover:underline truncate block"
                  >
                    @{profile.link_instagram.replace('https://instagram.com/', '')}
                  </a>
                ) : (
                  <div className="text-bb-text-secondary italic">No vinculado</div>
                )
              )}
            </div>
          </div>

          {/* Bio Section */}
          <div
            className="rounded-xl p-6 border bg-bb-card border-bb-border"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-bb-text flex items-center gap-2">
                <span style={{ color: colors?.primary }}>✨</span>
                Acerca de ti
              </h2>
            </div>

            {editing ? (
              <textarea
                name="bio"
                value={formData.bio || ''}
                onChange={handleInputChange}
                placeholder="Cuéntanos sobre ti, tus intereses, logros..."
                className="w-full bg-bb-dark border border-bb-border rounded-lg px-4 py-3 text-bb-text placeholder-bb-text-secondary focus:outline-none focus:border-faculty-primary/50 resize-none"
                rows={4}
              />
            ) : (
              <p className="text-bb-text-secondary leading-relaxed text-base">
                {profile.bio || '📝 No hay información personal. ¡Edita tu perfil para agregarlo!'}
              </p>
            )}
            {/* Personalization Section (Theme Switcher) */}
            <div
              className="rounded-xl p-6 border bg-bb-card border-bb-border mb-8 mt-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-bb-text flex items-center gap-2">
                  <span style={{ color: colors?.primary }}>🎨</span>
                  Personalización
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Light Mode Option */}
                <button
                  onClick={() => setThemeMode('light')}
                  className={`group relative p-3 rounded-xl border-2 transition-all duration-300 text-left overflow-hidden ${themeMode === 'light'
                    ? 'border-blue-500 bg-white shadow-md'
                    : 'border-transparent bg-bb-hover hover:border-bb-border'
                    }`}
                >
                  <div className="flex items-center gap-3 relative z-10">
                    <div className={`p-1.5 rounded-lg ${themeMode === 'light' ? 'bg-blue-100 text-blue-600' : 'bg-bb-card text-bb-text-secondary'}`}>
                      <Calendar className="w-4 h-4" />
                    </div>
                    <span className={`font-bold text-sm ${themeMode === 'light' ? 'text-gray-900' : 'text-bb-text-secondary group-hover:text-bb-text'}`}>
                      Modo Claro
                    </span>
                    {themeMode === 'light' && <Award className="w-4 h-4 text-blue-500 ml-auto" />}
                  </div>
                </button>

                {/* Solid Dark Mode Option */}
                <button
                  onClick={() => setThemeMode('dark')}
                  className={`group relative p-3 rounded-xl border-2 transition-all duration-300 text-left overflow-hidden ${themeMode === 'dark'
                    ? 'border-blue-500 bg-black shadow-md shadow-blue-500/10'
                    : 'border-transparent bg-bb-hover hover:border-bb-border'
                    }`}
                >
                  <div className="flex items-center gap-3 relative z-10">
                    <div className={`p-1.5 rounded-lg ${themeMode === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-bb-card text-bb-text-secondary'}`}>
                      <Zap className="w-4 h-4" />
                    </div>
                    <span className={`font-bold text-sm ${themeMode === 'dark' ? 'text-white' : 'text-bb-text-secondary group-hover:text-bb-text'}`}>
                      Modo Oscuro
                    </span>
                    {themeMode === 'dark' && <Award className="w-4 h-4 text-blue-500 ml-auto" />}
                  </div>
                </button>
              </div>
            </div>

          </div>

          {/* Safety & Security Section */}
          <div className="rounded-xl p-6 border bg-bb-card border-bb-border mb-8 mt-8">
            <h2 className="text-xl font-bold text-bb-text flex items-center gap-2 mb-6">
              <span className="text-red-500">🔒</span>
              Seguridad y Privacidad
            </h2>

            <div className="flex flex-col md:flex-row items-center justify-between p-4 rounded-xl bg-red-500/5 border border-red-500/10 gap-4">
              <div>
                <h3 className="text-bb-text font-bold mb-1">Cerrar mi Cuenta</h3>
                <p className="text-bb-text-secondary text-sm">Elimina permanentemente tu cuenta y todos sus datos asociados.</p>
              </div>
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white transition-all text-sm w-full md:w-auto justify-center border border-red-500/20"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar Cuenta
              </button>
            </div>
          </div>

          <DeleteAccountModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
          />

          {/* Footer */}
          <div className="text-center mt-12 text-bb-text-secondary text-xs">
            <p>Última actualización: {new Date(profile.updated_at).toLocaleDateString('es-ES')} </p>
            <p className="mt-2 text-bb-text-secondary/60">ID: {profile.id.substring(0, 8)}...</p>
          </div>
        </div>
      </div>
    </div >
  );
}
