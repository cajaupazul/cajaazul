'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';
import { useSearchParams } from 'next/navigation';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { Suspense } from 'react';
import { AUTH_CONFIG, validateInstitutionalEmail } from '@/lib/auth-config';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center">Cargando...</div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const { session, profile, loading: profileLoading, clearProfile } = useProfile();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const searchParams = useSearchParams();
  const authError = searchParams.get('error');

  // Listen for session confirmation from the Provider
  useEffect(() => {
    // REDUNDANT CLEANUP: Ensure we start clean when entering the login page
    if (typeof window !== 'undefined') {
      // Also invoke the context clearer if possible, but pure localStorage is safer here
      // clearProfile(); // Can't call side-effect here strictly without loop risk, handled on click
      localStorage.clear();
      sessionStorage.clear();
    }
  }, []);

  // Listen for session confirmation from the Provider
  useEffect(() => {
    if (session && !profileLoading) {
      if (typeof window !== 'undefined') {
        const profileStr = localStorage.getItem('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL + '-auth-token');
        // If we have a session but no profile yet, we should probably wait or check if onboarding is needed
        // For now, let the Auth Callback (server-side) handle the primary redirection.
        // We only redirect here if we are SURE the user is fully logged in and ready.
        if (profile) {
          console.log('[LOGIN_PAGE] Session and profile confirmed, redirecting to dashboard...');
          router.replace('/dashboard');
        } else {
          console.log('[LOGIN_PAGE] Session detected but waiting for profile/onboarding...');
          // Optional: router.replace('/auth/complete-profile');
        }
      }
    }
  }, [session, profile, profileLoading, router]);

  useEffect(() => {
    // 1. Prioridad: Errores en el fragmento (#error=...) que Supabase inyecta
    const hash = window.location.hash;
    if (hash && hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1));
      const errorMsg = params.get('error_description') || params.get('error') || 'Error de autenticación';
      setError(decodeURIComponent(errorMsg));

      // Limpiar el hash inmediatamente para que el cliente de Supabase no se confunda
      // y para permitir que el usuario intente de nuevo "limpio"
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    // 2. Errores en searchParams (?error=...)
    else if (authError) {
      setError(decodeURIComponent(authError));
    }
  }, [authError]);

  useEffect(() => {
    const fetchImage = async () => {
      try {
        const { data, error } = await supabase
          .from('auth_images')
          .select('image_url')
          .eq('image_type', 'login')
          .single();

        if (error) {
          console.error('[MASCOT_FETCH_ERROR] Status:', error.code, 'Message:', error.message);
          return;
        }

        if (data?.image_url) {
          setImageUrl(data.image_url);
        }
      } catch (err: any) {
        console.error('[MASCOT_EXCEPTION]', err);
      }
    };

    fetchImage();
  }, []);



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // NUCLEAR OPTION: Clear old state before thinking about logging in
    clearProfile();

    setLoading(true);
    setError('');

    try {
      // VALIDACIÓN DE DOMINIO INSTITUCIONAL (ANTES DE LLAMAR A SUPABASE)
      const emailTrimmed = email.trim().toLowerCase();
      if (!validateInstitutionalEmail(emailTrimmed)) {
        setError(AUTH_CONFIG.messages.domainError);
        setLoading(false);
        return;
      }


      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailTrimmed,
        password,
      });

      if (signInError) {
        console.error('[LOGIN_ERROR]', signInError.message);
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // DO NOT redirect here. 
      // The session will update in useProfile(), which will trigger the useEffect above.
      console.log('[LOGIN_SUCCESS] Waiting for session confirmation...');
    } catch (err: any) {
      console.error('[LOGIN_EXCEPTION]', err);
      setError('Ocurrió un error inesperado al intentar iniciar sesión.');
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor ingresa tu correo primero');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const emailTrimmed = email.trim().toLowerCase();
      if (!validateInstitutionalEmail(emailTrimmed)) {
        setError(AUTH_CONFIG.messages.domainError);
        setLoading(false);
        return;
      }

      const { error: magicError } = await supabase.auth.signInWithOtp({
        email: emailTrimmed,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });

      if (magicError) {
        setError(magicError.message);
        setLoading(false);
        return;
      }

      setError('¡Enlace enviado! Revisa tu correo para entrar sin contraseña.');
      setLoading(false);
    } catch (err: any) {
      console.error('[MAGIC_LINK_EXCEPTION]', err);
      setError('Error al enviar el enlace mágico.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      {/* Left Side - Image (Desktop) / Top Section (Mobile) */}
      <div className="w-full lg:w-1/2 bg-gradient-to-br from-blue-600 to-teal-500 flex items-center justify-center p-6 sm:p-12 lg:p-16 relative overflow-hidden">
        {/* Background Decorative Circles */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-10 -left-10 w-48 h-48 sm:w-72 sm:h-72 bg-white rounded-full"></div>
          <div className="absolute -bottom-10 -right-10 w-64 h-64 sm:w-96 sm:h-96 bg-white rounded-full"></div>
        </div>

        {/* Branding Container */}
        <div className="relative z-10 text-center max-w-sm sm:max-w-md w-full">
          {imageUrl ? (
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-teal-400 rounded-[2rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
              <img
                src={imageUrl}
                alt="CampusLink"
                className="relative w-full aspect-square sm:h-96 object-cover rounded-[2rem] shadow-2xl transition-transform duration-500 hover:scale-[1.02]"
              />
            </div>
          ) : (
            <div className="relative w-full aspect-square sm:h-96 bg-white/20 backdrop-blur-md rounded-[2rem] flex items-center justify-center shadow-2xl overflow-hidden">
              <img
                src="/logo/logo-campuslink-v2.png"
                alt="CampusLink Logo"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="mt-6 sm:mt-8 space-y-2">
            <h2 className="text-white text-3xl sm:text-4xl font-black tracking-tight drop-shadow-sm">CampusLink</h2>
            <p className="text-blue-50 text-base sm:text-lg font-medium opacity-90">Tu plataforma educativa</p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 bg-white flex flex-col items-center justify-center p-6 sm:p-12 lg:p-20 relative">
        {/* Mobile Spacer (optional if we want more air) */}
        <div className="w-full max-w-md bg-white rounded-3xl lg:p-0 shadow-2xl lg:shadow-none p-8 -mt-10 lg:mt-0 relative z-20">
          {/* Header */}
          <div className="text-center mb-8 lg:text-left">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mb-2">Welcome back!</h1>
            <p className="text-slate-500 font-medium">Por favor ingresa tus datos para continuar</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 font-semibold text-sm ml-1">
                Correo Institucional
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@universidad.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl transition-all"
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1 ml-1">
                <Label htmlFor="password" className="text-slate-700 font-semibold text-sm">
                  Contraseña
                </Label>
                <Link href="/auth/forgot-password" title="Recuperar contraseña" className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative group">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl transition-all pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 h-full px-4 text-slate-400 hover:text-blue-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center ml-1">
              <div className="flex items-center space-x-2">
                <input
                  id="remember"
                  type="checkbox"
                  className="h-4 w-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 transition-colors cursor-pointer"
                />
                <label htmlFor="remember" className="text-sm text-slate-500 font-medium cursor-pointer select-none">
                  Recordarme por 30 días
                </label>
              </div>
            </div>

            {/* Login Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-13 py-3 rounded-xl shadow-xl shadow-slate-200 transition-all hover:scale-[1.01] active:scale-[0.98]"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Verificando...</span>
                </div>
              ) : (
                'Ingresar ahora'
              )}
            </Button>

            {/* Magic Link Button */}
            <Button
              type="button"
              onClick={handleMagicLink}
              disabled={loading}
              variant="outline"
              className="w-full border-slate-200 text-slate-700 font-bold h-12 py-3 rounded-xl transition-all hover:bg-slate-50 active:scale-[0.98]"
            >
              {loading ? 'Procesando...' : 'Entrar con Enlace Mágico'}
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 font-medium">O continúa con</span>
              </div>
            </div>

            <GoogleButton text="Iniciar sesión con Google" />
          </form>

          {/* Signup Link */}
          <div className="mt-8 text-center text-sm bg-slate-50 py-4 rounded-2xl border border-slate-100">
            <p className="text-slate-500 font-medium">
              ¿No tienes una cuenta?{' '}
              <Link href="/auth/register" className="text-blue-600 hover:text-blue-700 font-black transition-colors ml-1">
                Regístrate gratis
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
