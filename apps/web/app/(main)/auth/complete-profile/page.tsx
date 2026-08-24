'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Instagram,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  School,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProfile } from '@/lib/profile-context';
import { isProfileComplete } from '@/lib/profile-completion';
import { supabase } from '@/lib/supabase';

type ProfileGateState = 'checking' | 'ready' | 'error';

const FACULTIES = [
  'Facultad de Ciencias Empresariales',
  'Facultad de Derecho',
  'Facultad de Economía y Finanzas',
  'Facultad de Ingeniería',
] as const;

const FACULTY_ACCENTS: Record<string, string> = {
  'Facultad de Ciencias Empresariales': '#155eef',
  'Facultad de Derecho': '#b42318',
  'Facultad de Economía y Finanzas': '#067647',
  'Facultad de Ingeniería': '#344054',
};

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'CL';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

export default function CompleteProfilePage() {
  const router = useRouter();
  const { refreshProfile } = useProfile();
  const [gateState, setGateState] = useState<ProfileGateState>('checking');
  const [gateMessage, setGateMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nombre: '', carrera: '', instagram: '' });

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

      // Guest mode is intentionally ephemeral. It must not create a fake faculty
      // or persist a synthetic profile that looks like a completed account.
      if (user.is_anonymous) {
        router.replace('/dashboard');
        return;
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

      const metadataAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
      const savedCareer = profile?.carrera?.trim() ?? '';
      setPreviewAvatar(profile?.avatar_url || metadataAvatar);
      setFormData({
        nombre: profile?.nombre?.trim() || user.user_metadata?.full_name || '',
        carrera: ['Estudiante', 'General', 'Carrera'].includes(savedCareer) ? '' : savedCareer,
        instagram: profile?.link_instagram ?? '',
      });
      setGateState('ready');
    } catch (verificationError) {
      console.error('[COMPLETE_PROFILE] Profile verification failed:', verificationError);
      setGateMessage('No pudimos comprobar tu perfil en este momento. Vuelve a intentarlo en unos segundos.');
      setGateState('error');
    }
  }, [router]);

  useEffect(() => { void verifyProfile(); }, [verifyProfile]);

  const accent = FACULTY_ACCENTS[formData.carrera] || '#155eef';
  const cleanInstagram = useMemo(
    () => formData.instagram.trim().replace(/^@+/, ''),
    [formData.instagram],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const nombre = formData.nombre.trim();
    if (nombre.length < 2) {
      setError('Tu nombre visible debe tener al menos 2 caracteres.');
      return;
    }
    if (!formData.carrera) {
      setError('Selecciona tu facultad para continuar.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw userError || new Error('La sesión ya no está disponible.');

      const updates: Record<string, string | null> = {
        nombre,
        carrera: formData.carrera,
        link_instagram: cleanInstagram || null,
        universidad: 'Universidad del Pacífico',
      };
      if (previewAvatar) updates.avatar_url = previewAvatar;

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      if (updateError) throw updateError;

      await refreshProfile();
      router.replace('/dashboard');
      router.refresh();
    } catch (submitError) {
      console.error('[COMPLETE_PROFILE] Profile update failed:', submitError);
      setError(submitError instanceof Error ? submitError.message : 'No pudimos guardar tu perfil.');
    } finally {
      setLoading(false);
    }
  }

  if (gateState === 'checking') {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f4f1e8] px-6" role="status" aria-live="polite">
        <div className="text-center">
          <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-[#155eef]" aria-hidden="true" />
          <p className="mt-4 text-sm font-bold text-[#102a25]">Preparando tu perfil</p>
          <p className="mt-1 text-xs text-[#66756f]">Solo tomará un momento.</p>
        </div>
      </main>
    );
  }

  if (gateState === 'error') {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f4f1e8] px-5">
        <section className="w-full max-w-md border border-[#d8d6cf] bg-white p-7 sm:p-9">
          <div className="grid h-11 w-11 place-items-center bg-[#e9efff] text-[#155eef]"><RefreshCw className="h-5 w-5" /></div>
          <h1 className="mt-6 text-2xl font-black tracking-[-0.04em] text-[#102a25]">No pudimos abrir tu perfil</h1>
          <p className="mt-3 text-sm leading-6 text-[#66756f]">{gateMessage}</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={() => router.replace('/auth/login')} className="h-12 rounded-none border-[#c9cec9]">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver
            </Button>
            <Button type="button" onClick={() => void verifyProfile()} className="h-12 rounded-none bg-[#102a25] hover:bg-[#193b34]">
              <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f4f1e8] p-0 text-[#102a25] lg:p-6 xl:p-8">
      <div className="mx-auto grid min-h-dvh max-w-[1440px] overflow-hidden bg-[#fbfaf6] lg:min-h-[calc(100dvh-3rem)] lg:grid-cols-[0.92fr_1.08fr] lg:border lg:border-[#d8d6cf] xl:min-h-[calc(100dvh-4rem)]">
        <section className="relative flex min-h-[300px] flex-col overflow-hidden bg-[#155eef] p-6 text-white sm:min-h-[350px] sm:p-9 lg:min-h-0 lg:p-12">
          <div className="absolute inset-0 opacity-15" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '72px 72px' }} />
          <div className="relative flex items-center gap-3">
            <img src="/logo/logo-campuslink-v2.png" alt="CampusLink" className="h-11 w-11 rounded-lg bg-white object-contain p-1.5" />
            <span className="text-lg font-black tracking-[-0.03em]">CampusLink</span>
          </div>

          <div className="relative mt-10 max-w-xl lg:mt-20">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/75">Tu cuenta está lista</p>
            <h1 className="mt-4 max-w-lg text-4xl font-black leading-[0.98] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
              Ahora hazla realmente tuya.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/75 sm:text-base">
              Elige cómo te verá la comunidad. Tu facultad nunca se asignará automáticamente.
            </p>
          </div>

          <div className="relative mt-auto hidden pt-10 lg:block">
            <div className="max-w-md border border-white/25 bg-[#0f4ed0] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/65">Vista previa</p>
              <div className="mt-4 flex items-center gap-4">
                <Avatar className="h-14 w-14 border-2 border-white bg-white text-[#102a25]">
                  <AvatarImage src={previewAvatar || undefined} className="object-cover" />
                  <AvatarFallback className="bg-white font-black">{initials(formData.nombre)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-lg font-black">{formData.nombre || 'Tu nombre visible'}</p>
                  <p className="mt-1 truncate text-xs text-white/70">{formData.carrera || 'Facultad pendiente'}</p>
                </div>
              </div>
              {cleanInstagram && <p className="mt-4 flex items-center gap-2 text-xs text-white/75"><Instagram className="h-3.5 w-3.5" /> @{cleanInstagram}</p>}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-10 sm:py-14 lg:px-14 xl:px-20">
          <div className="w-full max-w-xl">
            <div className="flex items-center justify-between border-b border-[#deddd7] pb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#155eef]">Configuración inicial</p>
                <p className="mt-1 text-sm font-bold text-[#66756f]">Paso único · menos de un minuto</p>
              </div>
              <div className="grid h-9 w-9 place-items-center border border-[#cfd5d1] bg-white text-[#155eef]"><UserRound className="h-4 w-4" /></div>
            </div>

            <div className="mt-8">
              <h2 className="text-3xl font-black tracking-[-0.045em] sm:text-4xl">Completa tu perfil</h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-[#66756f] sm:text-base">
                Guardaremos tu cuenta como pendiente hasta que elijas una facultad. Si sales ahora, continuarás aquí en tu próximo ingreso.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              {error && <div role="alert" className="border-l-4 border-[#b42318] bg-[#fef3f2] px-4 py-3 text-sm font-bold text-[#912018]">{error}</div>}

              <Field label="Nombre visible" htmlFor="nombre" icon={<UserRound className="h-4 w-4" />}>
                <Input id="nombre" value={formData.nombre} onChange={(event) => setFormData((current) => ({ ...current, nombre: event.target.value }))} maxLength={60} placeholder="Ej.: Alexis UP" autoComplete="name" className="h-[3.25rem] rounded-none border-[#cfd5d1] bg-white px-4 font-semibold text-[#102a25] focus-visible:ring-[#155eef]" />
              </Field>

              <Field label="Facultad" htmlFor="carrera" icon={<School className="h-4 w-4" />} required>
                <Select value={formData.carrera} onValueChange={(value) => setFormData((current) => ({ ...current, carrera: value }))}>
                  <SelectTrigger id="carrera" className="h-[3.25rem] rounded-none border-[#cfd5d1] bg-white px-4 font-semibold text-[#102a25] focus:ring-[#155eef]">
                    <SelectValue placeholder="Selecciona tu facultad" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-[#cfd5d1] bg-white p-1">
                    {FACULTIES.map((faculty) => (
                      <SelectItem key={faculty} value={faculty} className="rounded-none py-3 font-semibold focus:bg-[#eef3ff]">
                        <span className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FACULTY_ACCENTS[faculty] }} />{faculty}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-2 flex items-center gap-2 text-xs text-[#66756f]"><Building2 className="h-3.5 w-3.5" /> Podrás cambiarla después desde tu perfil.</p>
              </Field>

              <Field label="Instagram" optional htmlFor="instagram" icon={<Instagram className="h-4 w-4" />}>
                <Input id="instagram" value={formData.instagram} onChange={(event) => setFormData((current) => ({ ...current, instagram: event.target.value }))} maxLength={50} placeholder="@tu_usuario" autoComplete="off" className="h-[3.25rem] rounded-none border-[#cfd5d1] bg-white px-4 font-semibold text-[#102a25] focus-visible:ring-[#155eef]" />
              </Field>

              <div className="flex items-start gap-3 border-t border-[#deddd7] pt-5 text-xs leading-5 text-[#66756f]">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[#155eef]" />
                <p>Tu cuenta ya existe, pero el acceso privado se habilita cuando completas estos datos.</p>
              </div>

              <Button type="submit" disabled={loading} className="h-14 w-full rounded-none bg-[#102a25] text-base font-black text-white hover:bg-[#193b34] disabled:opacity-60" style={{ borderBottom: `4px solid ${accent}` }}>
                {loading ? <><LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> Guardando perfil</> : <>Entrar a CampusLink <ArrowRight className="ml-2 h-5 w-5" /></>}
              </Button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, htmlFor, icon, children, optional, required }: { label: string; htmlFor: string; icon: React.ReactNode; children: React.ReactNode; optional?: boolean; required?: boolean }) {
  return (
    <div>
      <Label htmlFor={htmlFor} className="mb-2.5 flex items-center gap-2 text-sm font-black text-[#102a25]">
        <span className="text-[#155eef]">{icon}</span>
        {label}
        {optional && <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.15em] text-[#89938f]">Opcional</span>}
        {required && <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.15em] text-[#155eef]">Obligatorio</span>}
      </Label>
      {children}
    </div>
  );
}
