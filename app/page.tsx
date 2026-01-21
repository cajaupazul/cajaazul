'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Star, Calendar, Users, TrendingUp, Award, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';
import HeroCarousel from '@/components/landing/HeroCarousel';
import SocialSidebar from '@/components/landing/SocialSidebar';

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative w-full bg-white select-none">
      <SocialSidebar />

      {/* Navbar - Refined and Minimalist */}
      <nav
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${scrolled ? 'bg-white shadow-md py-2' : 'bg-white/95 backdrop-blur-sm py-4 md:py-6'
          }`}
      >
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-24 flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-12 h-12 flex items-center justify-center transform group-hover:rotate-12 transition-transform">
              <img
                src="/logo/logo-campuslink-v2.png"
                alt="CampusLink Logo"
                className="w-full h-full object-contain drop-shadow-lg"
              />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-xl md:text-2xl font-black text-[#002d5a] tracking-tighter">
                CAMPUS<span className="text-blue-600">LINK</span>
              </span>
              <span className="text-[10px] md:text-[11px] font-black text-gray-400 tracking-[0.2em] uppercase mt-1">
                REPOSITORIO COLABORATIVO
              </span>
            </div>
          </Link>

          {/* Actions - Smaller Login Button */}
          <div className="flex items-center">
            <Link href="/auth/login">
              <Button className="bg-[#1f2937] hover:bg-black text-white font-black px-6 py-5 rounded-none flex items-center gap-2 transition-all active:scale-95 shadow-xl shadow-black/10 text-xs tracking-widest italic uppercase">
                <LogIn size={16} />
                INICIAR SESIÓN
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
        <div className="text-center mb-20 md:mb-32 max-w-4xl mx-auto space-y-8">
          <div className="inline-block px-5 py-2 bg-blue-50 text-blue-700 text-[11px] font-black rounded-full uppercase tracking-[0.25em] mb-4">
            Comunidad Universitaria Colaborativa
          </div>
          <h2 className="text-4xl md:text-6xl font-black text-[#002d5a] leading-[1.05] tracking-tight italic uppercase leading-none">
            Todo lo que necesitas <br />
            <span className="text-blue-600">para tu éxito.</span>
          </h2>
          <p className="text-lg md:text-xl text-gray-500 font-medium leading-relaxed">
            CampusLink es una plataforma independiente impulsada por estudiantes.
            Aquí compartimos material, calificamos nuestra experiencia académica
            y construimos una red de apoyo mutuo profesional.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 lg:gap-14">
          {[
            { icon: BookOpen, title: 'Materiales', desc: 'Accede a apuntes detallados, exámenes pasados y guías compartidas por tu comunidad.', color: 'blue' },
            { icon: Star, title: 'Profesores', desc: 'Encuentra y comparte valoraciones reales sobre metodologías y experiencias de clase.', color: 'blue' },
            { icon: Calendar, title: 'Eventos', desc: 'Organización centralizada de fechas críticas, talleres y conferencias estudiantiles.', color: 'blue' },
            { icon: Users, title: 'Comunidad', desc: 'Conecta con otros estudiantes para resolver dudas y colaborar en proyectos.', color: 'blue' },
            { icon: TrendingUp, title: 'Progreso', desc: 'Herramientas interactivas para seguir tu avance académico de forma efectiva.', color: 'blue' },
            { icon: Award, title: 'Prestigio', desc: 'Gana reconocimiento y beneficios únicos por tus contribuciones valiosas.', color: 'blue' },
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <Card className="group h-full border-none shadow-2xl shadow-gray-200/50 hover:shadow-blue-300/30 transition-all duration-700 rounded-[32px] overflow-hidden bg-white p-4">
                <CardHeader className="space-y-6 flex flex-col items-center sm:items-start text-center sm:text-left">
                  <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center transition-all duration-700 group-hover:bg-blue-600 group-hover:text-white group-hover:-translate-y-2 group-hover:rotate-[10deg] shadow-lg shadow-blue-100/50">
                    <feature.icon size={36} strokeWidth={2.5} />
                  </div>
                  <div className="space-y-3">
                    <CardTitle className="text-2xl font-black text-[#002d5a] italic uppercase tracking-tight">
                      {feature.title}
                    </CardTitle>
                    <CardDescription className="text-gray-500 font-bold leading-relaxed text-sm">
                      {feature.desc}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
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