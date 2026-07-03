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
        <div className="relative w-full h-[75vh] sm:h-[85vh] md:h-[90vh] overflow-hidden bg-[#002d5a]">
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
                    <div className="absolute inset-0 bg-gradient-to-r from-[#002d5a]/90 via-[#002d5a]/45 to-transparent z-10" />
                    <img
                        src={SLIDES[currentIndex].image}
                        alt="Carousel Background"
                        className="w-full h-full object-cover select-none"
                    />

                    {/* Content Overlay - Wrapped inside the same motion.div for perfect sync */}
                    <div className="absolute inset-0 z-20 flex items-center px-4 sm:px-12 md:px-20 lg:px-32 pt-12 sm:pt-0">
                        <div className="max-w-3xl w-full">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.1 }}
                                className="space-y-3 sm:space-y-4"
                            >
                                <div className="flex items-center gap-2 sm:gap-4 mb-2 sm:mb-4">
                                    <div className="h-[2px] w-6 sm:w-12 bg-secondary" />
                                    <span className="text-on-primary text-[10px] sm:text-xs tracking-widest uppercase opacity-90 font-medium">
                                        {SLIDES[currentIndex].date}
                                    </span>
                                </div>
                                <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-display-lg text-on-primary mb-2 sm:mb-4 leading-tight uppercase font-extrabold select-none">
                                    {SLIDES[currentIndex].title}
                                </h1>
                                <p className="text-xs sm:text-sm md:text-base lg:text-body-lg text-surface-variant mb-4 sm:mb-8 max-w-md sm:max-w-lg select-none">
                                    {SLIDES[currentIndex].subtitle}
                                </p>

                                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mt-4 sm:mt-6">
                                    <Link href="/dashboard" className="group relative px-6 py-3 sm:px-8 sm:py-4 bg-secondary text-on-primary rounded-none font-semibold text-sm sm:text-base flex items-center gap-2 overflow-hidden transition-all hover:pr-10 hover:bg-opacity-90 shadow-xl w-full sm:w-auto justify-center">
                                        <span>Explorar Material</span>
                                        <ChevronRight size={18} className="transition-transform group-hover:translate-x-2" />
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
                                        className="text-[11px] sm:text-xs md:text-sm font-semibold text-on-primary border-b border-on-primary/30 pb-1 hover:border-secondary transition-colors uppercase tracking-wider w-full sm:w-auto text-center sm:text-left py-2 sm:py-0"
                                    >
                                        ENTRAR COMO INVITADO
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Controls Overlay */}
            <div className="absolute bottom-6 left-4 sm:bottom-10 sm:left-20 lg:left-32 z-30 flex items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-2 sm:gap-4 bg-black/35 backdrop-blur-md p-1.5 sm:p-2 rounded-none border border-white/10">
                    <button
                        onClick={prev}
                        className="p-1.5 sm:p-2 text-white hover:text-blue-400 transition-colors"
                    >
                        <ChevronLeft size={16} className="sm:w-5 sm:h-5" />
                    </button>

                    <div className="text-white font-bold text-xs sm:text-sm tracking-widest min-w-[40px] sm:min-w-[50px] text-center select-none">
                        {currentIndex + 1} / {SLIDES.length}
                    </div>

                    <button
                        onClick={next}
                        className="p-1.5 sm:p-2 text-white hover:text-blue-400 transition-colors"
                    >
                        <ChevronRight size={16} className="sm:w-5 sm:h-5" />
                    </button>
                </div>

                <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 text-white rounded-none transition-all border border-white/10 backdrop-blur-md"
                >
                    {isPlaying ? <Pause size={14} className="sm:w-[18px] sm:h-[18px]" fill="currentColor" /> : <Play size={14} className="sm:w-[18px] sm:h-[18px]" fill="currentColor" />}
                </button>

                {/* Progress Circle - Reset key ensures it starts fresh with slide change */}
                <div className="relative w-12 h-12 hidden sm:flex items-center justify-center">
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
