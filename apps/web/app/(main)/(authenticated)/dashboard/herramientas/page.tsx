'use client';

import React, { useState } from 'react';
import { CalendarDays, Upload, ArrowRight } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import Link from 'next/link';
import UploadOfertaModal from '@/components/herramientas/upload-oferta-modal';

export default function HerramientasPage() {
    const { colors } = useTheme();
    const { profile } = useProfile();
    const [showUploadModal, setShowUploadModal] = useState(false);
    const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

    return (
        <div className="p-6 sm:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-bb-text">Herramientas</h1>
                    <p className="text-bb-text-secondary mt-1">Recursos y herramientas útiles para tu vida universitaria</p>
                </div>

                {isAdmin && (
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                        style={{ backgroundColor: colors?.primary }}
                    >
                        <Upload className="w-4 h-4" />
                        Subir Oferta Académica
                    </button>
                )}
            </div>

            {/* Tools Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Schedule Builder Card */}
                <Link
                    href="/dashboard/herramientas/horarios"
                    className="group relative bg-bb-card border border-bb-border rounded-2xl p-6 hover:border-opacity-60 transition-all duration-300 overflow-hidden"
                    style={{ textDecoration: 'none' }}
                >
                    {/* Glow effect */}
                    <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                        style={{
                            background: `radial-gradient(circle at 30% 30%, ${colors?.primary}10, transparent 70%)`,
                        }}
                    />

                    <div className="relative z-10">
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                            style={{ backgroundColor: colors?.primary + '20' }}
                        >
                            <CalendarDays className="w-7 h-7" style={{ color: colors?.primary }} />
                        </div>

                        <h3 className="text-lg font-bold text-bb-text mb-2 group-hover:text-white transition-colors">
                            Armador de Horarios
                        </h3>
                        <p className="text-bb-text-secondary text-sm leading-relaxed mb-4">
                            Arma tu horario universitario de forma visual. Selecciona tus cursos, elige secciones y organiza tu semana perfecta.
                        </p>

                        <div
                            className="flex items-center gap-1.5 text-sm font-semibold transition-all group-hover:gap-2.5"
                            style={{ color: colors?.primary }}
                        >
                            Comenzar <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>
                </Link>
            </div>

            {/* Upload Modal */}
            <UploadOfertaModal
                open={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                onSuccess={() => setShowUploadModal(false)}
            />
        </div>
    );
}
