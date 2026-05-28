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

      // Cerrar sesión previa antes de entrar como invitado
      // Esto evita que en móvil se reutilice la sesión registrada en lugar de crear una anónima
      await supabase.auth.signOut();

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
              className="flex items-center gap-2 text-[#4b5563] hover:text-[#002d5a] font-semibold text-[10px] sm:text-[11px] tracking-wide sm:tracking-wider uppercase transition-all px-2 sm:px-4 h-10 sm:h-12 border-b-2 border-transparent hover:border-[#002d5a]"
            >
              {isGuestLoading ? '...' : (
                <>
                  <span className="hidden xs:inline">{isGuestLoading ? 'INGRESANDO...' : 'ENTRAR COMO INVITADO'}</span>
                  <span className="xs:hidden">INVITADO</span>
                </>
              )}
            </button>
            <Link href="/auth/login">
              <Button className="bg-[#1f2937] hover:bg-black text-white font-semibold px-4 sm:px-6 h-10 sm:h-12 rounded-full flex items-center gap-1.5 sm:gap-2 transition-all active:scale-95 shadow-md hover:shadow-lg text-[10px] sm:text-xs tracking-wide uppercase overflow-hidden">
                <LogIn size={16} className="sm:w-4 sm:h-4" />
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
          <div className="inline-block bg-blue-50/50 text-blue-600 text-[11px] font-semibold px-4 py-1.5 rounded-full uppercase tracking-wider mb-2">
            De alumnos para alumnos
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-[#002d5a] leading-tight tracking-tight">
            Nuestra propia red académica.
          </h2>
          <p className="text-lg md:text-xl text-gray-600 font-medium leading-relaxed max-w-3xl mx-auto">
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
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shrink-0 bg-blue-50/50 text-blue-600 transition-all group-hover:bg-blue-100/50 group-hover:scale-105">
                  <feature.icon className="w-7 h-7 sm:w-9 sm:h-9" strokeWidth={1.5} />
                </div>
                <div className="space-y-2.5">
                  <h3 className="text-xl sm:text-2xl font-bold text-[#002d5a] tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed text-[15px] sm:text-[16px] font-medium">
                    {feature.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* RPG/Cyberpunk Aesthetic Video Section */}
        <div className="mx-auto max-w-6xl mt-24 md:mt-32 pt-16 md:pt-24 px-4 sm:px-0 mb-8 md:mb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex flex-col md:flex-row items-center gap-16 lg:gap-24"
          >
            {/* Left: Video with Cyberpunk/RPG Accents */}
            <div className="w-full md:w-1/2 relative mt-8 md:mt-0 order-2 md:order-1">
              {/* Decorative Blocks */}
              <div className="absolute -top-6 -left-6 md:-top-10 md:-left-10 w-3/4 h-12 bg-[#00ffcc] z-0"></div>
              <div className="absolute -top-3 left-10 md:-top-5 md:left-20 w-1/2 h-4 bg-[#ff00ff] z-0"></div>
              
              <div className="absolute -bottom-6 -right-6 md:-bottom-10 md:-right-10 w-2/3 h-8 bg-[#00ffcc] z-0"></div>
              <div className="absolute -bottom-3 right-10 md:-bottom-5 md:right-20 w-1/3 h-2 bg-[#ff00ff] z-0"></div>

              {/* Floating Pixel Squares */}
              <div className="absolute top-0 -right-4 w-4 h-4 bg-[#00ffcc]/30 hidden md:block"></div>
              <div className="absolute bottom-12 -right-8 w-6 h-6 bg-[#00ffcc] hidden md:block"></div>
              <div className="absolute -bottom-16 -right-2 w-8 h-8 bg-[#00ffcc]/40 hidden md:block"></div>

              {/* Main Video Container */}
              <div className="relative z-10 bg-white p-2 md:p-3 shadow-2xl">
                 <div className="overflow-hidden relative bg-black aspect-video md:aspect-[4/3]">
                    <video 
                      src="/waifu/fg_video.webm" 
                      autoPlay 
                      loop 
                      muted 
                      playsInline 
                      className="w-full h-full object-cover scale-[1.01]"
                    />
                 </div>
              </div>
            </div>

            {/* Right: Text */}
            <div className="w-full md:w-1/2 text-center md:text-right space-y-4 md:space-y-6 order-1 md:order-2">
              <span className="block text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                JUGABILIDAD FLUIDA Y ADICTIVA
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-light text-[#002d5a] leading-tight">
                Una nueva experiencia <br className="hidden md:block" />
                <span className="font-bold text-[#002d5a]">de juego de rol</span>
              </h2>
              <p className="text-gray-500 text-sm md:text-base font-medium leading-relaxed max-w-md ml-auto mr-auto md:mr-0">
                Ponte a prueba con mecánicas de RPG innovadoras que combinan estrategia y reflejos. ¡Fácil de aprender, pero difícil de dominar!
              </p>
            </div>
          </motion.div>
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
