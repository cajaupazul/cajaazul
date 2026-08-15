'use client';

import { useState, type MouseEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  Instagram,
  Library,
  Menu,
  MessageCircle,
  Music2,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import styles from './landing.module.css';

const navigation = [
  { label: 'Recursos', href: '#recursos' },
  { label: 'Comunidad', href: '#comunidad' },
  { label: 'Cómo funciona', href: '#como-funciona' },
];

const resources = [
  {
    title: 'Cursos y materiales',
    description: 'Encuentra apuntes, prácticas y recursos organizados por curso y facultad.',
    href: '/dashboard/courses',
    linkLabel: 'Explorar cursos',
    icon: BookOpen,
  },
  {
    title: 'Profesores',
    description: 'Consulta experiencias de otros estudiantes antes de elegir una sección.',
    href: '/dashboard/professors',
    linkLabel: 'Ver profesores',
    icon: Star,
  },
  {
    title: 'Biblioteca',
    description: 'Revisa documentos seleccionados en un repositorio fácil de navegar.',
    href: '/dashboard/library',
    linkLabel: 'Abrir biblioteca',
    icon: Library,
  },
  {
    title: 'Comunidad',
    description: 'Conecta con estudiantes, grupos y conversaciones de tu entorno académico.',
    href: '/dashboard/community',
    linkLabel: 'Ir a comunidad',
    icon: Users,
  },
  {
    title: 'Herramientas',
    description: 'Organiza horarios, crea flujogramas y reúne tus utilidades de estudio.',
    href: '/dashboard/herramientas',
    linkLabel: 'Ver herramientas',
    icon: Wrench,
  },
  {
    title: 'Grupos de estudio',
    description: 'Descubre equipos por curso, comparte objetivos y avanza acompañado.',
    href: '/dashboard/grupos',
    linkLabel: 'Encontrar grupos',
    icon: Network,
  },
];

const socialLinks = [
  {
    label: 'Instagram',
    href: process.env.NEXT_PUBLIC_INSTAGRAM_URL || 'https://www.instagram.com/',
    icon: Instagram,
  },
  {
    label: 'TikTok',
    href: process.env.NEXT_PUBLIC_TIKTOK_URL || 'https://www.tiktok.com/',
    icon: Music2,
  },
  {
    label: 'WhatsApp',
    href: process.env.NEXT_PUBLIC_WHATSAPP_URL || 'https://wa.me/',
    icon: MessageCircle,
  },
];

export default function HomePage() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState('');
  const [complaintOpen, setComplaintOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const handleSectionLink = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    event.preventDefault();
    const target = document.getElementById(href.slice(1));
    if (!target) return;

    window.history.replaceState(null, '', href);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    closeMenu();
  };

  const handleGuestLogin = async () => {
    try {
      setGuestError('');
      setIsGuestLoading(true);
      const { supabase } = await import('@/lib/supabase');
      await supabase.auth.signOut();
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      router.push('/dashboard');
    } catch (error) {
      console.error('[GUEST_LOGIN] Error:', error);
      setGuestError('No pudimos iniciar el modo invitado. Inténtalo nuevamente.');
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <div className={`${styles.page} min-h-screen bg-[#f3f1eb] text-[#10211f]`}>
      <a
        href="#contenido"
        className="sr-only z-[100] rounded-md bg-white px-4 py-3 text-sm font-semibold text-[#10211f] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-50 border-b border-[#10211f]/10 bg-[#f8f7f2]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" aria-label="CampusLink, ir al inicio" className="flex items-center">
            <Image
              src="/logo/logo-campuslink-v2.png"
              alt="CampusLink"
              width={112}
              height={58}
              priority
              className="h-[52px] w-auto object-contain"
            />
          </Link>

          <nav aria-label="Navegación principal" className="hidden items-center gap-8 lg:flex">
            {navigation.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(event) => handleSectionLink(event, item.href)}
                className="text-sm font-semibold text-[#3d4b48] transition-colors hover:text-[#d95738] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d95738]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            <Link
              href="/auth/login"
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-[#10211f] transition-colors hover:bg-[#10211f]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d95738]"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/auth/register"
              className="rounded-full bg-[#10211f] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#18312d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d95738]"
            >
              Crear cuenta
            </Link>
          </div>

          <button
            type="button"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
            className="grid size-11 place-items-center rounded-full border border-[#10211f]/15 text-[#10211f] transition-colors hover:bg-[#10211f]/5 sm:hidden"
          >
            {menuOpen ? <X size={21} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen && (
          <div id="mobile-navigation" className="border-t border-[#10211f]/10 bg-[#f8f7f2] px-5 py-5 sm:hidden">
            <nav aria-label="Navegación móvil" className="mx-auto flex max-w-[1440px] flex-col gap-1">
              {navigation.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(event) => handleSectionLink(event, item.href)}
                  className="rounded-xl px-4 py-3 text-base font-semibold text-[#273936] hover:bg-[#10211f]/5"
                >
                  {item.label}
                </a>
              ))}
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#10211f]/10 pt-4">
                <Link
                  href="/auth/login"
                  onClick={closeMenu}
                  className="rounded-full border border-[#10211f]/20 px-4 py-3 text-center text-sm font-semibold"
                >
                  Ingresar
                </Link>
                <Link
                  href="/auth/register"
                  onClick={closeMenu}
                  className="rounded-full bg-[#10211f] px-4 py-3 text-center text-sm font-semibold text-white"
                >
                  Registrarme
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main id="contenido">
        <section className={`${styles.hero} relative isolate overflow-hidden bg-[#0d2420] text-white`}>
          <Image
            src="/carrusel/visiting-students.jpg"
            alt="Campus universitario al anochecer"
            fill
            priority
            sizes="100vw"
            quality={82}
            className={styles.heroImage}
          />
          <div className={styles.heroOverlay} />
          <div className={styles.heroTexture} aria-hidden="true" />

          <div className="relative z-10 mx-auto flex min-h-[680px] max-w-[1440px] items-center px-5 py-20 sm:px-8 lg:min-h-[720px] lg:px-12">
            <div className={`${styles.heroContent} max-w-3xl`}>
              <div className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-[#ff9a7f] sm:text-sm">
                <span className="h-px w-10 bg-[#ff6b4a]" />
                Hecho para estudiantes
              </div>

              <h1 className="max-w-4xl text-[clamp(3rem,8vw,6.8rem)] font-semibold leading-[0.92] tracking-[-0.055em] text-white">
                Tu universidad,
                <span className="block text-[#ff7858]">mejor conectada.</span>
              </h1>

              <p className="mt-7 max-w-xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
                Materiales, profesores, grupos y herramientas en un espacio claro,
                construido para ayudarte a tomar mejores decisiones académicas.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/dashboard"
                  className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#ff6646] px-6 py-3.5 text-sm font-bold text-white shadow-[0_16px_40px_rgba(255,102,70,0.25)] transition-all hover:-translate-y-0.5 hover:bg-[#f15737] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  Explorar CampusLink
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </Link>
                <button
                  type="button"
                  onClick={handleGuestLogin}
                  disabled={isGuestLoading}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/30 bg-white/5 px-6 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:border-white/60 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  {isGuestLoading ? 'Ingresando…' : 'Entrar como invitado'}
                </button>
              </div>

              <div aria-live="polite" className="mt-3 min-h-5 text-sm text-[#ffc4b5]">
                {guestError}
              </div>

              <div className="mt-11 grid max-w-2xl grid-cols-1 gap-3 border-t border-white/20 pt-6 sm:grid-cols-3 sm:gap-6">
                {['Recursos organizados', 'Opiniones de estudiantes', 'Acceso desde cualquier dispositivo'].map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-sm font-medium text-white/70">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/10 text-[#ff9a7f]">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <a
            href="#recursos"
            onClick={(event) => handleSectionLink(event, '#recursos')}
            aria-label="Ver recursos"
            className="absolute bottom-8 right-5 z-20 hidden items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-white/65 transition-colors hover:text-white md:flex lg:right-12"
          >
            Descubre más
            <span className="grid size-10 place-items-center rounded-full border border-white/25">
              <ChevronRight size={17} className="rotate-90" />
            </span>
          </a>
        </section>

        <section id="recursos" className="scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
          <div className="mx-auto max-w-[1320px]">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c8492e]">Todo en un solo lugar</p>
                <h2 className="mt-4 max-w-xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-[#10211f] sm:text-5xl">
                  Menos tiempo buscando. Más tiempo avanzando.
                </h2>
              </div>
              <p className="max-w-2xl text-base leading-7 text-[#56635f] lg:justify-self-end lg:text-lg lg:leading-8">
                Una portada debe orientarte, no distraerte. Accede directamente a cada
                área de CampusLink con rutas claras y contenido pensado para tu día a día.
              </p>
            </div>

            <div className="mt-14 grid gap-px overflow-hidden rounded-[28px] border border-[#10211f]/10 bg-[#10211f]/10 sm:grid-cols-2 lg:grid-cols-3">
              {resources.map((resource, index) => {
                const Icon = resource.icon;
                return (
                  <Link
                    key={resource.title}
                    href={resource.href}
                    className={`${styles.resourceCard} group min-h-[280px] bg-[#faf9f5] p-7 sm:p-8`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="grid size-12 place-items-center rounded-2xl bg-[#e8ede8] text-[#173d36] transition-colors group-hover:bg-[#173d36] group-hover:text-white">
                        <Icon size={22} strokeWidth={1.8} />
                      </span>
                      <span className="font-mono text-xs text-[#10211f]/35">0{index + 1}</span>
                    </div>
                    <div className="mt-12">
                      <h3 className="text-xl font-semibold tracking-[-0.025em] text-[#10211f] sm:text-2xl">
                        {resource.title}
                      </h3>
                      <p className="mt-3 max-w-sm text-sm leading-6 text-[#66716e] sm:text-base">
                        {resource.description}
                      </p>
                      <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#b94229]">
                        {resource.linkLabel}
                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section id="comunidad" className="scroll-mt-24 px-5 pb-20 sm:px-8 sm:pb-28 lg:px-12">
          <div className="mx-auto grid max-w-[1320px] overflow-hidden rounded-[32px] bg-[#132d28] text-white lg:grid-cols-2">
            <div className="relative min-h-[360px] lg:min-h-[620px]">
              <Image
                src="/carrusel/foto-4.webp"
                alt="Aula universitaria preparada para una clase"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                quality={78}
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#132d28]/70 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-[#132d28]/30" />
              <div className="absolute bottom-6 left-6 rounded-full border border-white/20 bg-[#10211f]/70 px-4 py-2 text-xs font-semibold backdrop-blur-md">
                Un espacio compartido
              </div>
            </div>

            <div className="flex flex-col justify-center p-7 sm:p-12 lg:p-16">
              <div className="grid size-12 place-items-center rounded-2xl bg-[#ff6b4a] text-white">
                <Users size={22} />
              </div>
              <p className="mt-9 text-xs font-bold uppercase tracking-[0.2em] text-[#ff9a7f]">Comunidad CampusLink</p>
              <h2 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-5xl">
                El conocimiento mejora cuando circula.
              </h2>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
                Comparte materiales, encuentra grupos de estudio y aprende de la experiencia
                de estudiantes que ya llevaron tus cursos.
              </p>
              <Link
                href="/dashboard/community"
                className="group mt-9 inline-flex w-fit items-center gap-3 rounded-full border border-white/25 px-6 py-3.5 text-sm font-bold transition-colors hover:bg-white hover:text-[#132d28]"
              >
                Conocer la comunidad
                <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-24 border-y border-[#10211f]/10 bg-[#e9e7df] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
          <div className="mx-auto max-w-[1320px]">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c8492e]">Simple desde el inicio</p>
              <h2 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-[#10211f] sm:text-5xl">
                Entra, encuentra y continúa.
              </h2>
            </div>

            <div className="mt-14 grid gap-8 md:grid-cols-3 md:gap-0">
              {[
                {
                  step: '01',
                  title: 'Busca lo que necesitas',
                  description: 'Navega por curso, profesor o tipo de recurso sin recorridos innecesarios.',
                  icon: Search,
                },
                {
                  step: '02',
                  title: 'Revisa el contexto',
                  description: 'Contrasta materiales y experiencias antes de tomar una decisión.',
                  icon: ShieldCheck,
                },
                {
                  step: '03',
                  title: 'Aporta a la comunidad',
                  description: 'Comparte lo que te sirvió y ayuda a que el siguiente estudiante avance.',
                  icon: Sparkles,
                },
              ].map((item, index) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.step}
                    className={`relative py-3 md:px-8 ${index > 0 ? 'md:border-l md:border-[#10211f]/15' : 'md:pl-0'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-[#c8492e]">{item.step}</span>
                      <Icon size={22} strokeWidth={1.7} className="text-[#36514c]" />
                    </div>
                    <h3 className="mt-9 text-2xl font-semibold tracking-[-0.03em] text-[#10211f]">{item.title}</h3>
                    <p className="mt-3 text-base leading-7 text-[#5d6966]">{item.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
          <div className={`${styles.cta} mx-auto max-w-[1320px] overflow-hidden rounded-[32px] bg-[#ff6848] px-7 py-14 text-white sm:px-12 sm:py-16 lg:flex lg:items-end lg:justify-between lg:px-16`}>
            <div className="relative z-10 max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">Tu próximo ciclo empieza aquí</p>
              <h2 className="mt-4 text-4xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
                Lleva tu vida académica con más claridad.
              </h2>
            </div>
            <div className="relative z-10 mt-9 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:pl-10">
              <Link
                href="/auth/register"
                className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#10211f] px-6 py-3.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
              >
                Crear mi cuenta <ArrowRight size={17} />
              </Link>
              <button
                type="button"
                onClick={handleGuestLogin}
                disabled={isGuestLoading}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/50 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-white hover:text-[#c8492e] disabled:opacity-60"
              >
                Probar como invitado
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#10211f]/10 bg-[#10211f] px-5 py-10 text-white sm:px-8 lg:px-12 lg:py-12">
        <div className="mx-auto grid max-w-[1320px] gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.7fr_1fr] lg:items-start">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-white p-1.5">
              <Image src="/logo/logo-campuslink-v2.png" alt="" width={74} height={44} priority className="h-9 w-auto object-contain" />
            </div>
            <div>
              <p className="font-semibold">CampusLink</p>
              <p className="mt-1 text-sm text-white/50">Hecho por y para estudiantes.</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Encuéntranos</p>
            <div className="mt-4 flex items-center gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Abrir ${social.label}`}
                    title={social.label}
                    className="grid size-11 place-items-center rounded-full border border-white/15 text-white/65 transition-all hover:-translate-y-0.5 hover:border-[#ff8063] hover:bg-[#ff6848] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff8063]"
                  >
                    <Icon size={19} strokeWidth={1.8} />
                  </a>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col items-start gap-4 lg:items-end">
            <nav aria-label="Enlaces del pie" className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-white/60 lg:justify-end">
              <Link href="/dashboard/about" className="hover:text-white">Nosotros</Link>
              <Link href="/auth/login" className="hover:text-white">Ingresar</Link>
              <Link href="/auth/register" className="hover:text-white">Registrarse</Link>
              <button
                type="button"
                onClick={() => setComplaintOpen(true)}
                className="inline-flex items-center gap-1.5 text-left hover:text-white"
              >
                <FileText size={15} />
                Libro de reclamaciones
              </button>
            </nav>
            <p className="text-sm text-white/40">© {new Date().getFullYear()} CampusLink</p>
          </div>
        </div>
      </footer>

      {complaintOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-[#071412]/75 p-4 backdrop-blur-sm sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setComplaintOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="complaint-title"
            className="relative w-full max-w-lg rounded-[28px] bg-[#f8f7f2] p-7 text-[#10211f] shadow-2xl sm:p-9"
          >
            <button
              type="button"
              onClick={() => setComplaintOpen(false)}
              aria-label="Cerrar libro de reclamaciones"
              className="absolute right-5 top-5 grid size-10 place-items-center rounded-full border border-[#10211f]/10 transition-colors hover:bg-[#10211f]/5"
            >
              <X size={19} />
            </button>

            <div className="grid size-12 place-items-center rounded-2xl bg-[#ff6848] text-white">
              <FileText size={22} />
            </div>
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-[#c8492e]">Libro de reclamaciones</p>
            <h2 id="complaint-title" className="mt-3 pr-8 text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
              ¿En serio crees que nosotros nos equivocamos?
            </h2>
            <p className="mt-4 text-base leading-7 text-[#5b6864]">
              Bueno… puede pasar. Cuéntanos qué ocurrió y lo revisaremos con la seriedad
              que merece, después de superar la sorpresa inicial.
            </p>

            <div className="mt-7 rounded-2xl border border-[#10211f]/10 bg-white p-4 text-sm leading-6 text-[#5b6864]">
              Al continuar se abrirá tu aplicación de correo para que quede constancia del mensaje.
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href="mailto:cliente@campuslink.pe?subject=Libro%20de%20reclamaciones%20-%20CampusLink"
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#10211f] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#18312d]"
              >
                Sí, tengo un reclamo
                <ArrowRight size={17} />
              </a>
              <button
                type="button"
                onClick={() => setComplaintOpen(false)}
                className="min-h-12 rounded-full border border-[#10211f]/15 px-5 py-3 text-sm font-bold transition-colors hover:bg-[#10211f]/5"
              >
                Falsa alarma
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
