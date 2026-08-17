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
  MapPin,
  ExternalLink,
  Pencil,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';
import styles from './ProfilePage.module.css';

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
  const canUseCustomBackground = isAdmin || inventory.includes(PERMISSIONS.CUSTOM_BACKGROUND);
  const canUseCustomAvatar = isAdmin || inventory.includes(PERMISSIONS.CUSTOM_AVATAR);
  const storeIsAvailable = !sidebarVisibility['Tienda'];

  return (
    <div
      className={styles.page}
      style={{ '--profile-accent': colors?.primary || '#1677ff' } as React.CSSProperties}
    >
      <div className={styles.container}>
        <section className={styles.profileHero} aria-labelledby="profile-name">
          <div className={styles.cover}>
            <img
              key={backgroundImage}
              src={getStorageUrl(backgroundImage, 'profile-avatars', PLACEHOLDERS.BACKGROUND)}
              alt="Portada del perfil"
              className={styles.coverImage}
            />

            <div className={styles.coverActions}>
              {instagramUsername && !editing && (
                <a
                  href={profile.link_instagram?.startsWith('http') ? profile.link_instagram : `https://instagram.com/${instagramUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.coverButton}
                >
                  <Instagram aria-hidden="true" />
                  <span>@{instagramUsername}</span>
                </a>
              )}

              {editing && !uploadingBackground && (canUseCustomBackground || storeIsAvailable) && (
                <button
                  type="button"
                  onClick={() => {
                    if (canUseCustomBackground) {
                      bgInputRef.current?.click();
                    } else if (storeIsAvailable) {
                      router.push('/dashboard/store');
                    }
                  }}
                  className={styles.coverButton}
                >
                  <Camera aria-hidden="true" />
                  <span>{canUseCustomBackground ? 'Cambiar portada' : 'Obtener en tienda'}</span>
                  <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBackgroundUpload} hidden />
                </button>
              )}
            </div>
          </div>

          <div className={styles.identityPanel}>
            <div className={styles.avatarArea}>
              <div className={styles.avatarFrame}>
                <AvatarWithFrame
                  size={132}
                  avatarUrl={getStorageUrl(formData.avatar_url || profile.avatar_url, 'profile-avatars', PLACEHOLDERS.AVATAR)}
                  frameUrl={equippedFrame?.image_url}
                  frameScale={equippedFrame?.frame_settings?.profile?.scale}
                  offsetX={equippedFrame?.frame_settings?.profile?.x}
                  offsetY={equippedFrame?.frame_settings?.profile?.y}
                  name={profile.nombre}
                />
              </div>

              {editing && !uploadingAvatar && (
                <button
                  type="button"
                  onClick={() => setIsAvatarSelectorOpen(true)}
                  className={styles.avatarEditButton}
                  aria-label="Cambiar avatar"
                >
                  <Camera aria-hidden="true" />
                  <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleFileUpload} hidden />
                </button>
              )}
            </div>

            <div className={styles.identityCopy}>
              <div className={styles.nameRow}>
                {editing ? (
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre || ''}
                    onChange={handleInputChange}
                    className={styles.nameInput}
                    aria-label="Nombre visible"
                  />
                ) : (
                  <h1 id="profile-name">{profile.nombre}</h1>
                )}

                <div className={styles.accountBadges}>
                  {isAdmin && (
                    <span className={styles.accountBadge}>
                      <ShieldCheck aria-hidden="true" /> Administrador
                    </span>
                  )}
                  {isVip && (
                    <span className={styles.accountBadge}>
                      <img src="/vip-icon.png" alt="" /> VIP
                    </span>
                  )}
                </div>
              </div>

              {editing ? (
                <textarea
                  name="bio"
                  value={formData.bio || ''}
                  onChange={handleInputChange}
                  placeholder="Cuéntale algo a la comunidad..."
                  className={styles.bioInput}
                />
              ) : (
                <p className={styles.bio}>{profile.bio || 'Aún no has agregado una descripción.'}</p>
              )}

              <div className={styles.contactList}>
                <span><Mail aria-hidden="true" /> {userEmail}</span>
                <span>
                  <img src="/icons/moneda.png" alt="" className={styles.coinIcon} />
                  {profile.monedas} monedas
                </span>
              </div>
            </div>

            <div className={styles.profileActions}>
              {editing ? (
                <>
                  <button type="button" onClick={handleSave} className={styles.primaryButton}>
                    <Save aria-hidden="true" /> Guardar cambios
                  </button>
                  <button type="button" onClick={handleCancel} className={styles.secondaryButton}>
                    <X aria-hidden="true" /> Cancelar
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setEditing(true)} className={styles.primaryButton}>
                  <Pencil aria-hidden="true" /> Editar perfil
                </button>
              )}
            </div>
          </div>
        </section>

        <div className={styles.contentGrid}>
          <div className={styles.mainContent}>
            <section className={styles.statsGrid} aria-label="Resumen de actividad">
              <article className={styles.statCard}>
                <span className={styles.statIcon}><Zap aria-hidden="true" /></span>
                <div><strong>{profile.puntos}</strong><span>Puntos de actividad</span></div>
              </article>
              <article className={styles.statCard}>
                <span className={styles.statIcon}><Calendar aria-hidden="true" /></span>
                <div><strong>{memberYear}</strong><span>Año de ingreso</span></div>
              </article>
              <article className={styles.statCard}>
                <span className={styles.statIcon}><Award aria-hidden="true" /></span>
                <div><strong>{achievements}</strong><span>Logros obtenidos</span></div>
              </article>
            </section>

            <section className={styles.sectionCard}>
              <header className={styles.sectionHeader}>
                <div>
                  <span>Información académica</span>
                  <h2>Tu identidad dentro del campus</h2>
                </div>
              </header>

              <div className={styles.academicGrid}>
                <div className={styles.academicItem}>
                  <span className={styles.academicIcon}><MapPin aria-hidden="true" /></span>
                  <div><small>Universidad</small><strong>{profile.universidad || 'Pendiente'}</strong></div>
                </div>
                <div className={styles.academicItem}>
                  <span className={styles.academicIcon}><BookOpen aria-hidden="true" /></span>
                  <div><small>Facultad o carrera</small><strong>{profile.carrera || 'No especificado'}</strong></div>
                </div>
              </div>

              {editing && (
                <label className={styles.field}>
                  <span>Usuario de Instagram</span>
                  <div className={styles.fieldControl}>
                    <Instagram aria-hidden="true" />
                    <input
                      type="text"
                      value={formData.link_instagram?.replace('https://instagram.com/', '') || ''}
                      onChange={(event) => setFormData((previous) => ({ ...previous, link_instagram: event.target.value }))}
                      placeholder="tu_usuario"
                    />
                  </div>
                </label>
              )}
            </section>
          </div>

          <aside className={styles.settingsColumn} aria-label="Configuración del perfil">
            <section className={styles.settingsCard}>
              <div className={styles.settingsHeading}>
                <span>Apariencia</span>
                <h2>Modo de visualización</h2>
                <p>Elige el contraste que prefieras para toda la plataforma.</p>
              </div>
              <div className={styles.themeSelector} role="group" aria-label="Tema de la plataforma">
                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  className={themeMode === 'light' ? styles.themeActive : ''}
                  aria-pressed={themeMode === 'light'}
                >
                  <Sun aria-hidden="true" /> Claro
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={themeMode === 'dark' ? styles.themeActive : ''}
                  aria-pressed={themeMode === 'dark'}
                >
                  <Moon aria-hidden="true" /> Oscuro
                </button>
              </div>
            </section>

            <section className={styles.settingsCard}>
              <div className={styles.settingsHeading}>
                <span>Cuenta</span>
                <h2>Estado del perfil</h2>
              </div>
              <dl className={styles.accountDetails}>
                <div><dt>Actualizado</dt><dd>{new Date(profile.updated_at).toLocaleDateString()}</dd></div>
                <div><dt>Identificador</dt><dd>{profile.id.substring(0, 12).toUpperCase()}</dd></div>
              </dl>
              <button type="button" onClick={() => setIsDeleteModalOpen(true)} className={styles.dangerButton}>
                <Trash2 aria-hidden="true" /> Eliminar cuenta
              </button>
            </section>
          </aside>
        </div>
      </div>

      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      />

      {/* Free Avatar Selector Modal */}
      {isAvatarSelectorOpen && (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="avatar-dialog-title">
            <div className={styles.modalHeader}>
              <div>
                <span>Personalización</span>
                <h2 id="avatar-dialog-title">Selecciona un avatar</h2>
              </div>
              <button type="button" onClick={() => setIsAvatarSelectorOpen(false)} aria-label="Cerrar selector">
                <X aria-hidden="true" />
              </button>
            </div>

            <div className={styles.avatarGrid}>
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
                    className={`${styles.avatarOption} ${isSelected ? styles.avatarOptionSelected : ''}`}
                  >
                    <img src={url} alt="Avatar disponible" />
                    {isSelected && (
                      <span className={styles.selectedMark}><CheckCircle2 aria-hidden="true" /></span>
                    )}
                  </button>
                );
              })}

              <p className={styles.avatarGroupLabel}>Logo de tu facultad</p>

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
                      className={`${styles.avatarOption} ${styles.facultyOption} ${isSelected ? styles.avatarOptionSelected : ''}`}
                      title={facName}
                    >
                      <img src={url} alt={facName} />
                      {isSelected && (
                        <span className={styles.selectedMark}><CheckCircle2 aria-hidden="true" /></span>
                      )}
                    </button>
                  );
                })}

              {/* Only show custom upload if user has permission, is admin, or if store is not hidden for users */}
              {(canUseCustomAvatar || storeIsAvailable) && (
                <div className={styles.customAvatarArea}>
                  <p>Avatar personalizado</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (canUseCustomAvatar) {
                        avatarInputRef.current?.click();
                        setIsAvatarSelectorOpen(false);
                      } else if (storeIsAvailable) {
                        router.push('/dashboard/store');
                      }
                    }}
                    className={styles.customAvatarButton}
                  >
                    <span className={styles.customAvatarIcon}><Camera aria-hidden="true" /></span>
                    <span><strong>Subir desde tu equipo</strong><small>{canUseCustomAvatar ? 'PNG, JPG o WEBP' : 'Disponible en la tienda'}</small></span>
                    {!canUseCustomAvatar && (
                      <ExternalLink aria-hidden="true" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
