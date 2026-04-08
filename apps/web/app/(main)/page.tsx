'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Star, Calendar, Users, TrendingUp, Award, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';
import HeroCarousel from '@/components/landing/HeroCarousel';
import SocialSidebar from '@/components/landing/SocialSidebar';

export default function HomePage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleGuestLogin = async () => {
    try {
      setIsGuestLoading(true);
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase.auth.signInAnonymously();
      
      if (error) throw error;
      
      router.push('/dashboard');
    } catch (err: any) {
      console.error('[GUEST_LOGIN] Error:', err.message);
      alert('Error al ingresar como invitado. Asegúrate de que esta opción esté habilitada en Supabase.');
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <div className="relative w-full bg-white select-none xl:pl-[50px]">
      <SocialSidebar />

      {/* Navbar - Refined and Minimalist */}
      <nav
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${scrolled ? 'bg-white shadow-md py-2' : 'bg-white/95 backdrop-blur-sm py-4 md:py-6'
          }`}
      >
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-24 flex justify-between items-center transition-all duration-300">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group">
            <div className="w-9 h-9 sm:w-12 sm:h-12 flex items-center justify-center transform group-hover:rotate-12 transition-transform shrink-0">
              <img
                src="/logo/logo-campuslink-v2.png"
                alt="CampusLink Logo"
                className="w-full h-full object-contain drop-shadow-lg"
              />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg sm:text-xl md:text-2xl font-black text-[#002d5a] tracking-tighter">
                CAMPUS<span className="text-blue-600">LINK</span>
              </span>
              <span className="text-[8px] sm:text-[10px] md:text-[11px] font-black text-gray-400 tracking-[0.2em] uppercase mt-0.5 sm:mt-1">
                REPOSITORIO COLABORATIVO
              </span>
            </div>
          </Link>

          {/* Actions - Login and Guest buttons */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              onClick={handleGuestLogin}
              disabled={isGuestLoading}
              className="flex items-center gap-2 text-[#4b5563] hover:text-black font-black text-[9px] sm:text-[11px] tracking-[0.1em] sm:tracking-[0.2em] uppercase transition-all px-2 sm:px-4 h-10 sm:h-12 border border-gray-200 hover:border-black/20"
            >
              {isGuestLoading ? '...' : (
                <>
                  <span className="hidden xs:inline">{isGuestLoading ? 'INGRESANDO...' : 'ENTRAR COMO INVITADO'}</span>
                  <span className="xs:hidden">INVITADO</span>
                </>
              )}
            </button>
            <Link href="/auth/login">
              <Button className="bg-[#1f2937] hover:bg-black text-white font-black px-3 sm:px-6 h-10 sm:h-12 rounded-none flex items-center gap-1.5 sm:gap-2 transition-all active:scale-95 shadow-xl shadow-black/10 text-[10px] sm:text-xs tracking-widest italic uppercase overflow-hidden">
                <LogIn size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden xxs:inline">INICIAR SESIÓN</span>
                <span className="xxs:hidden">LOGIN</span>
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <HeroCarousel />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-24 md:py-32 relative">
        {/* Intro Section */}
        <div className="text-center mb-16 md:mb-24 max-w-4xl mx-auto space-y-6">
          <div className="inline-block border border-gray-200 text-gray-500 text-[10px] font-bold px-4 py-1.5 rounded-full uppercase tracking-widest mb-4">
            De alumnos para alumnos
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-[#111] leading-tight tracking-tight">
            Nuestra propia red académica.
          </h2>
          <p className="text-lg md:text-xl text-gray-500 font-normal leading-relaxed max-w-3xl mx-auto">
            Un espacio donde recopilamos material de ciclos pasados, calificamos profesores basados en la experiencia real
            y nos ayudamos mutuamente durante la carrera universitaria.
          </p>
        </div>

        {/* Minimalist Features Grid */}
        <div className="mx-auto max-w-6xl border-t border-gray-100 pt-16 md:pt-24 mt-8 md:mt-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 md:gap-x-16 lg:gap-x-24 gap-y-12 md:gap-y-20 px-4 sm:px-0">
            {[
              {
                icon: BookOpen,
                title: 'Material Académico',
                desc: 'Únete a nuestro repositorio colaborativo para compartir y acceder a apuntes, manuales, guías y exámenes pasados.'
              },
              {
                icon: Star,
                title: 'Reseñas de Profesores',
                desc: 'Lee calificaciones honestas sobre metodologías, dificultad y carga de trabajo para matricularte con seguridad.'
              },
              {
                icon: Calendar,
                title: 'Eventos del Campus',
                desc: 'Mantente al día con foros, talleres estudiantiles, congresos y fechas críticas que no nos podemos perder.'
              },
              {
                icon: Users,
                title: 'Red de Apoyo',
                desc: 'Conéctate con estudiantes de distintas carreras para resolver dudas, armar grupos de estudio y colaborar.'
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5 sm:gap-6 group"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] flex items-center justify-center shrink-0 border border-gray-100 bg-gray-50 text-blue-800 transition-colors group-hover:border-blue-200 group-hover:bg-blue-50/50">
                  <feature.icon className="w-8 h-8 sm:w-10 sm:h-10" strokeWidth={1.5} />
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl sm:text-2xl font-black text-[#111] tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-gray-500 leading-relaxed text-[15px] sm:text-[17px]">
                    {feature.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-20 px-6 md:px-12">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16">
          <div className="col-span-1 md:col-span-1 lg:col-span-2 space-y-8">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-24 h-24 rounded-xl flex items-center justify-center">
                <img
                  src="/logo/logo-campuslink-v2.png"
                  alt="CampusLink Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-2xl font-black text-[#002d5a] tracking-tighter">
                CAMPUS<span className="text-blue-600">LINK</span>
              </span>
            </Link>
            <p className="max-w-md text-gray-500 font-bold leading-relaxed italic text-sm">
              Un repositorio académico independiente construido por estudiantes.
              Nuestro objetivo es centralizar el conocimiento y facilitar la colaboración libre.
              <span className="block mt-4 text-blue-600/60 not-italic font-black text-xs uppercase tracking-widest">
                No somos una entidad oficial universitaria.
              </span>
            </p>
            <div className="flex gap-4 pt-4">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">
                © {new Date().getFullYear()} CAMPUSLINK NETWORK.
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <h4 className="font-black text-[#002d5a] uppercase tracking-[0.2em] text-xs italic border-b border-gray-100 pb-4">Navegación</h4>
            <ul className="space-y-4 text-gray-400 font-black text-[12px] uppercase tracking-widest">
              <li><button className="hover:text-blue-600 transition-colors">Material Académico</button></li>
              <li><button className="hover:text-blue-600 transition-colors">Directorio Profesores</button></li>
              <li><button className="hover:text-blue-600 transition-colors">Eventos Locales</button></li>
              <li><button className="hover:text-blue-600 transition-colors">Grupos de Estudio</button></li>
            </ul>
          </div>

          <div className="space-y-8">
            <h4 className="font-black text-[#002d5a] uppercase tracking-[0.2em] text-xs italic border-b border-gray-100 pb-4">Plataforma</h4>
            <ul className="space-y-4 text-gray-400 font-black text-[12px] uppercase tracking-widest">
              <li><button className="hover:text-blue-600 transition-colors">Términos Legales</button></li>
              <li><button className="hover:text-blue-600 transition-colors">Privacidad</button></li>
              <li><button className="hover:text-blue-600 transition-colors">Centro de Ayuda</button></li>
              <li><button className="hover:text-blue-600 transition-colors">Contacto Admin</button></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
