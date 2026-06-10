'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BookOpen, Star, Calendar, Users, LogIn, ArrowRight } from 'lucide-react';
import { motion, useInView, useMotionValue, useSpring } from 'framer-motion';
import HeroCarousel from '@/components/landing/HeroCarousel';
import SocialSidebar from '@/components/landing/SocialSidebar';



export default function HomePage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [splineLoaded, setSplineLoaded] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleGuestLogin = async () => {
    try {
      setIsGuestLoading(true);
      const { supabase } = await import('@/lib/supabase');
      await supabase.auth.signOut();
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      router.push('/dashboard');
    } catch (err: any) {
      console.error('[GUEST_LOGIN] Error:', err.message);
    } finally {
      setIsGuestLoading(false);
    }
  };

  const features = [
    { icon: BookOpen, title: 'Material Académico', desc: 'Repositorio colaborativo con apuntes, manuales, guías y exámenes pasados de ciclos anteriores.' },
    { icon: Star,     title: 'Reseñas de Profesores', desc: 'Calificaciones honestas sobre metodologías, dificultad y carga de trabajo.' },
    { icon: Calendar, title: 'Eventos del Campus',    desc: 'Mantente al día con talleres, congresos y fechas críticas que no puedes perderte.' },
    { icon: Users,    title: 'Red de Apoyo',          desc: 'Conéctate con estudiantes de distintas carreras para grupos de estudio y colaboración.' },
  ];

  return (
    <div className="relative w-full bg-white select-none xl:pl-[50px]">
      <SocialSidebar />

      {/* ─── NAVBAR ─── */}
      <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${scrolled ? 'bg-white/98 shadow-sm py-3' : 'bg-white py-5 md:py-7'}`}>
        <div className="max-w-[1440px] mx-auto px-6 md:px-14 lg:px-24 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300 shrink-0">
              <img src="/logo/logo-campuslink-v2.png" alt="CampusLink Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg sm:text-xl font-black text-[#002d5a] tracking-tighter">
                CAMPUS<span className="text-blue-600">LINK</span>
              </span>
              <span className="text-[8px] sm:text-[10px] font-bold text-gray-300 tracking-[0.22em] uppercase mt-0.5">
                REPOSITORIO COLABORATIVO
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={handleGuestLogin}
              disabled={isGuestLoading}
              className="hidden sm:flex items-center gap-2 text-gray-400 hover:text-[#002d5a] font-semibold text-[10px] tracking-[0.15em] uppercase transition-colors duration-200"
            >
              {isGuestLoading ? 'INGRESANDO...' : 'INVITADO'}
            </button>
            <div className="hidden sm:block w-px h-5 bg-gray-200" />
            <Link href="/auth/login">
              <button className="flex items-center gap-2 bg-[#002d5a] hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-full text-[10px] tracking-[0.15em] uppercase transition-all duration-200 hover:shadow-lg hover:shadow-blue-900/20 active:scale-95">
                <LogIn size={13} />
                <span className="hidden xxs:inline">INICIAR SESIÓN</span>
                <span className="xxs:hidden">LOGIN</span>
              </button>
            </Link>
          </div>
        </div>
        {/* Thin bottom border */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-100" />
      </nav>

      {/* ─── HERO CAROUSEL ─── */}
      <HeroCarousel />



      {/* ─── MAIN CONTENT ─── */}
      <main className="max-w-7xl mx-auto px-6 md:px-14">

        {/* Intro */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center pt-24 pb-20 max-w-3xl mx-auto space-y-5"
        >
          <span className="inline-flex items-center gap-2 text-blue-600 text-[10px] font-bold tracking-[0.25em] uppercase border border-blue-100 bg-blue-50/60 px-4 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            De alumnos para alumnos
          </span>
          <h2 className="text-4xl md:text-6xl font-black text-[#002d5a] leading-[1.05] tracking-tight">
            Nuestra propia<br />
            <span className="text-blue-600">red académica.</span>
          </h2>
          <p className="text-base md:text-lg text-gray-500 font-medium leading-relaxed max-w-2xl mx-auto">
            Un espacio donde recopilamos material de ciclos pasados, calificamos profesores
            y nos ayudamos mutuamente durante la carrera.
          </p>
          <div className="pt-4 flex items-center justify-center gap-4">
            <Link href="/auth/register">
              <button className="flex items-center gap-2 bg-[#002d5a] hover:bg-blue-700 text-white font-bold px-7 py-3.5 rounded-full text-sm tracking-wide transition-all hover:shadow-xl hover:shadow-blue-900/20 active:scale-95 group">
                Comenzar gratis
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <button onClick={handleGuestLogin} className="text-gray-400 hover:text-[#002d5a] font-semibold text-sm transition-colors underline underline-offset-4 decoration-gray-200 hover:decoration-blue-300">
              Explorar sin cuenta
            </button>
          </div>
        </motion.div>

        {/* ─── DIVIDER ─── */}
        <div className="flex items-center gap-4 mb-20">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-gray-300">LO QUE ENCONTRARÁS</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* ─── FEATURES + VIDEO ─── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="flex flex-col-reverse md:flex-row items-center gap-16 lg:gap-24 pb-32"
        >
          {/* Video */}
          <div className="w-full md:w-5/12 flex items-center justify-center">
            <video
              src="/waifu/fg_video.webm"
              autoPlay loop muted playsInline
              className="w-full max-w-xs md:max-w-none h-auto object-contain drop-shadow-2xl"
            />
          </div>

          {/* Feature list */}
          <div className="w-full md:w-7/12 space-y-10">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="flex items-start gap-5 group"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gray-50 text-[#002d5a] border border-gray-100 group-hover:bg-blue-50 group-hover:border-blue-100 group-hover:text-blue-600 transition-all duration-200">
                  <feature.icon className="w-4.5 h-4.5" strokeWidth={1.8} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#002d5a] mb-1 tracking-tight">{feature.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-gray-100 py-14 px-6 md:px-14">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <img src="/logo/logo-campuslink-v2.png" alt="CampusLink Logo" className="w-9 h-9 object-contain opacity-70" />
            <div>
              <span className="block text-sm font-black text-[#002d5a] tracking-tighter">
                CAMPUS<span className="text-blue-600">LINK</span>
              </span>
              <span className="block text-[9px] font-bold text-gray-300 tracking-[0.2em] uppercase">
                Repositorio Estudiantil
              </span>
            </div>
          </div>

          {/* Nav links */}
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {['Material Académico', 'Profesores', 'Eventos', 'Grupos de Estudio'].map((item) => (
              <button key={item} className="text-[11px] font-bold text-gray-400 hover:text-[#002d5a] uppercase tracking-[0.15em] transition-colors duration-200">
                {item}
              </button>
            ))}
          </div>

          {/* Copyright */}
          <div className="text-[10px] font-bold text-gray-300 tracking-[0.2em] uppercase whitespace-nowrap">
            © {new Date().getFullYear()} CAMPUSLINK
          </div>
        </div>

        {/* Disclaimer */}
        <div className="max-w-[1440px] mx-auto mt-8 pt-8 border-t border-gray-50">
          <p className="text-[10px] text-gray-300 font-medium tracking-wide">
            Repositorio académico independiente construido por estudiantes. No somos una entidad oficial universitaria.
          </p>
        </div>
      </footer>
    </div>
  );
}
