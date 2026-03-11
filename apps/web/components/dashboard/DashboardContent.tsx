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
    Sparkles,
    Megaphone,
    PlusCircle
} from 'lucide-react';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import BouncingBalls from '@/components/BouncingBalls';
import { useTheme } from '@/lib/theme-context';
import { Profile, Course, getStorageUrl } from '@/lib/supabase';
import OptionsSelector from '@/components/OptionsSelector';
import AnnouncementPopup from '@/components/announcements/AnnouncementPopup';
import AnnouncementsManager from '@/components/admin/AnnouncementsManager';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DashboardContentProps {
    profile: Profile | null;
    courses: Course[];
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
    courses
}: DashboardContentProps) {
    const router = useRouter();
    const { colors } = useTheme();
    const [greeting] = useState(getGreeting());
    const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

    const isAdmin = profile?.role === 'admin';

    return (
        <div className="min-h-screen bg-bb-dark p-4 md:p-8 relative overflow-hidden transition-colors duration-300">
            <BouncingBalls />
            <AnnouncementPopup />

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
                                    <img src={getStorageUrl(profile.avatar_url)} alt="Faculty" className="w-4 h-4 object-contain" />
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
                        {isAdmin && (
                            <Button 
                                onClick={() => setIsAdminModalOpen(true)}
                                className="bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 px-4 py-2 rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                            >
                                <PlusCircle className="w-5 h-5" />
                                <span className="hidden sm:inline">Subir Banner</span>
                            </Button>
                        )}
                        {/* El bloque 'Nivel Estudiante' fue removido para un diseño más limpio */}
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="mb-0 relative z-20">
                    <OptionsSelector />
                </motion.div>

                {/* Admin Modal for Announcements */}
                <Dialog open={isAdminModalOpen} onOpenChange={setIsAdminModalOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-bb-dark border-bb-border text-bb-text p-0">
                        <div className="p-6">
                            <DialogHeader className="mb-6">
                                <DialogTitle className="text-2xl font-black flex items-center gap-2">
                                    <Megaphone className="text-blue-500" />
                                    Gestión de Anuncios y Carrusel
                                </DialogTitle>
                                <DialogDescription className="text-bb-text-secondary italic">
                                    Las imágenes subidas aquí aparecerán en el Popup y en las tarjetas del carrusel dinámico.
                                </DialogDescription>
                            </DialogHeader>
                            <AnnouncementsManager isAdminView={true} />
                        </div>
                    </DialogContent>
                </Dialog>
            </motion.div>
        </div>
    );
}
