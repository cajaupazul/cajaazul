'use client';

import React, { useState } from 'react';
import { Megaphone, Plus, School } from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import { useTheme } from '@/lib/theme-context';
import { Profile, getStorageUrl } from '@/lib/supabase';
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
import styles from './DashboardContent.module.css';

interface DashboardContentProps {
    profile: Profile | null;
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
        transition: { staggerChildren: 0.08 }
    }
};

const itemVariants: Variants = {
    hidden: { y: 14, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
    }
};

export default function DashboardContent({ profile }: DashboardContentProps) {
    const { colors } = useTheme();
    const [greeting] = useState(getGreeting());
    const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

    const isAdmin = profile?.role === 'admin';
    const firstName = profile?.nombre?.trim().split(/\s+/)[0] || 'Estudiante';
    const facultyLogo = profile?.avatar_url?.includes('/logo/')
        ? getStorageUrl(profile.avatar_url)
        : null;
    const themeVariables = {
        '--dashboard-accent': colors.primary,
        '--dashboard-accent-dark': colors.dark,
        '--dashboard-accent-soft': colors.secondary,
    } as React.CSSProperties;

    return (
        <main className={styles.page} style={themeVariables}>
            <AnnouncementPopup />

            <motion.div
                className={styles.container}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                <motion.header variants={itemVariants} className={styles.header}>
                    <div className={styles.identity}>
                        <div className={styles.kicker}>
                            <span className={styles.kickerMark} aria-hidden="true" />
                            Tu espacio académico
                        </div>

                        <h1>
                            {greeting}, <span>{firstName}</span>
                        </h1>

                        <div className={styles.profileMeta}>
                            <div className={styles.facultyBadge}>
                                <span className={styles.facultyLogo} aria-hidden="true">
                                    {facultyLogo ? (
                                        <img src={facultyLogo} alt="" loading="lazy" decoding="async" />
                                    ) : (
                                        <School size={15} strokeWidth={2} />
                                    )}
                                </span>
                                <span>{profile?.carrera || 'Facultad por seleccionar'}</span>
                            </div>
                            <span className={styles.metaDivider} aria-hidden="true" />
                            <span className={styles.university}>{profile?.universidad || 'Universidad del Pacífico'}</span>
                        </div>
                    </div>

                    {isAdmin && (
                        <Button
                            onClick={() => setIsAdminModalOpen(true)}
                            className={styles.adminButton}
                        >
                            <Plus size={17} strokeWidth={2.4} />
                            Gestionar portada
                        </Button>
                    )}
                </motion.header>

                <motion.section variants={itemVariants} aria-label="Destacados del campus">
                    <OptionsSelector accentColor={colors.primary} />
                </motion.section>

                <Dialog open={isAdminModalOpen} onOpenChange={setIsAdminModalOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-bb-dark border-bb-border text-bb-text p-0">
                        <div className="p-6">
                            <DialogHeader className="mb-6">
                                <DialogTitle className="text-2xl font-black flex items-center gap-2">
                                    <Megaphone style={{ color: colors.primary }} />
                                    Gestión de anuncios y portada
                                </DialogTitle>
                                <DialogDescription className="text-bb-text-secondary">
                                    Administra las imágenes y mensajes destacados que verá la comunidad.
                                </DialogDescription>
                            </DialogHeader>
                            <AnnouncementsManager isAdminView />
                        </div>
                    </DialogContent>
                </Dialog>
            </motion.div>
        </main>
    );
}
