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
    Clock,
    Sparkles,
    Gamepad2
} from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import Link from 'next/link';
import BouncingBalls from '@/components/BouncingBalls';
import { useTheme } from '@/lib/theme-context';
import { Profile, Course } from '@/lib/supabase';

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
        <div className="min-h-screen bg-bb-dark p-8 relative overflow-hidden transition-colors duration-300">
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
                            <div className="h-8 w-1 bg-blue-500 rounded-full" />
                            <h1 className="text-4xl font-black text-bb-text tracking-tight">
                                {greeting}, <span className="text-blue-400">{profile?.nombre.split(' ')[0] || 'Estudiante'}</span>.
                            </h1>
                        </div>
                        <div className="flex items-center gap-2 text-bb-text-secondary px-4">
                            <span className="px-3 py-1 rounded-full bg-bb-card text-xs font-semibold border border-bb-border">
                                {profile?.carrera || 'General'}
                            </span>
                            <span className="text-xs">•</span>
                            <span className="text-xs">{profile?.universidad || 'Universidad Privada'}</span>
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

                <motion.div
                    variants={itemVariants}
                    className="bg-bb-card rounded-3xl p-8 mb-10 border border-bb-border"
                >
                    <div className="flex items-start gap-6">
                        <div className="bg-yellow-500/20 p-4 rounded-2xl">
                            <Sparkles className="w-8 h-8 text-yellow-400" />
                        </div>
                        <div>
                            <h3 className="text-bb-text-secondary font-bold text-sm tracking-widest uppercase mb-1">Tu Dosis Diaria</h3>
                            <p className="text-2xl md:text-3xl font-bold text-bb-text italic leading-tight">
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
                            className="bg-bb-card rounded-2xl p-6 border border-bb-border"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-xl bg-${stat.color}-500/10 text-${stat.color}-400`}>
                                    <stat.icon className="h-6 w-6" />
                                </div>
                                {stat.badge && (
                                    <span className={`px-2 py-1 rounded-lg bg-${stat.color}-500/10 text-${stat.color}-400 text-[10px] font-bold border border-${stat.color}-500/20 uppercase tracking-wide`}>
                                        {stat.badge}
                                    </span>
                                )}
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-4xl font-black text-bb-text mb-1 tracking-tight">{stat.value.toLocaleString()}</h3>
                                <p className="text-sm text-bb-text-secondary font-medium">{stat.title}</p>
                                <p className="text-xs text-bb-text-secondary/70 mt-1">{stat.sub}</p>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <motion.div variants={itemVariants}>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-bb-text flex items-center gap-2">
                                    <Calendar className="w-6 h-6 text-blue-400" />
                                    Continuar Aprendiendo
                                </h2>
                                <Link href="/dashboard/courses" className="text-sm font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                                    Ver todo <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>

                            <div className="grid gap-4">
                                {courses.map((course, i) => (
                                    <motion.div
                                        key={course.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="group glass-card p-4 rounded-2xl hover:border-blue-500/30 transition-all cursor-pointer flex items-center justify-between"
                                        onClick={() => router.push(`/dashboard/courses/${course.id}`)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-blue-400 font-bold border border-bb-border group-hover:scale-110 transition-transform">
                                                {course.codigo || 'C'}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-bb-text group-hover:text-blue-400 transition-colors">{course.nombre}</h3>
                                                <p className="text-xs text-bb-text-secondary">Ciclo {course.ciclo} • {course.facultad}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div className="hidden md:block w-32">
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-bb-text-secondary">Progreso</span>
                                                    <span className="text-bb-text font-bold">75%</span>
                                                </div>
                                                <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full w-3/4" />
                                                </div>
                                            </div>
                                            <div className="bg-bb-card p-2 rounded-lg text-bb-text-secondary group-hover:text-white group-hover:bg-blue-500 transition-all">
                                                <ArrowRight className="w-5 h-5" />
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </div>

                    <motion.div variants={itemVariants} className="space-y-6">
                        <div className="glass-card rounded-3xl p-6 shadow-xl">
                            <h3 className="text-lg font-bold text-bb-text mb-4 flex items-center gap-2">
                                <Zap className="w-5 h-5 text-yellow-400" /> Acciones Rápidas
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Subir Material', href: '/dashboard/courses', icon: BookOpen, color: 'blue' },
                                    { label: 'Ver Horario', href: '/dashboard', icon: Clock, color: 'purple' },
                                    { label: 'Grupos', href: '/dashboard/grupos', icon: Users, color: 'teal' },
                                    { label: 'Eventos', href: '/dashboard/events', icon: Calendar, color: 'pink' },
                                ].map((action, i) => (
                                    <Link
                                        key={i}
                                        href={action.href}
                                        className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-bb-card hover:bg-blue-500/10 border border-bb-border hover:border-blue-500/30 transition-all group`}
                                    >
                                        <action.icon className={`w-6 h-6 text-bb-text-secondary group-hover:text-blue-400 transition-colors`} />
                                        <span className="text-xs font-semibold text-bb-text-secondary group-hover:text-bb-text text-center leading-tight">{action.label}</span>
                                    </Link>
                                ))}
                            </div>

                            <div className="mt-4 pt-4 border-t border-bb-border">
                                <Link href="/dashboard/events" className="block">
                                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-4 group cursor-pointer">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider mb-1">Juego Destacado</p>
                                                <h4 className="font-bold text-white">Pixel Art Live</h4>
                                            </div>
                                            <div className="bg-white/20 p-2 rounded-xl group-hover:rotate-12 transition-transform">
                                                <Gamepad2 className="w-5 h-5 text-white" />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
}
