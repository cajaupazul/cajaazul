'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';
import { isProfileComplete } from '@/lib/profile-completion';
import { GoogleButton } from './GoogleButton';
import styles from './AuthExperience.module.css';

type AuthMode = 'login' | 'register';

type AuthImages = Record<AuthMode, string>;

const content = {
  login: {
    eyebrow: 'Qué bueno tenerte aquí',
    visualTitle: 'Todo sigue aquí.',
    formLabel: 'Acceso a CampusLink',
    title: 'Qué bueno verte de nuevo.',
    description: 'Continúa con Google para entrar de forma rápida y segura.',
    button: 'Continuar con Google',
    switchPrompt: '¿Primera vez por aquí?',
    switchLabel: 'Crear una cuenta',
    imageAlt: 'Mascota de CampusLink dando la bienvenida',
  },
  register: {
    eyebrow: 'Tu espacio empieza aquí',
    visualTitle: 'Crea. Comparte. Avanza.',
    formLabel: 'Nueva cuenta',
    title: 'Haz espacio para lo que viene.',
    description: 'Únete con Google. Solo tomará un momento y no tendrás que recordar otra contraseña.',
    button: 'Crear cuenta con Google',
    switchPrompt: '¿Ya tienes una cuenta?',
    switchLabel: 'Iniciar sesión',
    imageAlt: 'Comunidad de mascotas de CampusLink',
  },
} as const;

const modePath: Record<AuthMode, string> = {
  login: '/auth/login',
  register: '/auth/register',
};

function getAuthErrorMessage(value: string) {
  const decoded = decodeURIComponent(value);
  const messages: Record<string, string> = {
    DOMAIN_RESTRICTED: 'Este correo no está autorizado para ingresar a CampusLink.',
    ACCESS_NOT_AUTHORIZED: 'Esta cuenta todavía no tiene acceso. Usa tu correo institucional o solicita autorización a un administrador.',
    AUTH_ACCESS_UNAVAILABLE: 'No pudimos verificar el acceso en este momento. Inténtalo nuevamente en unos segundos.',
  };

  return messages[decoded] || decoded;
}

export function AuthExperience() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { session, profile, loading: profileLoading } = useProfile();
  const [mode, setMode] = useState<AuthMode>(() => pathname.endsWith('/register') ? 'register' : 'login');
  const [error, setError] = useState('');
  const [images, setImages] = useState<AuthImages>({ login: '', register: '' });
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMode(pathname.endsWith('/register') ? 'register' : 'login');
  }, [pathname]);

  useEffect(() => {
    router.prefetch('/auth/login');
    router.prefetch('/auth/register');
  }, [router]);

  useEffect(() => {
    if (!session || profileLoading) return;

    if (session.user?.is_anonymous) {
      return;
    }

    if (isProfileComplete(profile)) {
      router.replace('/dashboard');
      return;
    }

    router.replace('/auth/complete-profile');
  }, [profile, profileLoading, router, session]);

  useEffect(() => {
    const hash = window.location.hash;
    const authError = searchParams.get('error');

    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1));
      const errorMessage = params.get('error_description') || params.get('error') || 'Error de autenticación';
      setError(getAuthErrorMessage(errorMessage));
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } else if (authError) {
      setError(getAuthErrorMessage(authError));
    }
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    const fetchImages = async () => {
      const { data, error: imageError } = await supabase
        .from('auth_images')
        .select('image_type, image_url')
        .in('image_type', ['login', 'register']);

      if (!active) return;

      if (imageError) {
        console.error('[AUTH_IMAGES_ERROR]', imageError.code, imageError.message);
        return;
      }

      const nextImages: AuthImages = { login: '', register: '' };
      data?.forEach((item) => {
        const imageType = item.image_type as AuthMode;
        if (imageType === 'login' || imageType === 'register') {
          nextImages[imageType] = item.image_url || '';
        }
      });
      setImages(nextImages);
    };

    void fetchImages();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (focusTimer.current) clearTimeout(focusTimer.current);
    };
  }, []);

  const changeMode = useCallback((nextMode: AuthMode) => {
    if (nextMode === mode) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setError('');
    setMode(nextMode);
    router.push(modePath[nextMode], { scroll: false });

    if (focusTimer.current) clearTimeout(focusTimer.current);

    const transitionDuration = reduceMotion ? 0 : 680;
    focusTimer.current = setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-auth-heading="${nextMode}"]`)?.focus({ preventScroll: true });
    }, transitionDuration + 20);
  }, [mode, router]);

  const isRegister = mode === 'register';

  return (
    <main className={styles.page}>
      <div className={`${styles.stage} ${isRegister ? styles.registerActive : ''}`}>
        <AuthForm mode="login" error={error} active={!isRegister} onSwitch={() => changeMode('register')} />
        <AuthForm mode="register" error={error} active={isRegister} onSwitch={() => changeMode('login')} />

        <div className={styles.storyViewport} aria-live="polite">
          <div className={styles.storyTrack}>
            <StoryPanel mode="login" imageUrl={images.login} active={!isRegister} onSwitch={() => changeMode('register')} />
            <StoryPanel mode="register" imageUrl={images.register} active={isRegister} onSwitch={() => changeMode('login')} />
          </div>
        </div>
      </div>
    </main>
  );
}

type AuthFormProps = {
  mode: AuthMode;
  error: string;
  active: boolean;
  onSwitch: () => void;
};

function AuthForm({ mode, error, active, onSwitch }: AuthFormProps) {
  const copy = content[mode];

  return (
    <section
      className={`${styles.formPanel} ${mode === 'login' ? styles.loginForm : styles.registerForm}`}
      aria-labelledby={`${mode}-title`}
      aria-hidden={!active}
      inert={!active}
    >
      <Link href="/" className={styles.backLink}>
        <ArrowLeft size={18} aria-hidden="true" />
        Volver al inicio
      </Link>

      <div className={styles.formContent}>
        <p className={styles.formLabel}>{copy.formLabel}</p>
        <h1 id={`${mode}-title`} data-auth-heading={mode} tabIndex={-1}>{copy.title}</h1>
        <p className={styles.description}>{copy.description}</p>

        {error && active && <div className={styles.error} role="alert">{error}</div>}

        <div className={styles.action}>
          <GoogleButton text={copy.button} />
        </div>

        <div className={styles.securityNote}>
          <LockKeyhole size={17} aria-hidden="true" />
          <p>
            <strong>Acceso protegido.</strong>
            <span> CampusLink nunca recibe tu contraseña de Google.</span>
          </p>
        </div>

        <div className={styles.switchAccount}>
          <span>{copy.switchPrompt}</span>
          <button type="button" onClick={onSwitch}>{copy.switchLabel}</button>
        </div>
      </div>

      <p className={styles.legal}>Al continuar, aceptas los términos y la política de privacidad de CampusLink.</p>
    </section>
  );
}

type StoryPanelProps = {
  mode: AuthMode;
  imageUrl: string;
  active: boolean;
  onSwitch: () => void;
};

function StoryPanel({ mode, imageUrl, active, onSwitch }: StoryPanelProps) {
  const copy = content[mode];

  return (
    <section
      className={`${styles.storyPanel} ${mode === 'login' ? styles.loginStory : styles.registerStory}`}
      aria-hidden={!active}
      inert={!active}
    >
      <div className={styles.storyGrid} aria-hidden="true" />

      <Link href="/" className={styles.brand} aria-label="Volver a CampusLink">
        <span className={styles.brandMark}>
          <img src="/logo/logo-campuslink-v2.png" alt="" />
        </span>
        <span>CampusLink</span>
      </Link>

      <div className={styles.storyContent}>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h2>{copy.visualTitle}</h2>
      </div>

      <div className={styles.storyCircle}>
        {imageUrl ? (
          <img src={imageUrl} alt={copy.imageAlt} />
        ) : (
          <div className={styles.visualFallback} aria-label="CampusLink">
            <img src="/logo/logo-campuslink-v2.png" alt="" />
          </div>
        )}
      </div>

      <div className={styles.storyAction}>
        <p>{copy.switchPrompt}</p>
        <button type="button" onClick={onSwitch}>{copy.switchLabel}</button>
      </div>
    </section>
  );
}
