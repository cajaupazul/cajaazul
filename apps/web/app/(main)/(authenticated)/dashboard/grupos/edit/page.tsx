'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, getStorageUrl } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { ArrowLeft, Upload, Save, Loader2, Image as ImageIcon, Camera } from 'lucide-react';
import { uploadFileToR2, deleteFileFromR2 } from '@/lib/r2-storage';
import Link from 'next/link';

export default function EditGroupPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const groupId = searchParams.get('id');
    const { colors, themeMode } = useTheme();
    const { profile } = useProfile();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [grupo, setGrupo] = useState<any>(null);

    // Form States
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [linkWhatsapp, setLinkWhatsapp] = useState('');
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [bannerUrl, setBannerUrl] = useState<string | null>(null);

    // Upload States
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);

    // Previews
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [bannerPreview, setBannerPreview] = useState<string | null>(null);

    useEffect(() => {
        const fetchGroup = async () => {
            if (!groupId) {
                router.push('/dashboard/grupos');
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('grupos')
                    .select('*')
                    .eq('id', groupId)
                    .single();

                if (error) throw error;
                if (!data) throw new Error('Grupo no encontrado');

                // Check permissions (Admin/Creator only)
                // Note: ideally we should double check this against members table role too, 
                // but for now relying on creator_id match or admin role
                if (data.created_by !== profile?.id && profile?.role !== 'admin' && profile?.role !== 'superadmin') {
                    alert('No tienes permisos para editar este grupo.');
                    router.push(`/dashboard/grupos/view?id=${groupId}`);
                    return;
                }

                setGrupo(data);
                setNombre(data.nombre);
                setDescripcion(data.descripcion || '');
                setLinkWhatsapp(data.link_whatsapp || '');
                setLogoUrl(data.logo_url);
                setBannerUrl(data.banner_url);
            } catch (error) {
                console.error('Error fetching group:', error);
                router.push('/dashboard/grupos');
            } finally {
                setLoading(false);
            }
        };

        if (profile) {
            fetchGroup();
        }
    }, [groupId, profile, router]);

    const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setBannerFile(file);
            setBannerPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (!grupo || !profile) return;
        setSaving(true);

        try {
            let finalLogoUrl = logoUrl;
            let finalBannerUrl = bannerUrl;

            // 1. Upload new Logo + Delete Old
            if (logoFile) {
                setUploadingLogo(true);
                // Clean up old logo if it exists
                if (grupo.logo_url) {
                    await deleteFileFromR2('grupos', grupo.logo_url);
                }

                const fileExt = logoFile.name.split('.').pop();
                const fileName = `${profile.id}/logo-${Date.now()}.${fileExt}`;
                await uploadFileToR2('grupos', fileName, logoFile);
                finalLogoUrl = fileName;
                setUploadingLogo(false);
            }

            // 2. Upload new Banner + Delete Old
            if (bannerFile) {
                setUploadingBanner(true);
                // Clean up old banner if it exists
                if (grupo.banner_url) {
                    await deleteFileFromR2('grupos', grupo.banner_url);
                }

                const fileExt = bannerFile.name.split('.').pop();
                const fileName = `${profile.id}/banner-${Date.now()}.${fileExt}`;
                await uploadFileToR2('grupos', fileName, bannerFile);
                finalBannerUrl = fileName;
                setUploadingBanner(false);
            }

            // 3. Update Database
            const { error } = await supabase
                .from('grupos')
                .update({
                    nombre,
                    descripcion,
                    link_whatsapp: linkWhatsapp,
                    logo_url: finalLogoUrl,
                    banner_url: finalBannerUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', grupo.id);

            if (error) throw error;

            router.push(`/dashboard/grupos/view?id=${grupo.id}`);
            router.refresh();

        } catch (error) {
            console.error('Error saving group:', error);
            alert('Error al guardar los cambios.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${themeMode === 'light' ? 'bg-gray-50' : 'bg-[#0a0a0a]'}`}>
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className={`min-h-screen pb-20 ${themeMode === 'light' ? 'bg-gray-50 text-gray-900' : 'bg-[#0a0a0a] text-white'}`}>
            {/* Header */}
            <header className={`sticky top-0 z-40 border-b backdrop-blur-xl ${themeMode === 'light' ? 'bg-white/80 border-gray-200' : 'bg-[#0a0a0a]/80 border-white/5'}`}>
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/dashboard/grupos/view?id=${groupId}`} className={`p-2 rounded-full transition-colors ${themeMode === 'light' ? 'hover:bg-gray-100' : 'hover:bg-white/10'}`}>
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-lg font-bold uppercase tracking-wide">Editar Grupo</h1>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving || uploadingLogo || uploadingBanner || !nombre.trim()}
                        className={`flex items-center gap-2 px-6 py-2 rounded-full font-black uppercase text-xs tracking-widest transition-all ${saving
                            ? 'opacity-50 cursor-not-allowed bg-gray-500 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20'}`}
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">

                {/* Banner & Logo Section */}
                <section className="space-y-6">
                    <div className="relative group rounded-3xl overflow-hidden aspect-[3/1] bg-gray-800 border-2 border-dashed border-gray-700 hover:border-blue-500 transition-colors">
                        {(bannerPreview || bannerUrl) ? (
                            <img
                                src={bannerPreview || getStorageUrl(bannerUrl, 'grupos')}
                                alt="Banner"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center w-full h-full text-gray-500">
                                <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
                                <span className="text-xs font-bold uppercase tracking-wider">Subir portada del grupo</span>
                            </div>
                        )}

                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <label className="cursor-pointer bg-black/50 hover:bg-black/70 text-white px-6 py-3 rounded-full font-bold backdrop-blur-sm border border-white/20 flex items-center gap-2 transition-transform hover:scale-105">
                                <Camera className="w-4 h-4" />
                                <span>Cambiar Portada</span>
                                <input type="file" accept="image/png, image/jpeg, image/jpg, image/webp, image/gif" onChange={handleBannerSelect} className="hidden" />
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-center -mt-16 relative z-10">
                        <div className="relative group">
                            <div className={`w-32 h-32 rounded-full border-4 shadow-xl overflow-hidden flex items-center justify-center bg-[#1a1a1a] ${themeMode === 'light' ? 'border-white' : 'border-[#0a0a0a]'}`}>
                                {(logoPreview || logoUrl) ? (
                                    <img
                                        src={logoPreview || getStorageUrl(logoUrl, 'grupos')}
                                        alt="Logo"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-4xl font-black text-white/20 select-none">
                                        {nombre.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <label className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 cursor-pointer flex items-center justify-center text-white transition-opacity">
                                <Upload className="w-6 h-6" />
                                <input type="file" accept="image/png, image/jpeg, image/jpg, image/webp, image/gif" onChange={handleLogoSelect} className="hidden" />
                            </label>
                        </div>
                    </div>
                </section>

                {/* Form Fields */}
                <section className="space-y-6 max-w-2xl mx-auto">
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-blue-500 px-1">Nombre del Grupo</label>
                        <input
                            type="text"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Ej. Club de Lectura"
                            className={`w-full px-5 py-4 rounded-2xl font-bold bg-transparent border-2 focus:outline-none focus:border-blue-500 transition-all ${themeMode === 'light' ? 'border-gray-200 text-gray-900' : 'border-white/10 text-white'}`}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-blue-500 px-1">Enlace de WhatsApp</label>
                        <input
                            type="url"
                            value={linkWhatsapp}
                            onChange={(e) => setLinkWhatsapp(e.target.value)}
                            placeholder="https://chat.whatsapp.com/..."
                            className={`w-full px-5 py-4 rounded-2xl font-bold bg-transparent border-2 focus:outline-none focus:border-green-500 transition-all ${themeMode === 'light' ? 'border-gray-200 text-gray-900' : 'border-white/10 text-white'}`}
                        />
                        <p className="text-[10px] opacity-50 px-2 font-medium">Enlace para que los miembros se unan al chat grupal.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-blue-500 px-1">Descripción</label>
                        <textarea
                            value={descripcion}
                            onChange={(e) => setDescripcion(e.target.value)}
                            rows={6}
                            placeholder="Describe de qué trata este grupo..."
                            className={`w-full px-5 py-4 rounded-2xl font-medium bg-transparent border-2 focus:outline-none focus:border-blue-500 transition-all resize-none ${themeMode === 'light' ? 'border-gray-200 text-gray-900' : 'border-white/10 text-white'}`}
                        />
                    </div>
                </section>
            </main>
        </div>
    );
}
