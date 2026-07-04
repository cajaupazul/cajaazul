'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { Suspense } from 'react';

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="h-[100dvh] bg-slate-50 flex items-center justify-center">Cargando...</div>}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const router = useRouter();
  const { session, loading: profileLoading } = useProfile();
  const [error, setError] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const searchParams = useSearchParams();
  const authError = searchParams.get('error');

  // Automatic redirect if session is confirmed
  useEffect(() => {
    if (session && !profileLoading) {
      console.log('[REGISTER_PAGE] Session confirmed, moving to onboarding...');
      router.replace('/auth/complete-profile');
    }
  }, [session, profileLoading, router]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1));
      const errorMsg = params.get('error_description') || params.get('error') || 'Error de autenticación';
      setError(decodeURIComponent(errorMsg));
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } else if (authError) {
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

  return (
    <div className="h-[100dvh] flex flex-col lg:flex-row bg-slate-50 overflow-hidden">
      {/* Left Side - Image (Only Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-teal-500 items-center justify-center p-16 relative overflow-hidden h-full">
        {/* Background Decorative Circles */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-10 -left-10 w-72 h-72 bg-white rounded-none"></div>
          <div className="absolute -bottom-10 -right-10 w-96 h-96 bg-white rounded-none"></div>
        </div>

        {/* Branding Container */}
        <div className="relative z-10 text-center max-w-md w-full flex flex-col items-center">
          {imageUrl ? (
            <div className="relative w-full aspect-square max-h-[380px]">
              <img
                src={imageUrl}
                alt="CampusLink Mascot"
                className="w-full h-full object-cover rounded-none shadow-2xl"
              />
            </div>
          ) : (
            <div className="relative w-full aspect-square max-h-[380px] bg-white/20 backdrop-blur-md rounded-none flex items-center justify-center shadow-2xl overflow-hidden">
              <span className="text-white text-6xl font-black">CL</span>
            </div>
          )}

          <div className="mt-8 space-y-2">
            <h2 className="text-white text-4xl font-black tracking-tight">CampusLink</h2>
            <p className="text-blue-50 text-lg font-medium opacity-90">Tu plataforma educativa</p>
          </div>
        </div>
      </div>

      {/* Right Side - Register Form */}
      <div className="w-full lg:w-1/2 bg-white flex flex-col items-center justify-center p-6 sm:p-12 h-full relative">
        <div className="w-full max-w-md bg-white border border-slate-200/60 p-8 sm:p-10 shadow-sm rounded-none relative z-20 flex flex-col justify-between min-h-[320px]">
          {/* Back to Home Button */}
          <div>
            <a
              href="/"
              className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 font-medium text-xs sm:text-sm transition-colors group mb-6"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Volver al inicio
            </a>
          </div>

          {/* Header */}
          <div className="text-center sm:text-left mb-6">
            <h1 className="text-3xl font-black text-slate-900 mb-2">Crear Cuenta</h1>
            <p className="text-slate-500 text-sm font-medium">Únete a CampusLink de forma rápida y segura con tu cuenta de Google</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-none text-xs font-semibold mb-4">
              {error}
            </div>
          )}

          {/* Register Button */}
          <div className="space-y-4">
            <GoogleButton text="Registrarse con Google" />
          </div>

          {/* Login Link */}
          <div className="mt-8 text-center text-xs sm:text-sm border-t border-slate-100 pt-6">
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
