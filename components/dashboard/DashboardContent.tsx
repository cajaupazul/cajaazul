'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    BookOpen,
    Users,
    TrendingUp,
    Award,
    Calendar,
    Zap,
    ArrowRight,
    Sparkles
} from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import Link from 'next/link';
import BouncingBalls from '@/components/BouncingBalls';
import { useTheme } from '@/lib/theme-context';
import { Profile, Course } from '@/lib/supabase';
import OptionsSelector from '@/components/OptionsSelector';

interface DashboardContentProps {
    profile: Profile | null;
    courses: Course[];
    materialsCount: number;
    communityCount: number;
    motivational: string;
}

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
};

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { type: 'spring', stiffness: 100 }
    }
};

export default function DashboardContent({
    profile,
    courses,
    materialsCount,
    communityCount,
    motivational
}: DashboardContentProps) {
    const router = useRouter();
    const { colors } = useTheme();
    const [greeting] = useState(getGreeting());

    return (
        <div className="min-h-screen bg-bb-dark p-4 md:p-8 relative overflow-hidden transition-colors duration-300">
            <BouncingBalls />

            <motion.div
                className="max-w-7xl mx-auto relative z-10"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-6 md:h-8 w-1 bg-blue-500 rounded-full" />
                            <h1 className="text-2xl md:text-4xl font-black text-bb-text tracking-tight leading-tight">
                                {greeting}, <span className="text-blue-400">{profile?.nombre.split(' ')[0] || 'Estudiante'}</span>.
                            </h1>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-bb-text-secondary px-3 md:px-4">
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-bb-card border border-bb-border">
                                {profile?.avatar_url && (profile.avatar_url.includes('/logo/') || profile.avatar_url.includes('fce.png')) && (
                                    <img src={profile.avatar_url} alt="Faculty" className="w-4 h-4 object-contain" />
                                )}
                                <span className="text-[10px] md:text-xs font-semibold">
                                    {profile?.carrera || 'Facultad'}
                                </span>
                            </div>
                            <span className="hidden md:inline text-xs">•</span>
                            <span className="text-[10px] md:text-xs">{profile?.universidad || 'Universidad Privada'}</span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="bg-bb-card rounded-2xl p-2 flex items-center gap-3 pr-4 border border-bb-border">
                            <div className="bg-yellow-500/20 p-2 rounded-xl">
                                <Zap className="w-5 h-5 text-yellow-400" />
                            </div>
                            <div>
                                <p className="text-xs text-bb-text-secondary font-medium">Nivel Estudiante</p>
                                <p className="text-bb-text font-bold leading-none">Novato</p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="mb-8 relative z-20">
                    <OptionsSelector />
                </motion.div>

                <motion.div
                    variants={itemVariants}
                    className="bg-bb-card rounded-3xl p-6 md:p-8 mb-8 md:mb-10 border border-bb-border"
                >
                    <div className="flex items-start gap-4 md:gap-6">
                        <div className="bg-yellow-500/20 p-3 md:p-4 rounded-2xl flex-shrink-0">
                            <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-yellow-400" />
                        </div>
                        <div>
                            <h3 className="text-bb-text-secondary font-bold text-[10px] md:text-sm tracking-widest uppercase mb-1">Tu Dosis Diaria</h3>
                            <p className="text-lg md:text-3xl font-bold text-bb-text italic leading-tight">
                                "{motivational}"
                            </p>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    variants={itemVariants}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
                >
                    {[
                        {
                            title: 'Tus Puntos',
                            value: profile?.puntos || 0,
                            sub: 'Nivel Estudiante',
                            icon: Award,
                            color: 'blue',
                            badge: 'Top 10%'
                        },
                        {
                            title: 'Materiales',
                            value: materialsCount,
                            sub: 'Subidos',
                            icon: BookOpen,
                            color: 'teal'
                        },
                        {
                            title: 'Interacciones',
                            value: 0,
                            sub: 'Esta semana',
                            icon: TrendingUp,
                            color: 'green'
                        },
                        {
                            title: 'Comunidad',
                            value: communityCount,
                            sub: 'Miembros activos',
                            icon: Users,
                            color: 'purple'
                        }
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            whileHover={{ y: -3 }}
                            className="bg-bb-card rounded-2xl p-4 md:p-6 border border-bb-border"
                        >
                            <div className="flex justify-between items-start mb-3 md:mb-4">
                                <div className={`p-2.5 md:p-3 rounded-xl bg-${stat.color}-500/10 text-${stat.color}-400`}>
                                    <stat.icon className="h-5 w-5 md:h-6 md:w-6" />
                                </div>
                                {stat.badge && (
                                    <span className={`px-2 py-1 rounded-lg bg-${stat.color}-500/10 text-${stat.color}-400 text-[9px] md:text-[10px] font-bold border border-${stat.color}-500/20 uppercase tracking-wide`}>
                                        {stat.badge}
                                    </span>
                                )}
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-2xl md:text-4xl font-black text-bb-text mb-1 tracking-tight">{stat.value.toLocaleString()}</h3>
                                <p className="text-xs md:text-sm text-bb-text-secondary font-medium">{stat.title}</p>
                                <p className="text-[10px] md:text-xs text-bb-text-secondary/70 mt-1">{stat.sub}</p>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>


            </motion.div>
        </div>
    );
}
