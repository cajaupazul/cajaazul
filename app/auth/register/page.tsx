'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';
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
import { Eye, EyeOff } from 'lucide-react';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { Suspense } from 'react';
import { AUTH_CONFIG, validateInstitutionalEmail } from '@/lib/auth-config';

const FACULTADES = [
  'Facultad de Ciencias Empresariales',
  'Facultad de Derecho',
  'Facultad de Economía y Finanzas',
  'Facultad de Ingeniería',
];

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center">Cargando...</div>}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const router = useRouter();
  const { session, loading: profileLoading } = useProfile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const searchParams = useSearchParams();
  const authError = searchParams.get('error');

  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    universidad: 'Universidad Nacional',
    carrera: '',
  });

  // Automatic redirect if session is confirmed
  useEffect(() => {
    if (session && !profileLoading) {
      console.log('[REGISTER_PAGE] Session confirmed, moving to onboarding...');
      router.replace('/auth/complete-profile');
    }
  }, [session, profileLoading, router]);

  useEffect(() => {
    // 1. Errores en el fragmento (#error=...)
    const hash = window.location.hash;
    if (hash && hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1));
      const errorMsg = params.get('error_description') || params.get('error') || 'Error de autenticación';
      setError(decodeURIComponent(errorMsg));
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
          .eq('image_type', 'register')
          .single();

        if (error) {
          console.log('[MASCOT_FETCH_ERROR] Register mascot status:', error.code);
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.nombre.trim() || !formData.email.trim() || !formData.password.trim() || !formData.carrera) {
      setError('Por favor completa todos los campos');
      return;
    }

    // VALIDACIÓN DE DOMINIO INSTITUCIONAL (ANTES DE LLAMAR A SUPABASE)
    const emailTrimmed = formData.email.trim().toLowerCase();
    if (!validateInstitutionalEmail(emailTrimmed)) {
      setError(AUTH_CONFIG.messages.domainError);
      return;
    }

    setLoading(true);

    try {
      // 100% Client side call
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            nombre: formData.nombre.trim(),
            universidad: formData.universidad,
            carrera: formData.carrera,
          },
        },
      });

      if (authError) {
        console.error('[REGISTER_ERROR]', authError.message);
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (authData.user) {
        // Create initial profile record manually if it's not handled by trigger
        console.log('[REGISTER_SUCCESS] User created, waiting for session...');
      }
    } catch (err: any) {
      console.error('[REGISTER_EXCEPTION]', err);
      setError('Ocurrió un error inesperado al intentar registrarse.');
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
            <div className="relative w-full aspect-square sm:h-96 bg-white/20 backdrop-blur-md rounded-[2rem] flex items-center justify-center shadow-2xl">
              <span className="text-white text-6xl font-black">CL</span>
            </div>
          )}

          <div className="mt-6 sm:mt-8 space-y-2">
            <h2 className="text-white text-3xl sm:text-4xl font-black tracking-tight drop-shadow-sm">CampusLink</h2>
            <p className="text-blue-50 text-base sm:text-lg font-medium opacity-90">Tu plataforma educativa</p>
          </div>
        </div>
      </div>

      {/* Right Side - Register Form */}
      <div className="w-full lg:w-1/2 bg-white flex flex-col items-center justify-center p-6 sm:p-12 lg:p-16 relative">
        <div className="w-full max-w-md bg-white rounded-3xl lg:p-0 shadow-2xl lg:shadow-none p-8 -mt-10 lg:mt-0 relative z-20">
          {/* Header */}
          <div className="text-center mb-6 lg:text-left">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mb-2">Crear Cuenta</h1>
            <p className="text-slate-500 font-medium">Únete a CampusLink y comienza a colaborar</p>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            {/* Nombre Completo */}
            <div className="space-y-1.5">
              <Label htmlFor="nombre" className="text-slate-700 font-semibold text-sm ml-1">
                Nombre Completo
              </Label>
              <Input
                id="nombre"
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value.toUpperCase() })}
                placeholder="Juan Carlos Pérez Gómez"
                className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl transition-all"
                required
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-700 font-semibold text-sm ml-1">
                Email Universitario
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="tu@up.edu.pe"
                className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl transition-all"
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-700 font-semibold text-sm ml-1">
                Contraseña
              </Label>
              <div className="relative group">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl transition-all pr-12"
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

            {/* Facultad */}
            <div className="space-y-1.5">
              <Label htmlFor="carrera" className="text-slate-700 font-semibold text-sm ml-1">
                Facultad
              </Label>
              <Select value={formData.carrera} onValueChange={(value) => setFormData({ ...formData, carrera: value })}>
                <SelectTrigger className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl transition-all bg-white">
                  <SelectValue placeholder="Selecciona tu facultad" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                  {FACULTADES.map((fac) => (
                    <SelectItem key={fac} value={fac} className="rounded-lg focus:bg-slate-50">
                      {fac}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sign Up Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-12 py-3 rounded-xl shadow-xl shadow-slate-200 transition-all hover:scale-[1.01] active:scale-[0.98] mt-4"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Creando...</span>
                </div>
              ) : (
                'Crear Cuenta'
              )}
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 font-medium">O continúa con</span>
              </div>
            </div>

            <GoogleButton text="Registrarse con Google" />
          </form>

          {/* Login Link */}
          <div className="mt-8 text-center text-sm bg-slate-50 py-4 rounded-2xl border border-slate-100">
            <p className="text-slate-500 font-medium">
              ¿Ya tienes cuenta?{' '}
              <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-black transition-colors ml-1">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
