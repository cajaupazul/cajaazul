'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const SLIDES = [
    {
        image: '/carrusel/FOTOGRAFIA-SELECCIONADA-2.jpg',
        title: 'TU ESPACIO ACADÉMICO',
        subtitle: 'CampusLink: Repositorio Colaborativo Estudiantil',
        date: 'ACTUALIZADO: CICLO 2024-I',
    },
    {
        image: '/carrusel/foto-4.webp',
        title: 'CONECTA CON TU COMUNIDAD',
        subtitle: 'Material compartido por y para estudiantes.',
        date: 'MÁS DE 1000 RECURSOS DISPONIBLES',
    },
    {
        image: '/carrusel/visiting-students.jpg',
        title: 'APOYO ACADÉMICO TOTAL',
        subtitle: 'Calificaciones de profesores y apuntes exclusivos.',
        date: 'REGÍSTRATE GRATIS HOY',
    },
];

const AUTO_PLAY_DURATION = 6000;

export default function HeroCarousel() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);

    const next = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % SLIDES.length);
    }, []);

    const prev = () => setCurrentIndex((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isPlaying) {
            timer = setInterval(() => {
                next();
            }, AUTO_PLAY_DURATION);
        }
        return () => clearInterval(timer);
    }, [isPlaying, next]);

    return (
        <div className="relative w-full h-[85vh] md:h-[90vh] overflow-hidden bg-[#002d5a]">
            {/* Background Images and Content Synchronized */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: 'easeInOut' }}
                    className="absolute inset-0"
                >
                    {/* Background Image */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#002d5a]/85 via-[#002d5a]/40 to-transparent z-10" />
                    <img
                        src={SLIDES[currentIndex].image}
                        alt="Carousel Background"
                        className="w-full h-full object-cover select-none"
                    />

                    {/* Content Overlay - Wrapped inside the same motion.div for perfect sync */}
                    <div className="absolute inset-0 z-20 flex items-center px-6 md:px-20 lg:px-32">
                        <div className="max-w-3xl space-y-6">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.1 }}
                                className="space-y-4"
                            >
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="h-[2px] w-12 bg-secondary" />
                                    <span className="text-on-primary font-label-lg tracking-widest uppercase opacity-90">
                                        {SLIDES[currentIndex].date}
                                    </span>
                                </div>
                                <h1 className="font-display-lg text-display-lg text-on-primary mb-6 leading-tight uppercase select-none">
                                    {SLIDES[currentIndex].title}
                                </h1>
                                <p className="font-body-lg text-body-lg text-surface-variant mb-10 max-w-lg select-none">
                                    {SLIDES[currentIndex].subtitle}
                                </p>

                                <div className="flex flex-col sm:flex-row items-center gap-6 mt-6">
                                    <Link href="/dashboard" className="group relative px-8 py-4 bg-secondary text-on-primary rounded-xl font-headline-md flex items-center gap-3 overflow-hidden transition-all hover:pr-10 hover:bg-opacity-90 shadow-xl w-full sm:w-auto justify-center">
                                        <span>Explorar Material</span>
                                        <ChevronRight className="transition-transform group-hover:translate-x-2" />
                                    </Link>
                                    <button 
                                        onClick={async () => {
                                            try {
                                                const { supabase } = await import('@/lib/supabase');
                                                await supabase.auth.signInAnonymously();
                                                window.location.href = '/dashboard';
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }}
                                        className="font-label-lg text-on-primary border-b border-on-primary/30 pb-1 hover:border-secondary transition-colors uppercase tracking-wider"
                                    >
                                        O CONTINUAR COMO INVITADO
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Controls Overlay */}
            <div className="absolute bottom-10 left-6 md:left-20 lg:left-32 z-30 flex items-center gap-6">
                <div className="flex items-center gap-4 bg-black/30 backdrop-blur-md p-2 rounded-full border border-white/10">
                    <button
                        onClick={prev}
                        className="p-2 text-white hover:text-blue-400 transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <div className="text-white font-black text-sm tracking-widest min-w-[50px] text-center select-none">
                        {currentIndex + 1} / {SLIDES.length}
                    </div>

                    <button
                        onClick={next}
                        className="p-2 text-white hover:text-blue-400 transition-colors"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>

                <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all border border-white/10 backdrop-blur-md"
                >
                    {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>

                {/* Progress Circle - Reset key ensures it starts fresh with slide change */}
                <div className="relative w-12 h-12 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90">
                        <circle
                            cx="24" cy="24" r="21"
                            fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.1"
                        />
                        {isPlaying && (
                            <motion.circle
                                key={currentIndex}
                                cx="24" cy="24" r="21"
                                fill="none" stroke="#3b82f6" strokeWidth="2.5"
                                strokeDasharray="131.94"
                                initial={{ strokeDashoffset: 131.94 }}
                                animate={{ strokeDashoffset: 0 }}
                                transition={{ duration: AUTO_PLAY_DURATION / 1000, ease: 'linear' }}
                            />
                        )}
                    </svg>
                </div>
            </div>
        </div>
    );
}
