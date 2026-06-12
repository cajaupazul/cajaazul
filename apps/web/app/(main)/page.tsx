'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import HeroCarousel from '@/components/landing/HeroCarousel';

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

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen">
      <style dangerouslySetInnerHTML={{__html: `
        .hero-gradient-overlay {
            background: linear-gradient(to right, rgba(0, 23, 54, 0.9) 0%, rgba(0, 23, 54, 0.4) 100%);
        }
        .landing-glass-card {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .reveal-item {
            opacity: 0;
            transform: translateY(10px);
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .group:hover .reveal-item {
            opacity: 1;
            transform: translateY(0);
        }
      `}} />

      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 h-full flex flex-col items-center py-8 z-40 bg-primary dark:bg-tertiary shadow-lg w-16">
        <div className="mb-12">
          {/* Logo / Icon */}
          <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M12 14l9-5-9-5-9 5 9 5z" />
              <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
            </svg>
          </div>
        </div>
        <nav className="flex flex-col gap-8 flex-grow items-center">
          {/* Social Icons */}
          <a aria-label="Facebook" className="text-surface-variant opacity-60 hover:opacity-100 hover:scale-110 transition-all duration-300" href="#">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"></path></svg>
          </a>
          <a aria-label="Twitter" className="text-surface-variant opacity-60 hover:opacity-100 hover:scale-110 transition-all duration-300" href="#">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg>
          </a>
          <a aria-label="YouTube" className="text-surface-variant opacity-60 hover:opacity-100 hover:scale-110 transition-all duration-300" href="#">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"></path></svg>
          </a>
          <a aria-label="LinkedIn" className="text-surface-variant opacity-60 hover:opacity-100 hover:scale-110 transition-all duration-300" href="#">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a2.7 2.7 0 0 0-2.7-2.7c-1.2 0-2 .7-2.3 1.2v-1h-3.1v7.8h3.1v-4.2c0-.6.4-1.1 1-1.1s1 .5 1 1.1v4.2h3.1M6.9 7.6c-1 0-1.7.8-1.7 1.7s.8 1.7 1.7 1.7 1.8-.8 1.8-1.7-.8-1.7-1.8-1.7m1.5 10.9V10.7H5.4v7.8h3z"></path></svg>
          </a>
          <a aria-label="Instagram" className="text-surface-variant opacity-60 hover:opacity-100 hover:scale-110 transition-all duration-300" href="#">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6m4.4 3a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3m5-2.25a.75.75 0 0 1 .75.75.75.75 0 0 1-.75.75.75.75 0 0 1-.75-.75.75.75 0 0 1 .75-.75z"></path></svg>
          </a>
          <a aria-label="TikTok" className="text-surface-variant opacity-60 hover:opacity-100 hover:scale-110 transition-all duration-300" href="#">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12.525.02c1.31 0 2.59.1 3.81.3v3.7c-1.18-.36-2.42-.51-3.66-.44v13.06c0 2.15-1.75 3.9-3.9 3.9s-3.9-1.75-3.9-3.9 1.75-3.9 3.9-3.9c.4 0 .78.06 1.15.17V9.11c-3.66.19-6.59 3.23-6.59 6.95 0 3.84 3.12 6.96 6.96 6.96s6.96-3.12 6.96-6.96V6.03C19.34 7.57 21.46 8.5 23.82 8.64V4.9c-1.85-.01-3.59-.83-4.79-2.23C18.17 1.57 17.65 0 17.65 0h-5.125z"></path></svg>
          </a>
        </nav>

      </aside>

      <main className="ml-16 min-h-screen flex flex-col">
        {/* TopNavBar */}
        <header className={`bg-surface dark:bg-on-background shadow-sm sticky top-0 z-30 transition-all duration-300 ${scrolled ? 'py-2' : 'py-0'}`}>
          <div className="flex justify-between items-center h-20 w-full px-margin-desktop max-w-container-max mx-auto">
            <div className="flex items-center gap-4">
              <img src="/logo/logo-campuslink-v2.png" alt="CampusLink Logo" className="h-10 w-auto object-contain" />
              <span className="font-headline-lg text-headline-lg font-extrabold text-primary dark:text-primary-fixed uppercase tracking-tight hidden sm:block">CampusLink</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-8">
              <a className="text-secondary dark:text-secondary-fixed-dim border-b-2 border-secondary font-bold pb-1 font-label-lg text-label-lg" href="#">Explorar</a>
              <a className="text-on-surface-variant dark:text-surface-variant hover:text-secondary dark:hover:text-secondary-fixed transition-colors duration-200 font-label-lg text-label-lg" href="#">Categorías</a>
              <a className="text-on-surface-variant dark:text-surface-variant hover:text-secondary dark:hover:text-secondary-fixed transition-colors duration-200 font-label-lg text-label-lg" href="#">Investigación</a>
              <a className="text-on-surface-variant dark:text-surface-variant hover:text-secondary dark:hover:text-secondary-fixed transition-colors duration-200 font-label-lg text-label-lg" href="#">Repositorio</a>
            </nav>
            
            <div className="flex items-center gap-4">
              <Link href="/auth/login">
                <button className="px-6 py-2 rounded-full border border-primary text-primary font-label-lg text-label-lg hover:bg-primary hover:text-on-primary transition-all duration-300 hidden sm:block">
                  LOGIN
                </button>
              </Link>
              <Link href="/auth/register">
                <button className="px-6 py-2 rounded-full bg-primary text-on-primary font-label-lg text-label-lg shadow-sm hover:opacity-90 active:scale-95 transition-all">
                  REGÍSTRATE
                </button>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative min-h-[870px] flex items-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            {/* Using the existing HeroCarousel component to maintain their images */}
            <HeroCarousel />
            <div className="absolute inset-0 hero-gradient-overlay pointer-events-none"></div>
          </div>
          <div className="relative z-10 w-full px-margin-desktop max-w-container-max mx-auto pointer-events-none">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-2xl pointer-events-auto"
            >


              {/* Hero Stats */}
              <div className="grid grid-cols-3 gap-4 mt-16 max-w-xl">
                <div className="landing-glass-card p-4 rounded-xl">
                  <div className="text-secondary font-headline-lg">15k+</div>
                  <div className="text-surface-variant text-label-md">Documentos</div>
                </div>
                <div className="landing-glass-card p-4 rounded-xl">
                  <div className="text-secondary font-headline-lg">200+</div>
                  <div className="text-surface-variant text-label-md">Universidades</div>
                </div>
                <div className="landing-glass-card p-4 rounded-xl">
                  <div className="text-secondary font-headline-lg">4.9/5</div>
                  <div className="text-surface-variant text-label-md">Valoración</div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Academic Hub Features */}
        <section className="py-section-gap px-margin-desktop max-w-container-max mx-auto w-full">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-headline-xl text-headline-xl text-primary mb-4">Herramientas para tu éxito</h2>
            <p className="text-on-surface-variant max-w-xl mx-auto">Diseñado para la eficiencia académica y la colaboración fluida entre estudiantes de élite.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
            
            {/* Repositorio Premium (Large) */}
            <div className="md:col-span-8 bg-surface-container-low rounded-3xl p-8 flex flex-col justify-between min-h-[400px] group overflow-hidden relative shadow-sm border border-outline-variant/30 transition-all duration-500 hover:shadow-2xl hover:scale-[1.01] cursor-pointer">
              <div className="relative z-10">
                <div className="bg-secondary/10 w-12 h-12 rounded-xl flex items-center justify-center text-secondary mb-6 group-hover:bg-secondary group-hover:text-on-primary transition-all duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h3 className="font-headline-lg text-headline-lg text-primary mb-4 group-hover:text-secondary transition-colors duration-300">Repositorio Premium</h3>
                <p className="text-on-surface-variant max-w-md group-hover:text-on-surface transition-colors duration-300">Accede a las mejores notas y resúmenes de tus cursos, verificados por la comunidad estudiantil de alto rendimiento.</p>
                <div className="mt-8 flex gap-3 flex-wrap">
                  <span className="reveal-item bg-surface-container-highest px-4 py-1.5 rounded-full text-label-md text-primary font-semibold" style={{transitionDelay: "0.1s"}}>Derecho</span>
                  <span className="reveal-item bg-surface-container-highest px-4 py-1.5 rounded-full text-label-md text-primary font-semibold" style={{transitionDelay: "0.2s"}}>Ciencias Empresariales</span>
                  <span className="reveal-item bg-surface-container-highest px-4 py-1.5 rounded-full text-label-md text-primary font-semibold" style={{transitionDelay: "0.3s"}}>Economía y Finanzas</span>
                  <span className="reveal-item bg-surface-container-highest px-4 py-1.5 rounded-full text-label-md text-primary font-semibold" style={{transitionDelay: "0.4s"}}>Ingeniería</span>
                </div>
              </div>
              <div className="mt-auto relative z-10 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 delay-200">
                <a className="inline-flex items-center gap-2 text-secondary font-bold hover:underline" href="#">
                  Explorar todas las facultades 
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
              {/* Here we integrate the user's waifu video instead of the static image */}
              <div className="absolute -bottom-10 -right-10 w-2/3 opacity-30 group-hover:opacity-100 transition-all duration-700 mix-blend-luminosity group-hover:mix-blend-normal group-hover:scale-110 pointer-events-none">
                <video
                  src="/waifu/fg_video.webm"
                  autoPlay loop muted playsInline
                  className="w-full h-auto drop-shadow-2xl"
                />
              </div>
            </div>

            {/* Comunidad Activa */}
            <div className="md:col-span-4 bg-primary text-on-primary rounded-3xl p-8 flex flex-col justify-between shadow-lg group transition-all duration-500 hover:scale-[1.03] hover:shadow-primary/20 cursor-pointer">
              <div className="bg-white/10 w-12 h-12 rounded-xl flex items-center justify-center mb-6 group-hover:bg-on-primary group-hover:text-primary transition-all duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md mb-2">Comunidad Activa</h3>
                <p className="opacity-80 font-body-sm group-hover:opacity-100 transition-opacity">Conecta con miles de estudiantes de tu misma carrera y comparte conocimientos de valor.</p>
              </div>
              <div className="mt-6 flex flex-col gap-4 overflow-hidden">

                <a className="flex items-center gap-2 font-label-lg hover:gap-4 transition-all" href="#">
                  Unirse ahora 
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Rankings de Profes */}
            <div className="md:col-span-4 bg-secondary-container text-on-secondary-container rounded-3xl p-8 flex flex-col justify-between shadow-sm group transition-all duration-500 hover:scale-[1.03] hover:shadow-secondary-container/30 cursor-pointer">
              <div className="bg-on-secondary-container/10 w-12 h-12 rounded-xl flex items-center justify-center mb-6 group-hover:bg-on-secondary-container group-hover:text-secondary-container transition-all duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md mb-2">Rankings de Profes</h3>
                <p className="opacity-80 font-body-sm group-hover:opacity-100 transition-opacity">Consulta las opiniones y métodos de evaluación antes de matricularte en el próximo ciclo.</p>
              </div>

            </div>

            {/* Investigación sin límites */}
            <div className="md:col-span-8 bg-surface-bright rounded-3xl p-8 border border-outline-variant flex items-center gap-12 group transition-all duration-500 hover:bg-surface-container-high hover:border-secondary hover:shadow-xl cursor-pointer overflow-hidden">
              <div className="flex-1">
                <h3 className="font-headline-lg text-headline-lg text-primary mb-4 group-hover:text-secondary transition-colors duration-300">Herramientas de Productividad</h3>
                <p className="text-on-surface-variant mb-6 group-hover:text-on-surface transition-colors duration-300">Accede a extensiones útiles para tu navegador y organiza mejor tus horarios de estudio.</p>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <button className="px-6 py-2.5 rounded-xl border border-primary text-primary font-label-lg hover:bg-primary hover:text-on-primary transition-all shadow-sm">Explorar Herramientas</button>
                </div>
              </div>
              <div className="hidden sm:flex w-40 h-40 bg-surface-container rounded-2xl items-center justify-center text-primary/20 rotate-3 group-hover:rotate-0 group-hover:scale-110 group-hover:text-secondary/30 transition-all duration-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
            </div>

          </div>
        </section>

        {/* Footer */}
        <footer className="mt-auto bg-surface-container-low dark:bg-tertiary-container border-t border-outline-variant dark:border-outline">
          <div className="w-full py-stack-lg px-margin-desktop grid grid-cols-1 md:grid-cols-2 items-center max-w-container-max mx-auto">
            <div className="flex flex-col gap-4">
              <span className="font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed">CampusLink</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant dark:text-on-tertiary-container">
                © 2024 CampusLink. Academic Excellence Guaranteed.
              </p>
            </div>
            <div className="flex flex-wrap md:justify-end gap-x-8 gap-y-4 mt-8 md:mt-0">
              <a className="text-on-surface-variant dark:text-on-tertiary-container hover:text-primary dark:hover:text-primary-fixed transition-colors font-body-sm underline-offset-4 hover:underline" href="#">Privacidad</a>
              <a className="text-on-surface-variant dark:text-on-tertiary-container hover:text-primary dark:hover:text-primary-fixed transition-colors font-body-sm underline-offset-4 hover:underline" href="#">Términos</a>
              <a className="text-on-surface-variant dark:text-on-tertiary-container hover:text-primary dark:hover:text-primary-fixed transition-colors font-body-sm underline-offset-4 hover:underline" href="#">Contacto</a>
              <a className="text-on-surface-variant dark:text-on-tertiary-container hover:text-primary dark:hover:text-primary-fixed transition-colors font-body-sm underline-offset-4 hover:underline" href="#">Ayuda</a>
              <a className="text-primary dark:text-primary-fixed font-semibold font-body-sm underline-offset-4 hover:underline" href="#">Investigadores</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
