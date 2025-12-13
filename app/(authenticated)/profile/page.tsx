'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';

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
  const bgInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (contextProfile) {
      setProfile(contextProfile);
      setFormData(contextProfile);
      if (contextProfile.background_url) {
        setBackgroundImage(contextProfile.background_url);
      }
      setLoading(false);
    }
  }, [contextProfile]);

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `bg-${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `backgrounds/${fileName}`;

      // Eliminar archivo anterior si existe
      try {
        const { data: files } = await supabase.storage
          .from('profile-avatars')
          .list('backgrounds');

        if (files) {
          for (const file of files) {
            if (file.name.startsWith(`bg-${profile.id}`)) {
              await supabase.storage
                .from('profile-avatars')
                .remove([`backgrounds/${file.name}`]);
            }
          }
        }
      } catch (err) {
        console.log('No previous background to delete');
      }

      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('profile-avatars').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ background_url: data.publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, background_url: data.publicUrl });
      setBackgroundImage(data.publicUrl);
      updateProfile({ ...profile, background_url: data.publicUrl });
      console.log('Background uploaded successfully:', data.publicUrl);
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

      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('profile-avatars').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: data.publicUrl });
      setFormData({ ...formData, avatar_url: data.publicUrl });
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

      setProfile({ ...profile, ...formData });
      updateProfile({ ...profile, ...formData });
      setEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
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
    <div className="min-h-screen bg-black overflow-hidden">
      {/* Background with gradient overlay */}
      <div className="relative min-h-screen">
        {/* Background Image */}
        <div
          className="absolute inset-0 h-96 bg-cover bg-center"
          style={{
            backgroundImage: backgroundImage
              ? `url(${backgroundImage})`
              : `linear-gradient(135deg, ${colors?.primary}30 0%, ${colors?.primary}10 100%)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black" />

          {/* Background edit button */}
          {editing && (
            <button
              onClick={() => bgInputRef.current?.click()}
              className="absolute top-4 right-4 p-3 rounded-full backdrop-blur-md bg-black/50 hover:bg-black/70 text-white transition"
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
            </button>
          )}
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Profile Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 mb-12 mt-20">
            {/* Avatar */}
            <div className="relative">
              <div
                className="w-32 sm:w-40 h-32 sm:h-40 rounded-3xl border-4 shadow-2xl overflow-hidden flex-shrink-0"
                style={{ borderColor: colors?.primary }}
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.nombre}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-white text-5xl font-bold"
                    style={{ backgroundColor: colors?.primary }}
                  >
                    {profile.nombre?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Avatar Upload Button */}
              {editing && (
                <label className="absolute bottom-2 right-2 cursor-pointer">
                  <div
                    className="p-3 rounded-full text-white shadow-lg hover:opacity-90 transition-all hover:scale-110"
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
            <div className="flex-1 min-w-0">
              <div className="mb-2">
                <h1 className="text-5xl font-bold text-white mb-1">
                  {editing ? (
                    <input
                      type="text"
                      name="nombre"
                      value={formData.nombre || ''}
                      onChange={handleInputChange}
                      className="bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white w-full backdrop-blur"
                    />
                  ) : (
                    profile.nombre
                  )}
                </h1>
                <div className="flex items-center gap-4 text-gray-300 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span>{userEmail}</span>
                  </div>
                  {profile.link_instagram && !editing && (
                    <a
                      href={profile.link_instagram.startsWith('http') ? profile.link_instagram : `https://instagram.com/${profile.link_instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 hover:text-white transition-colors"
                    >
                      <Instagram className="w-4 h-4 text-pink-500" />
                      <span>@{profile.link_instagram.replace('https://instagram.com/', '').replace('/', '')}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => {
                    if (editing) handleSave();
                    else setEditing(true);
                  }}
                  className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all duration-200 text-white hover:scale-105"
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
                    onClick={() => {
                      setEditing(false);
                      setFormData(profile);
                    }}
                    className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur"
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
            <div
              className="rounded-xl p-6 border backdrop-blur transition-all hover:shadow-lg cursor-pointer"
              style={{
                backgroundColor: '#1a1a1a90',
                borderColor: colors?.primary + '40'
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Puntos</p>
                  <p className="text-4xl font-bold" style={{ color: colors?.primary }}>
                    {profile.puntos}
                  </p>
                </div>
                <Zap className="w-12 h-12" style={{ color: colors?.primary, opacity: 0.2 }} />
              </div>
            </div>

            {/* Miembro desde */}
            <div
              className="rounded-xl p-6 border backdrop-blur transition-all hover:shadow-lg cursor-pointer"
              style={{
                backgroundColor: '#1a1a1a90',
                borderColor: colors?.primary + '40'
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Miembro desde</p>
                  <p className="text-3xl font-bold text-white">
                    {new Date(profile.created_at).getFullYear()}
                  </p>
                </div>
                <Calendar className="w-12 h-12" style={{ color: colors?.primary, opacity: 0.2 }} />
              </div>
            </div>

            {/* Logros */}
            <div
              className="rounded-xl p-6 border backdrop-blur transition-all hover:shadow-lg cursor-pointer"
              style={{
                backgroundColor: '#1a1a1a90',
                borderColor: colors?.primary + '40'
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Logros</p>
                  <p className="text-3xl font-bold text-white">
                    {Math.floor(profile.puntos / 50)}
                  </p>
                </div>
                <Award className="w-12 h-12" style={{ color: colors?.primary, opacity: 0.2 }} />
              </div>
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div
              className="p-4 rounded-lg border backdrop-blur"
              style={{
                backgroundColor: '#1a1a1a80',
                borderColor: colors?.primary + '40'
              }}
            >
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" style={{ color: colors?.primary }} />
                Universidad
              </div>
              {editing ? (
                <input
                  type="text"
                  name="universidad"
                  value={formData.universidad || ''}
                  onChange={handleInputChange}
                  className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-white/40"
                />
              ) : (
                <div className="text-white font-semibold text-lg">
                  {profile.universidad || 'No especificada'}
                </div>
              )}
            </div>

            <div
              className="p-4 rounded-lg border backdrop-blur"
              style={{
                backgroundColor: '#1a1a1a80',
                borderColor: colors?.primary + '40'
              }}
            >
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4" style={{ color: colors?.primary }} />
                Carrera
              </div>
              {editing ? (
                <input
                  type="text"
                  name="carrera"
                  value={formData.carrera || ''}
                  onChange={handleInputChange}
                  className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-white/40"
                />
              ) : (
                <div className="text-white font-semibold text-lg">
                  {profile.carrera || 'No especificada'}
                </div>
              )}
            </div>

            <div
              className="p-4 rounded-lg border backdrop-blur"
              style={{
                backgroundColor: '#1a1a1a80',
                borderColor: colors?.primary + '40'
              }}
            >
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Instagram className="w-4 h-4" style={{ color: colors?.primary }} />
                Instagram
              </div>
              {editing ? (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">instagram.com/</span>
                  <input
                    type="text"
                    name="link_instagram"
                    value={formData.link_instagram?.replace('https://instagram.com/', '') || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, link_instagram: e.target.value }))}
                    placeholder="usuario"
                    className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-white/40"
                  />
                </div>
              ) : (
                profile.link_instagram ? (
                  <a
                    href={`https://instagram.com/${profile.link_instagram.replace('https://instagram.com/', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white font-semibold text-lg hover:underline truncate block"
                  >
                    @{profile.link_instagram.replace('https://instagram.com/', '')}
                  </a>
                ) : (
                  <div className="text-gray-500 italic">No vinculado</div>
                )
              )}
            </div>
          </div>

          {/* Bio Section */}
          <div
            className="rounded-xl p-6 border backdrop-blur"
            style={{
              backgroundColor: '#1a1a1a80',
              borderColor: colors?.primary + '40'
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
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
                className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/40 resize-none"
                rows={4}
              />
            ) : (
              <p className="text-gray-200 leading-relaxed text-base">
                {profile.bio || '📝 No hay información personal. ¡Edita tu perfil para agregarlo!'}
              </p>
            )}
            {/* Personalization Section (Theme Switcher) */}
            <div
              className="rounded-xl p-6 border backdrop-blur mb-8"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-color)'
              }}
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
                    ? 'border-blue-500 bg-white'
                    : 'border-transparent bg-gray-100 dark:bg-zinc-900 hover:border-gray-300 dark:hover:border-zinc-700'
                    }`}
                >
                  <div className="flex items-center gap-3 relative z-10">
                    <div className={`p-1.5 rounded-lg ${themeMode === 'light' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 dark:bg-zinc-800 text-gray-500'}`}>
                      <Calendar className="w-4 h-4" />
                    </div>
                    <span className={`font-bold text-sm ${themeMode === 'light' ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-200'}`}>
                      Modo Claro
                    </span>
                    {themeMode === 'light' && <Award className="w-4 h-4 text-blue-500 ml-auto" />}
                  </div>
                </button>

                {/* Solid Dark Mode Option */}
                <button
                  onClick={() => setThemeMode('dark')}
                  className={`group relative p-3 rounded-xl border-2 transition-all duration-300 text-left overflow-hidden ${themeMode === 'dark'
                    ? 'border-blue-500 bg-[#0f0f0f]'
                    : 'border-transparent bg-gray-100 dark:bg-zinc-900 hover:border-gray-300 dark:hover:border-zinc-700'
                    }`}
                >
                  <div className="flex items-center gap-3 relative z-10">
                    <div className={`p-1.5 rounded-lg ${themeMode === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-gray-200 dark:bg-zinc-800 text-gray-500'}`}>
                      <Zap className="w-4 h-4" />
                    </div>
                    <span className={`font-bold text-sm ${themeMode === 'dark' ? 'text-white' : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-200'}`}>
                      Dark Sólido
                    </span>
                    {themeMode === 'dark' && <Award className="w-4 h-4 text-blue-500 ml-auto" />}
                  </div>
                </button>

                {/* Glass Mode Option */}
                <button
                  onClick={() => setThemeMode('glass')}
                  className={`group relative p-3 rounded-xl border-2 transition-all duration-300 text-left overflow-hidden ${themeMode === 'glass'
                    ? 'border-blue-500'
                    : 'border-transparent bg-gray-100 dark:bg-zinc-900 hover:border-gray-300 dark:hover:border-zinc-700'
                    }`}
                  style={themeMode === 'glass' ? { background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' } : {}}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="flex items-center gap-3 relative z-10">
                    <div className={`p-1.5 rounded-lg ${themeMode === 'glass' ? 'bg-white/10 text-blue-300' : 'bg-gray-200 dark:bg-zinc-800 text-gray-500'}`}>
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <span className={`font-bold text-sm ${themeMode === 'glass' ? 'text-white' : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-200'}`}>
                      Dark Glass
                    </span>
                    {themeMode === 'glass' && <Award className="w-4 h-4 text-blue-500 ml-auto" />}
                  </div>
                </button>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="text-center mt-12 text-gray-500 text-xs">
            <p>Última actualización: {new Date(profile.updated_at).toLocaleDateString('es-ES')} </p>
            <p className="mt-2 text-gray-600">ID: {profile.id.substring(0, 8)}...</p>
          </div>
        </div>
      </div>
    </div >
  );
}