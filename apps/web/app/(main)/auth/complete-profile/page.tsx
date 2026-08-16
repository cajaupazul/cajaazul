'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Instagram, User, School, Sparkles, CheckCircle2, LoaderCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useProfile } from '@/lib/profile-context';
import { supabase } from '@/lib/supabase';
import { isProfileComplete } from '@/lib/profile-completion';

type ProfileGateState = 'checking' | 'ready' | 'error';

const FACULTADES = [
    'Facultad de Ciencias Empresariales',
    'Facultad de Derecho',
    'Facultad de Economía y Finanzas',
    'Facultad de Ingeniería',
];

const FACULTY_COLORS: { [key: string]: string } = {
    'Facultad de Ciencias Empresariales': 'from-blue-600 to-indigo-600',
    'Facultad de Derecho': 'from-red-600 to-orange-600',
    'Facultad de Economía y Finanzas': 'from-emerald-600 to-teal-600',
    'Facultad de Ingeniería': 'from-slate-700 to-slate-900',
};

const FACULTY_LOGOS: { [key: string]: string } = {
    'Facultad de Ciencias Empresariales': '/logo/fce.png',
    'Facultad de Derecho': '/logo/fd.png',
    'Facultad de Economía y Finanzas': '/logo/fef.png',
    'Facultad de Ingeniería': '/logo/fi.png',
};

export default function CompleteProfilePage() {
    const router = useRouter();
    const { refreshProfile } = useProfile();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [gateState, setGateState] = useState<ProfileGateState>('checking');
    const [gateMessage, setGateMessage] = useState('');
    const [formData, setFormData] = useState({
        nombre: '',
        carrera: '',
        instagram: '',
    });

    const verifyProfile = useCallback(async () => {
        setGateState('checking');
        setGateMessage('');

        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError) throw userError;
            if (!user) {
                router.replace('/auth/login');
                return;
            }

            // AUTO-COMPLETE FOR GUESTS (Anonymous)
            if (user.is_anonymous) {
                console.log('[COMPLETE_PROFILE] Guest detected. Auto-creating profile...');
                try {
                    const { error: insertError } = await supabase
                        .from('profiles')
                        .upsert({
                            id: user.id,
                            nombre: 'Invitado',
                            carrera: 'Facultad de Ciencias Empresariales',
                            avatar_url: '/logo/fce.png',
                            universidad: 'Universidad del Pacífico'
                        }, { onConflict: 'id' });

                    if (insertError) throw insertError;

                    await refreshProfile();
                    router.replace('/dashboard');
                    return;
                } catch (err) {
                    console.error('[COMPLETE_PROFILE] Guest auto-creation failed:', err);
                    throw err;
                }
            }

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (profileError) throw profileError;

            if (isProfileComplete(profile)) {
                router.replace('/dashboard');
                return;
            }

            const shouldClearNombre = !profile?.nombre ||
                profile.nombre === profile.google_full_name ||
                profile.nombre === profile.email?.split('@')[0];

            setFormData({
                nombre: shouldClearNombre ? '' : profile?.nombre ?? '',
                carrera: ['Estudiante', 'General', 'Carrera'].includes(profile?.carrera ?? '') ? '' : (profile?.carrera ?? ''),
                instagram: profile?.link_instagram ?? '',
            });
            setGateState('ready');
        } catch (verificationError) {
            console.error('[COMPLETE_PROFILE] Profile verification failed:', verificationError);
            setGateMessage('No pudimos comprobar tu perfil en este momento. Tus datos están seguros; vuelve a intentarlo.');
            setGateState('error');
        }
    }, [router, refreshProfile]);

    useEffect(() => {
        void verifyProfile();
    }, [verifyProfile]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.nombre.trim() || !formData.carrera) {
            setError('Por favor, ingresa un apodo y selecciona tu facultad.');
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No autenticado');

            // Map faculty to logo
            const facultyLogos: { [key: string]: string } = {
                'Facultad de Ciencias Empresariales': '/logo/fce.png',
                'Facultad de Derecho': '/logo/fd.png',
                'Facultad de Economía y Finanzas': '/logo/fef.png',
                'Facultad de Ingeniería': '/logo/fi.png'
            }
            const avatarUrl = facultyLogos[formData.carrera] || '/logo/fce.png';

            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    nombre: formData.nombre.trim(),
                    carrera: formData.carrera,
                    avatar_url: avatarUrl,
                    link_instagram: formData.instagram.trim() || null,
                    universidad: 'Universidad del Pacífico'
                })
                .eq('id', user.id);

            if (updateError) throw updateError;

            // Refrescar el contexto local para que el sidebar se actualice
            await refreshProfile();

            // Navegar directamente
            router.replace('/dashboard');
        } catch (err: any) {
            console.error(err);
            setError('Error al actualizar el perfil: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const facultyGradient = FACULTY_COLORS[formData.carrera] || 'from-slate-400 to-slate-500';

    if (gateState === 'checking') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6" role="status" aria-live="polite">
                <div className="flex flex-col items-center gap-4 text-center">
                    <LoaderCircle className="h-8 w-8 animate-spin text-blue-600" aria-hidden="true" />
                    <div>
                        <p className="font-bold text-slate-900">Preparando tu espacio</p>
                        <p className="mt-1 text-sm text-slate-500">Estamos verificando tu perfil de CampusLink.</p>
                    </div>
                </div>
            </div>
        );
    }

    if (gateState === 'error') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
                <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60 sm:p-10">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-blue-600">
                        <RefreshCw className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-900">No pudimos verificar tu perfil</h1>
                    <p className="mt-3 text-sm leading-6 text-slate-500">{gateMessage}</p>
                    <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                        <Button type="button" variant="outline" onClick={() => router.replace('/auth/login')} className="h-12 flex-1 rounded-xl">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver
                        </Button>
                        <Button type="button" onClick={() => void verifyProfile()} className="h-12 flex-1 rounded-xl bg-slate-900 text-white hover:bg-slate-800">
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Reintentar
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row items-center justify-center p-4 sm:p-8 gap-8">
            {/* Left Side: Preview Panel */}
            <div className="w-full max-w-sm lg:max-w-md animate-in fade-in slide-in-from-left-8 duration-700">
                <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 flex flex-col">
                    {/* Card Header/Cover */}
                    <div className={`h-32 bg-gradient-to-br ${facultyGradient} relative transition-colors duration-500`}>
                        <div className="absolute -bottom-12 left-8">
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-white rounded-full blur-sm opacity-25 group-hover:opacity-50 transition duration-500"></div>
                                <Avatar className="w-24 h-24 border-4 border-white shadow-xl bg-white">
                                    <AvatarImage src={FACULTY_LOGOS[formData.carrera]} className="object-contain p-2" />
                                    <AvatarFallback className="bg-slate-100">
                                        <User className="w-10 h-10 text-slate-300" />
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                        </div>
                    </div>

                    {/* Card Body */}
                    <div className="pt-16 pb-10 px-8">
                        <div className="space-y-1">
                            <h3 className="text-2xl font-black text-slate-900 truncate">
                                {formData.nombre || 'Tu Apodo Aquí'}
                            </h3>
                            <div className="flex items-center gap-1.5 text-blue-600 font-bold text-sm">
                                <School className="w-4 h-4" />
                                <span className="truncate">{formData.carrera || 'Facultad no seleccionada'}</span>
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-pink-500">
                                    <Instagram className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Instagram</p>
                                    <p className="text-sm font-bold text-slate-700">
                                        {formData.instagram ? `@${formData.instagram.replace('@', '')}` : 'No conectado'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex -space-x-2">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200" />
                                ))}
                            </div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Vista Previa</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side: Configuration Form */}
            <div className="w-full max-w-md animate-in fade-in slide-in-from-right-8 duration-700 delay-100">
                <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-2xl border border-slate-100">
                    <div className="mb-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-black uppercase tracking-widest mb-4">
                            <Sparkles className="w-3 h-3" />
                            Personalización
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
                            Personaliza tu <span className="text-blue-600 tracking-tighter italic">perfil.</span>
                        </h1>
                        <p className="mt-3 text-slate-500 font-medium leading-relaxed">
                            Crea la identidad que verán tus compañeros en CampusLink.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 border border-red-100 text-red-600 px-5 py-4 rounded-2xl text-sm font-bold flex items-center gap-3 animate-in fade-in zoom-in-95">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="nombre" className="text-slate-700 font-bold text-sm ml-1 flex items-center gap-2">
                                <User className="w-4 h-4 text-blue-500" />
                                Define tu Apodo
                            </Label>
                            <Input
                                id="nombre"
                                value={formData.nombre}
                                onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                                placeholder="Ej: Alexis UP"
                                className="h-14 px-5 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl transition-all font-bold placeholder:font-medium"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="instagram" className="text-slate-700 font-bold text-sm ml-1 flex items-center gap-2">
                                <Instagram className="w-4 h-4 text-pink-500" />
                                Instagram (Opcional)
                            </Label>
                            <Input
                                id="instagram"
                                value={formData.instagram}
                                onChange={(e) => setFormData(prev => ({ ...prev, instagram: e.target.value }))}
                                placeholder="@tu_usuario"
                                className="h-14 px-5 border-slate-200 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 rounded-2xl transition-all font-bold placeholder:font-medium"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="carrera" className="text-slate-700 font-bold text-sm ml-1 flex items-center gap-2">
                                <School className="w-4 h-4 text-indigo-500" />
                                Tu Facultad
                            </Label>
                            <Select value={formData.carrera} onValueChange={(val) => setFormData(prev => ({ ...prev, carrera: val }))}>
                                <SelectTrigger className="h-14 px-5 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl transition-all bg-white font-bold">
                                    <SelectValue placeholder="Selecciona tu facultad" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-slate-200 shadow-2xl p-2">
                                    {FACULTADES.map((fac) => (
                                        <SelectItem key={fac} value={fac} className="rounded-xl py-3 focus:bg-slate-50 font-bold">
                                            {fac}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-slate-900 hover:bg-black text-white font-black text-lg h-16 rounded-[1.5rem] shadow-2xl shadow-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98] mt-4 flex items-center justify-center gap-3 group"
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>Comenzar ahora</span>
                                    <CheckCircle2 className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                </>
                            )}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
