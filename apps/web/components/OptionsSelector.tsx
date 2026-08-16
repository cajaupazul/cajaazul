'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, BookOpen, Users, Calendar, Star, Megaphone, ArrowUpRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './OptionsSelector.module.css';

interface OptionData {
    id: number | string;
    background: string;
    icon: React.ElementType;
    main: string;
    sub: string;
    defaultColor: string;
    link?: string | null;
}

interface OptionsSelectorProps {
    accentColor?: string;
}

const DEFAULT_OPTIONS: OptionData[] = [
    {
        id: 1000,
        background: '/options/option-bg-1.jpg',
        icon: Trophy,
        main: 'Sede Principal',
        sub: 'Instalaciones modernas para tu desarrollo',
        defaultColor: '#ED5565',
    },
    {
        id: 1001,
        background: '/options/option-bg-2.jpg',
        icon: BookOpen,
        main: 'Campus Central',
        sub: 'Espacios de estudio y colaboración',
        defaultColor: '#FC6E51',
    },
    {
        id: 1002,
        background: '/options/option-bg-3.jpg',
        icon: Users,
        main: 'Intercambio',
        sub: 'Conoce estudiantes de todo el mundo',
        defaultColor: '#E7B834',
    },
    {
        id: 1003,
        background: '/options/option-bg-4.png',
        icon: Star,
        main: 'Comité Consultivo',
        sub: 'Líderes que guían nuestra visión',
        defaultColor: '#2ECC71',
    },
    {
        id: 1004,
        background: '/options/option-bg-5.webp',
        icon: Calendar,
        main: 'Vida Estudiantil',
        sub: 'Eventos y actividades de la comunidad',
        defaultColor: '#5D9CEC',
    },
];

export default function OptionsSelector({ accentColor = '#0066FF' }: OptionsSelectorProps) {
    const [activeOption, setActiveOption] = useState<number | string>(DEFAULT_OPTIONS[0].id);
    const [options, setOptions] = useState<OptionData[]>(DEFAULT_OPTIONS);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        let active = true;

        const fetchAnnouncements = async () => {
            const { data, error } = await supabase
                .from('announcements')
                .select('id, image_url, title, subtitle, link_url')
                .eq('is_active', true)
                .order('priority', { ascending: false });

            if (!active || error || !data?.length) return;

            const dynamicOptions: OptionData[] = data.map((announcement) => ({
                id: announcement.id,
                background: announcement.image_url,
                icon: Megaphone,
                main: announcement.title,
                sub: announcement.subtitle || 'Anuncio destacado',
                defaultColor: accentColor,
                link: announcement.link_url,
            }));

            setOptions([...dynamicOptions, ...DEFAULT_OPTIONS]);
            setActiveOption(dynamicOptions[0].id);
        };

        void fetchAnnouncements();
        return () => {
            active = false;
        };
    }, [accentColor]);

    useEffect(() => {
        if (options.length <= 1 || isPaused) return;

        const timer = window.setInterval(() => {
            setActiveOption((currentId) => {
                const currentIndex = options.findIndex((option) => option.id === currentId);
                return options[(currentIndex + 1) % options.length].id;
            });
        }, 6500);

        return () => window.clearInterval(timer);
    }, [isPaused, options]);

    const activeIndex = Math.max(0, options.findIndex((option) => option.id === activeOption));
    const selected = useMemo(
        () => options[activeIndex] || DEFAULT_OPTIONS[0],
        [activeIndex, options]
    );
    const ActiveIcon = selected.icon;
    const selectorVariables = {
        '--selector-accent': accentColor,
        '--option-color': selected.defaultColor,
    } as React.CSSProperties;

    return (
        <div
            className={styles.shell}
            style={selectorVariables}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onFocusCapture={() => setIsPaused(true)}
            onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false);
            }}
        >
            <article className={styles.feature} key={selected.id}>
                <img
                    src={selected.background}
                    alt=""
                    className={styles.featureImage}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                />
                <div className={styles.featureShade} aria-hidden="true" />

                <div className={styles.featureTopline}>
                    <span>CampusLink</span>
                    <span>{String(activeIndex + 1).padStart(2, '0')} / {String(options.length).padStart(2, '0')}</span>
                </div>

                <div className={styles.featureContent}>
                    <div className={styles.activeIcon} style={{ color: selected.defaultColor }}>
                        <ActiveIcon size={22} strokeWidth={2} />
                    </div>
                    <div className={styles.featureCopy}>
                        <p className={styles.featureLabel}>Destacado</p>
                        <h2>{selected.main}</h2>
                        <p>{selected.sub}</p>
                    </div>
                    {selected.link && (
                        <a
                            className={styles.featureLink}
                            href={selected.link}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Ver anuncio
                            <ArrowUpRight size={16} />
                        </a>
                    )}
                </div>
            </article>

            <nav className={styles.rail} aria-label="Seleccionar contenido destacado">
                <div className={styles.railHeader}>
                    <div>
                        <span className={styles.railEyebrow}>Descubre</span>
                        <h3>Vida en el campus</h3>
                    </div>
                    <span className={styles.railCount}>{options.length} historias</span>
                </div>

                <div className={styles.railItems}>
                    {options.map((option, index) => {
                        const OptionIcon = option.icon;
                        const isActive = option.id === selected.id;

                        return (
                            <button
                                type="button"
                                key={option.id}
                                className={`${styles.railItem} ${isActive ? styles.railItemActive : ''}`}
                                onClick={() => setActiveOption(option.id)}
                                aria-pressed={isActive}
                                aria-label={`Mostrar ${option.main}`}
                            >
                                <span className={styles.thumbnail}>
                                    <img src={option.background} alt="" loading="lazy" decoding="async" />
                                </span>
                                <span className={styles.railIcon} style={{ color: option.defaultColor }}>
                                    <OptionIcon size={16} strokeWidth={2.2} />
                                </span>
                                <span className={styles.railCopy}>
                                    <strong>{option.main}</strong>
                                    <small>{option.sub}</small>
                                </span>
                                <span className={styles.railIndex}>{String(index + 1).padStart(2, '0')}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
