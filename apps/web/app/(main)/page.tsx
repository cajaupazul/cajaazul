'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import HeroCarousel from '@/components/landing/HeroCarousel';

// ── Comunidad Activa: cycling emoji particles ──────────────────────────────
type ParticleMode = 'hearts' | 'comments' | 'tomatoes';
interface Particle { id: number; x: number; icon: string; delay: number; }

const PARTICLE_SETS: Record<ParticleMode, string[]> = {
  hearts:   ['❤️','💙','💚','💛','🧡','💜'],
  comments: ['💬','🗨️','🗯️','💭','✉️','📩'],
  tomatoes: ['🍅','🫑','🥦','🌽','🥕','🍆'],
};

const MODES: ParticleMode[] = ['hearts', 'comments', 'tomatoes'];

function ComunidadActiva() {
  const [hovered, setHovered] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    const particleCount = 28;
    const particles: { x: number; y: number; vx: number; vy: number; radius: number }[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: 2 + Math.random() * 2.5,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        p.x = Math.max(0, Math.min(width, p.x));
        p.y = Math.max(0, Math.min(height, p.y));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = hovered ? 'rgba(96, 165, 250, 0.5)' : 'rgba(255, 255, 255, 0.15)';
        ctx.fill();

        for (let j = idx + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 75) {
            const alpha = (1 - dist / 75) * (hovered ? 0.25 : 0.08);
            ctx.strokeStyle = `rgba(96, 165, 250, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }

        if (mouseRef.current.active && hovered) {
          const distToMouse = Math.hypot(p.x - mouseRef.current.x, p.y - mouseRef.current.y);
          if (distToMouse < 110) {
            const alpha = (1 - distToMouse / 110) * 0.35;
            ctx.strokeStyle = `rgba(96, 165, 250, ${alpha})`;
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
            ctx.stroke();

            p.x += (mouseRef.current.x - p.x) * 0.015;
            p.y += (mouseRef.current.y - p.y) * 0.015;
          }
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [hovered]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    };
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => {
        setHovered(true);
        mouseRef.current.active = true;
      }}
      onMouseLeave={() => {
        setHovered(false);
        mouseRef.current.active = false;
      }}
      onMouseMove={handleMouseMove}
      className="md:col-span-4 bg-[#001736] text-on-primary rounded-3xl p-8 flex flex-col justify-between shadow-lg relative overflow-hidden cursor-pointer transition-all duration-500 hover:scale-[1.03] hover:shadow-2xl border border-white/5 min-h-[320px]"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      <div className="relative z-10">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-all duration-300 ${hovered ? 'bg-white/20' : 'bg-white/10'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="font-bold text-2xl text-white mb-2">Comunidad Activa</h3>
        <p className={`text-sm transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-80'}`}>
          Conecta con miles de estudiantes de tu misma carrera y comparte conocimientos de valor.
        </p>
      </div>
      <div className="relative z-10 mt-6 flex flex-col gap-4">
        <a className="flex items-center gap-2 font-semibold hover:gap-4 transition-all text-blue-400" href="#">
          Unirse ahora
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </a>
      </div>
    </div>
  );
}

// ── Rankings: animated bar chart on hover ─────────────────────────────────
const BARS = [
  { label: 'A+', height: 90, color: '#60a5fa' },
  { label: 'A',  height: 70, color: '#818cf8' },
  { label: 'B+', height: 55, color: '#a78bfa' },
  { label: 'B',  height: 40, color: '#c084fc' },
  { label: 'C',  height: 25, color: '#e879f9' },
];

function RankingsCard() {
  const [hovered, setHovered] = useState(false);
  const BARS = [
    { label: 'A+', height: 72, color: '#60a5fa' },
    { label: 'A',  height: 56, color: '#818cf8' },
    { label: 'B+', height: 42, color: '#a78bfa' },
    { label: 'B',  height: 28, color: '#c084fc' },
    { label: 'C',  height: 16, color: '#e879f9' },
  ];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="md:col-span-4 bg-[#0051d5] text-white rounded-3xl p-8 flex flex-col justify-between shadow-sm transition-all duration-500 hover:scale-[1.03] cursor-pointer overflow-hidden relative min-h-[320px]"
    >
      <div>
        <div className="bg-white/10 w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-all duration-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="font-bold text-2xl text-white mb-2">Rankings de Profes</h3>
        <p className={`text-sm transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-85'}`}>
          Consulta las opiniones y métodos de evaluación antes de matricularte en el próximo ciclo.
        </p>
      </div>

      <div className="mt-6 flex items-end gap-2 h-20">
        {BARS.map((bar, i) => (
          <div key={bar.label} className="flex flex-col items-center gap-1 flex-1">
            <motion.div
              initial={{ height: 8 }}
              animate={{ height: hovered ? bar.height : 8 }}
              transition={{ type: 'spring', stiffness: 120, damping: 14, delay: i * 0.05 }}
              style={{ backgroundColor: bar.color }}
              className="w-full rounded-t-lg min-h-[8px]"
            />
            <span className="text-[9px] font-bold opacity-60">{bar.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Herramientas: tech matrix rain effect ─────────────────────────────────
const TECH_CHARS = '01アイウエオカキクケコサシスセソ{}<>[]()';
function TechCard() {
  const [hovered, setHovered] = useState(false);
  const [drops, setDrops] = useState<{id:number; x:number; chars:string; speed:number}[]>([]);
  const intervalRef = useRef<NodeJS.Timeout|null>(null);
  const idRef = useRef(0);

  const makeDrops = useCallback(() => {
    const arr = Array.from({length: 6}, () => {
      const len = 4 + Math.floor(Math.random() * 5);
      const chars = Array.from({length: len}, () =>
        TECH_CHARS[Math.floor(Math.random() * TECH_CHARS.length)]
      ).join('\n');
      return { id: idRef.current++, x: 5 + Math.random() * 90, chars, speed: 1.5 + Math.random() * 2 };
    });
    setDrops(prev => [...prev, ...arr]);
    setTimeout(() => setDrops(prev => prev.filter(d => !arr.find(a => a.id === d.id))), 3000);
  }, []);

  useEffect(() => {
    if (hovered) {
      makeDrops();
      intervalRef.current = setInterval(makeDrops, 600);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDrops([]);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [hovered, makeDrops]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="md:col-span-8 bg-surface-bright rounded-3xl p-8 border border-outline-variant flex items-center gap-8 sm:gap-12 transition-all duration-500 hover:bg-surface-container-high hover:border-secondary hover:shadow-xl cursor-pointer overflow-hidden relative"
    >
      {/* Matrix rain */}
      <AnimatePresence>
        {drops.map(drop => (
          <motion.div
            key={drop.id}
            initial={{ opacity: 0.8, y: -40 }}
            animate={{ opacity: 0, y: 200 }}
            exit={{ opacity: 0 }}
            transition={{ duration: drop.speed, ease: 'linear' }}
            style={{ left: `${drop.x}%`, position: 'absolute', top: 0, pointerEvents: 'none' }}
            className="font-mono text-xs text-secondary/50 whitespace-pre leading-5 z-0"
          >
            {drop.chars}
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="flex-1 relative z-10">
        <h3 className={`font-headline-lg text-headline-lg mb-4 transition-colors duration-300 ${hovered ? 'text-secondary' : 'text-primary'}`}>
          Herramientas de Productividad
        </h3>
        <p className={`mb-6 transition-colors duration-300 ${hovered ? 'text-on-surface' : 'text-on-surface-variant'}`}>
          Accede a extensiones útiles para tu navegador y organiza mejor tus horarios de estudio.
        </p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <button className="px-6 py-2.5 rounded-xl border border-primary text-primary font-label-lg hover:bg-primary hover:text-on-primary transition-all shadow-sm">
            Explorar Herramientas
          </button>
          <motion.span
            animate={{ opacity: hovered ? 1 : 0, x: hovered ? 0 : -10 }}
            transition={{ duration: 0.4 }}
            className="text-sm font-semibold text-secondary"
          >
            📅 Ver Horarios
          </motion.span>
        </div>
      </div>

      {/* Tech icon orb */}
      <div className={`hidden sm:flex w-36 h-36 sm:w-40 sm:h-40 bg-surface-container rounded-2xl items-center justify-center transition-all duration-500 relative z-10 shrink-0 ${hovered ? 'rotate-0 scale-110 text-secondary/60' : 'rotate-3 text-primary/20'}`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
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
        .reveal-item {
          opacity: 0;
          transform: translateY(10px);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .group:hover .reveal-item {
          opacity: 1;
          transform: translateY(0);
        }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body, .font-body-md { font-family: 'Inter', sans-serif; }
      `}} />

      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 h-full hidden sm:flex flex-col items-center py-8 z-40 bg-primary shadow-lg w-14 sm:w-16">
        <div className="mb-10">
          <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
            </svg>
          </div>
        </div>
        <nav className="flex flex-col gap-7 flex-grow items-center">
          {[
            { label:'Facebook',  d:'M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z' },
            { label:'Twitter',   d:'M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z' },
            { label:'YouTube',   d:'M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z' },
            { label:'LinkedIn',  d:'M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a2.7 2.7 0 0 0-2.7-2.7c-1.2 0-2 .7-2.3 1.2v-1h-3.1v7.8h3.1v-4.2c0-.6.4-1.1 1-1.1s1 .5 1 1.1v4.2h3.1M6.9 7.6c-1 0-1.7.8-1.7 1.7s.8 1.7 1.7 1.7 1.8-.8 1.8-1.7-.8-1.7-1.8-1.7m1.5 10.9V10.7H5.4v7.8h3z' },
            { label:'Instagram', d:'M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6m4.4 3a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3m5-2.25a.75.75 0 0 1 .75.75.75.75 0 0 1-.75.75.75.75 0 0 1-.75-.75.75.75 0 0 1 .75-.75z' },
            { label:'TikTok',    d:'M12.525.02c1.31 0 2.59.1 3.81.3v3.7c-1.18-.36-2.42-.51-3.66-.44v13.06c0 2.15-1.75 3.9-3.9 3.9s-3.9-1.75-3.9-3.9 1.75-3.9 3.9-3.9c.4 0 .78.06 1.15.17V9.11c-3.66.19-6.59 3.23-6.59 6.95 0 3.84 3.12 6.96 6.96 6.96s6.96-3.12 6.96-6.96V6.03C19.34 7.57 21.46 8.5 23.82 8.64V4.9c-1.85-.01-3.59-.83-4.79-2.23C18.17 1.57 17.65 0 17.65 0h-5.125z' },
          ].map(s => (
            <a key={s.label} aria-label={s.label} href="#" className="text-white/50 hover:text-white hover:scale-110 transition-all duration-300">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d={s.d} /></svg>
            </a>
          ))}
        </nav>
      </aside>

      <main className="ml-0 sm:ml-16 min-h-screen flex flex-col">
        {/* TopNavBar */}
        <header className={`bg-[#001736] shadow-lg sticky top-0 z-30 transition-all duration-300 ${scrolled ? 'py-2' : 'py-0'}`}>
          <div className="flex justify-between items-center h-16 sm:h-20 w-full px-4 sm:px-10 max-w-[1280px] mx-auto">
            <div className="flex items-center gap-3">
              <img src="/logo/logo-campuslink-v2.png" alt="CampusLink Logo" className="h-8 sm:h-10 w-auto object-contain" />
              <span className="font-extrabold text-white uppercase tracking-tight text-lg hidden sm:block">CampusLink</span>
            </div>

            <nav className="hidden md:flex items-center gap-6 lg:gap-8">
              {['Explorar','Categorías','Investigación','Repositorio'].map((item, i) => (
                <a key={item} href="#" className={`font-semibold text-[13px] tracking-wider transition-colors duration-200 pb-1 ${i === 0 ? 'text-white border-b-2 border-blue-400' : 'text-white/60 hover:text-white border-b-2 border-transparent hover:border-white/30'}`}>
                  {item}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/auth/login">
                <button className="px-4 sm:px-6 py-2 rounded-full border border-white/60 text-white text-[12px] sm:text-[13px] font-semibold tracking-wider hover:bg-white hover:text-[#001736] transition-all duration-300 hidden sm:block">
                  LOGIN
                </button>
              </Link>
              <Link href="/auth/register">
                <button className="px-4 sm:px-6 py-2 rounded-full bg-white text-[#001736] text-[12px] sm:text-[13px] font-bold tracking-wider shadow-lg hover:bg-blue-50 active:scale-95 transition-all duration-200">
                  REGÍSTRATE
                </button>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section — pure HeroCarousel, no overlay text or stats */}
        <section className="relative overflow-hidden">
          <HeroCarousel />
        </section>

        {/* Academic Hub Features */}
        <section className="py-16 sm:py-20 px-4 sm:px-10 max-w-[1280px] mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="font-extrabold text-3xl sm:text-4xl text-primary mb-4">Herramientas para tu éxito</h2>
            <p className="text-on-surface-variant max-w-xl mx-auto text-base">
              Diseñado para la eficiencia académica y la colaboración fluida entre estudiantes.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

            {/* Repositorio Premium (Large) */}
            <div className="md:col-span-8 bg-surface-container-low rounded-3xl p-6 sm:p-8 flex flex-col justify-between min-h-[380px] group overflow-hidden relative shadow-sm border border-outline-variant/30 transition-all duration-500 hover:shadow-2xl hover:scale-[1.01] cursor-pointer">
              <div className="relative z-10">
                <div className="bg-secondary/10 w-12 h-12 rounded-xl flex items-center justify-center text-secondary mb-6 group-hover:bg-secondary group-hover:text-on-primary transition-all duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h3 className="font-bold text-2xl text-primary mb-4 group-hover:text-secondary transition-colors duration-300">Repositorio Premium</h3>
                <p className="text-on-surface-variant max-w-md group-hover:text-on-surface transition-colors duration-300 text-sm sm:text-base">
                  Accede a las mejores notas y resúmenes de tus cursos, verificados por la comunidad estudiantil de alto rendimiento.
                </p>
                <div className="mt-6 flex gap-2 sm:gap-3 flex-wrap">
                  {['Derecho','Ciencias Empresariales','Economía y Finanzas','Ingeniería'].map((f, i) => (
                    <span
                      key={f}
                      className="reveal-item bg-surface-container-highest px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-[12px] text-primary font-semibold"
                      style={{transitionDelay: `${0.1 + i * 0.1}s`}}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-auto relative z-10 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 delay-200">
                <a className="inline-flex items-center gap-2 text-secondary font-bold hover:underline text-sm" href="#">
                  Explorar todas las facultades
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
              {/* Waifu video decoration */}
              <div className="absolute -bottom-8 -right-8 w-1/2 sm:w-2/5 opacity-20 group-hover:opacity-90 transition-all duration-700 group-hover:scale-105 pointer-events-none">
                <video src="/waifu/fg_video.webm" autoPlay loop muted playsInline className="w-full h-auto drop-shadow-2xl" />
              </div>
            </div>

            {/* Comunidad Activa — interactive component */}
            <ComunidadActiva />

            {/* Rankings de Profes — animated bars component */}
            <RankingsCard />

            {/* Herramientas de Productividad — tech rain component */}
            <TechCard />

          </div>
        </section>

        {/* Footer */}
        <footer className="mt-auto bg-surface-container-low border-t border-outline-variant">
          <div className="w-full py-8 px-4 sm:px-10 grid grid-cols-1 md:grid-cols-2 items-center gap-6 max-w-[1280px] mx-auto">
            <div className="flex flex-col gap-2">
              <span className="font-bold text-xl text-primary">CampusLink</span>
              <p className="text-sm text-on-surface-variant">© {new Date().getFullYear()} CampusLink. Academic Excellence Guaranteed.</p>
            </div>
            <div className="flex flex-wrap md:justify-end gap-x-6 gap-y-3">
              {['Privacidad','Términos','Contacto','Ayuda','Investigadores'].map(item => (
                <a key={item} href="#" className="text-on-surface-variant hover:text-primary transition-colors text-sm underline-offset-4 hover:underline">{item}</a>
              ))}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
