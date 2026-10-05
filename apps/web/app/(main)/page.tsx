'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
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
    description: 'Apuntes, prácticas y recursos organizados para que encuentres lo importante por curso.',
    href: '/dashboard/courses',
    linkLabel: 'Explorar cursos',
    icon: BookOpen,
    tone: 'blue',
  },
  {
    title: 'Profesores',
    description: 'Experiencias de estudiantes para elegir tu próxima sección con más contexto.',
    href: '/dashboard/professors',
    linkLabel: 'Ver profesores',
    icon: Star,
    tone: 'yellow',
  },
  {
    title: 'Biblioteca',
    description: 'Documentos seleccionados en un repositorio simple de recorrer.',
    href: '/dashboard/library',
    linkLabel: 'Abrir biblioteca',
    icon: Library,
    tone: 'green',
  },
  {
    title: 'Comunidad',
    description: 'Conversaciones y espacios para conectar con estudiantes de la UP.',
    href: '/dashboard/community',
    linkLabel: 'Ir a comunidad',
    icon: Users,
    tone: 'red',
  },
  {
    title: 'Herramientas',
    description: 'Horarios, flujogramas y utilidades para organizar mejor tu ciclo.',
    href: '/dashboard/herramientas',
    linkLabel: 'Ver herramientas',
    icon: Wrench,
    tone: 'cyan',
  },
  {
    title: 'Grupos de estudio',
    description: 'Encuentra compañeros por curso y avancen juntos hacia la meta.',
    href: '/dashboard/grupos',
    linkLabel: 'Encontrar grupos',
    icon: Network,
    tone: 'purple',
  },
] as const;

const steps = [
  {
    title: 'Busca por curso o profesor',
    description: 'Empieza por lo que necesitas hoy y llega al contenido sin recorridos innecesarios.',
    icon: Search,
  },
  {
    title: 'Revisa el contexto',
    description: 'Contrasta materiales y experiencias antes de elegir, descargar o compartir.',
    icon: ShieldCheck,
  },
  {
    title: 'Devuelve algo útil',
    description: 'Comparte lo que te sirvió para que el siguiente estudiante también avance.',
    icon: Sparkles,
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
  const modalRef = useRef<HTMLElement>(null);
  const modalCloseRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen && !complaintOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      setComplaintOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, complaintOpen]);

  useEffect(() => {
    if (!complaintOpen) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modalCloseRef.current?.focus();

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [complaintOpen]);

  const handleSectionLink = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    event.preventDefault();
    const target = document.getElementById(href.slice(1));
    if (!target) return;

    window.history.replaceState(null, '', href);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
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
      setGuestError('No pudimos abrir el modo invitado. Inténtalo nuevamente.');
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <a href="#contenido" className={styles.skipLink}>
        Saltar al contenido
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" aria-label="CampusLink, ir al inicio" className={styles.logoLink}>
            <Image
              src="/logo/logo-campuslink-v2.png"
              alt="CampusLink"
              width={124}
              height={64}
              priority
              className={styles.logo}
            />
          </Link>

          <nav aria-label="Navegación principal" className={styles.desktopNav}>
            {navigation.map((item) => (
              <a key={item.label} href={item.href} onClick={(event) => handleSectionLink(event, item.href)}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className={styles.headerActions}>
            <Link href="/auth/login" className={styles.loginLink}>
              Iniciar sesión
            </Link>
            <Link href="/auth/register" className={styles.headerCta}>
              Crear cuenta
            </Link>
          </div>

          <button
            type="button"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
            className={styles.menuButton}
          >
            {menuOpen ? <X size={21} /> : <Menu size={22} />}
          </button>
        </div>

        <div id="mobile-navigation" className={`${styles.mobileNav} ${menuOpen ? styles.mobileNavOpen : ''}`}>
          <nav aria-label="Navegación móvil">
            {navigation.map((item) => (
              <a key={item.label} href={item.href} onClick={(event) => handleSectionLink(event, item.href)}>
                {item.label}
                <ArrowRight size={17} aria-hidden="true" />
              </a>
            ))}
            <div className={styles.mobileActions}>
              <Link href="/auth/login" onClick={closeMenu}>
                Ingresar
              </Link>
              <Link href="/auth/register" onClick={closeMenu}>
                Crear cuenta
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <main id="contenido">
        <section className={styles.hero}>
          <Image
            src="/carrusel/visiting-students.jpg"
            alt="Campus de la Universidad del Pacífico al anochecer"
            fill
            priority
            sizes="100vw"
            quality={86}
            className={styles.heroImage}
          />
          <div className={styles.heroOverlay} aria-hidden="true" />

          <div className={styles.heroInner}>
            <div className={styles.heroContent}>
              <span className={styles.heroKicker}>Comunidad Estudiantil UP</span>
              <h1>
                Tu vida académica,
                <span> más clara.</span>
              </h1>
              <div className={styles.heroDivider} aria-hidden="true" />
              <p>
                Materiales, evaluaciones pasadas, profesores y herramientas creadas por estudiantes para resolver tu ciclo.
              </p>
              <div className={styles.heroActions}>
                <Link href="/auth/register" className={styles.primaryButton}>
                  Crear mi cuenta
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={handleGuestLogin}
                  disabled={isGuestLoading}
                  className={styles.secondaryButton}
                >
                  {isGuestLoading ? 'Abriendo CampusLink...' : 'Explorar como invitado'}
                </button>
              </div>
              {guestError && (
                <p role="alert" className={styles.guestError}>
                  {guestError}
                </p>
              )}
            </div>
          </div>
        </section>

        <aside className={styles.disclaimer} aria-label="Información sobre CampusLink">
          <div>
            <ShieldCheck size={21} aria-hidden="true" />
            <p>
              <strong>Hecho por estudiantes.</strong> CampusLink es un proyecto independiente y no está afiliado oficialmente a la Universidad del Pacífico.
            </p>
          </div>
        </aside>

        <section id="recursos" className={styles.section}>
          <div className={styles.sectionIntro}>
            <h2>Encuentra lo que necesitas, sin dar vueltas.</h2>
            <p>
              Todo lo que acompaña tu ciclo, reunido en rutas claras para que puedas enfocarte en avanzar.
            </p>
          </div>

          <div className={styles.resourceGrid}>
            {resources.map((resource, index) => {
              const Icon = resource.icon;
              return (
                <Link
                  key={resource.title}
                  href={resource.href}
                  className={`${styles.resourceCard} ${styles[`resourceCard${index + 1}`]} ${styles[`tone${resource.tone}`]}`}
                >
                  <span className={styles.resourceIcon}>
                    <Icon size={23} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{resource.title}</h3>
                    <p>{resource.description}</p>
                  </div>
                  <span className={styles.resourceLink}>
                    {resource.linkLabel}
                    <ArrowRight size={17} aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section id="comunidad" className={`${styles.section} ${styles.communitySection}`}>
          <div className={styles.communityPanel}>
            <div className={styles.communityImageWrap}>
              <Image
                src="/carrusel/foto-4.webp"
                alt="Aula de la Universidad del Pacífico preparada para una clase"
                fill
                sizes="(max-width: 767px) 100vw, 52vw"
                quality={82}
                className={styles.communityImage}
              />
            </div>
            <div className={styles.communityContent}>
              <span className={styles.communityIcon}>
                <Users size={24} aria-hidden="true" />
              </span>
              <h2>Lo que sabes puede ayudar a alguien más.</h2>
              <p>
                Comparte materiales, encuentra compañeros y aprende de quienes ya recorrieron el mismo curso.
              </p>
              <Link href="/dashboard/community" className={styles.textLink}>
                Conocer la comunidad
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section id="como-funciona" className={`${styles.section} ${styles.howSection}`}>
          <div className={styles.howIntro}>
            <h2>Tres pasos. Cero complicaciones.</h2>
            <p>CampusLink está pensado para entrar, resolver y seguir con tu día.</p>
          </div>

          <ol className={styles.steps}>
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title}>
                  <span className={styles.stepNumber}>0{index + 1}</span>
                  <span className={styles.stepIcon}>
                    <Icon size={23} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className={`${styles.section} ${styles.finalSection}`}>
          <div className={styles.finalCta}>
            <div>
              <h2>Tu próximo ciclo empieza con más claridad.</h2>
              <p>Crea tu cuenta y lleva contigo todo lo que la comunidad ya aprendió.</p>
            </div>
            <Link href="/auth/register" className={styles.darkButton}>
              Crear mi cuenta
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <div className={styles.footerLogo}>
              <Image src="/logo/logo-campuslink-v2.png" alt="" width={88} height={48} className="h-10 w-auto object-contain" />
            </div>
            <p>Un repositorio independiente para la comunidad estudiantil UP.</p>
          </div>

          <div className={styles.socials}>
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
                >
                  <Icon size={19} strokeWidth={1.8} />
                </a>
              );
            })}
          </div>

          <div className={styles.footerLinks}>
            <nav aria-label="Enlaces del pie">
              <Link href="/dashboard/about">Nosotros</Link>
              <Link href="/privacy">Privacidad</Link>
              <Link href="/terms">Términos</Link>
              <button type="button" onClick={() => setComplaintOpen(true)}>
                <FileText size={15} />
                Libro de reclamaciones
              </button>
            </nav>
            <p>© {new Date().getFullYear()} CampusLink</p>
          </div>
        </div>
      </footer>

      {complaintOpen && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setComplaintOpen(false);
          }}
        >
          <section ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="complaint-title" className={styles.modal}>
            <button
              ref={modalCloseRef}
              type="button"
              onClick={() => setComplaintOpen(false)}
              aria-label="Cerrar libro de reclamaciones"
              className={styles.modalClose}
            >
              <X size={19} />
            </button>

            <span className={styles.modalIcon}>
              <FileText size={22} />
            </span>
            <h2 id="complaint-title">¿En serio crees que nosotros nos equivocamos?</h2>
            <p>
              Bueno, puede pasar. Cuéntanos qué ocurrió y lo revisaremos con la seriedad que merece, después de superar la sorpresa inicial.
            </p>

            <div className={styles.modalNote}>
              Al continuar se abrirá tu aplicación de correo para que quede constancia del mensaje.
            </div>

            <div className={styles.modalActions}>
              <a href="mailto:cliente@campuslink.pe?subject=Libro%20de%20reclamaciones%20-%20CampusLink">
                Sí, tengo un reclamo
                <ArrowRight size={17} />
              </a>
              <button type="button" onClick={() => setComplaintOpen(false)}>
                Falsa alarma
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
