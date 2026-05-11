'use client';

import React, { useState } from 'react';
import { CalendarDays, Upload, ArrowRight, Trash2, AlertTriangle, FileText, Wrench, Download } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import UploadOfertaModal from '@/components/herramientas/upload-oferta-modal';

export default function HerramientasPage() {
    const { colors } = useTheme();
    const { profile } = useProfile();
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [clearing, setClearing] = useState(false);
    const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

    const handleClearAll = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!confirm('¿Estás SEGURO de que quieres BORRAR TODA LA BASE DE DATOS de horarios? (Cursos, Secciones y Bloques). Esta acción es irreversible.')) {
            return;
        }

        setClearing(true);
        try {
            // Delete all sections (cascades to blocks)
            const { error: sErr } = await supabase.from('sche_sections').delete().neq('id', 'dummy');
            // Delete all courses
            const { error: cErr } = await supabase.from('sche_courses').delete().neq('id', 'dummy');

            if (sErr || cErr) throw sErr || cErr;
            alert('Base de datos de horarios limpiada con éxito.');
        } catch (err: any) {
            console.error('[CLEANUP] Error:', err);
            alert('Error al limpiar: ' + err.message);
        } finally {
            setClearing(false);
        }
    };

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
                            className="flex items-center justify-between"
                        >
                            <div
                                className="flex items-center gap-1.5 text-sm font-semibold transition-all group-hover:gap-2.5"
                                style={{ color: colors?.primary }}
                            >
                                Comenzar <ArrowRight className="w-4 h-4" />
                            </div>

                            {isAdmin && (
                                <button
                                    onClick={handleClearAll}
                                    disabled={clearing}
                                    className="p-2 rounded-lg hover:bg-red-500/10 text-bb-text-secondary hover:text-red-400 transition-colors relative z-20"
                                    title="Limpiar toda la base de datos"
                                >
                                    {clearing ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent animate-spin rounded-full" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                            )}
                        </div>
                    </div>
                </Link>

                {/* Flowchart tool Card */}
                <Link
                    href="/dashboard/herramientas/flujogramas"
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
                            style={{ backgroundColor: '#10b98120' }}
                        >
                            <FileText className="w-7 h-7 text-emerald-500" />
                        </div>

                        <h3 className="text-lg font-bold text-bb-text mb-2 group-hover:text-white transition-colors">
                            Flujogramas Interactivos
                        </h3>
                        <p className="text-bb-text-secondary text-sm leading-relaxed mb-4">
                            Lleva el control de tu carrera de forma visual. Marca tus cursos aprobados y planifica tu próximo ciclo sobre el flujograma oficial.
                        </p>

                        <div className="flex items-center justify-between">
                            <div
                                className="flex items-center gap-1.5 text-sm font-semibold transition-all group-hover:gap-2.5 text-emerald-500"
                            >
                                Abrir <ArrowRight className="w-4 h-4" />
                            </div>

                            {isAdmin && (
                                <Link href="/admin/flowcharts" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        className="p-2 rounded-lg hover:bg-zinc-800 text-bb-text-secondary hover:text-white transition-colors relative z-20"
                                        title="Gestionar flujogramas"
                                    >
                                        <Wrench className="w-4 h-4" />
                                    </button>
                                </Link>
                            )}
                        </div>
                    </div>
                </Link>

                {/* Downloader Extension Card */}
                <div
                    className="group relative bg-bb-card border border-bb-border rounded-2xl p-6 opacity-80 transition-all duration-300 overflow-hidden grayscale hover:grayscale-0"
                >
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"
                                style={{ backgroundColor: '#f59e0b20' }}
                            >
                                <Download className="w-7 h-7 text-amber-500" />
                            </div>
                            <div className="flex flex-col gap-1 items-end">
                                <span className="px-2 py-1 rounded-md bg-amber-500/10 text-[9px] font-black text-amber-500 border border-amber-500/20 uppercase tracking-widest">
                                    Próximamente
                                </span>
                                <span className="px-2 py-1 rounded-md bg-blue-500/10 text-[9px] font-black text-blue-400 border border-blue-500/20 uppercase tracking-widest">
                                    Solo para PC
                                </span>
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-bb-text mb-2 group-hover:text-white transition-colors">
                            Extensión de Descarga
                        </h3>
                        <p className="text-bb-text-secondary text-sm leading-relaxed mb-4">
                            Descarga todo el contenido de tus cursos de Blackboard de forma instantánea. Olvida las descargas manuales, un clic y listo.
                        </p>

                        <div className="flex items-center gap-1.5 text-sm font-semibold text-bb-text-secondary opacity-50 cursor-not-allowed">
                            Instalar Extensión <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>
                </div>
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
