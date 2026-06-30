'use client';

import React, { useState } from 'react';
import { Download, ChevronLeft, Video, Settings, Puzzle, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { uploadFileToR2, getSecureFileUrl } from '@/lib/r2-storage';
import Link from 'next/link';

export default function ExtensionPage() {
    const { colors } = useTheme();
    const { profile } = useProfile();
    const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
    
    const [uploadingZip, setUploadingZip] = useState(false);
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'zip' | 'mp4') => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isZip = type === 'zip';
        if (isZip) setUploadingZip(true);
        else setUploadingVideo(true);

        try {
            const path = isZip ? 'extension/campuslink-extension.zip' : 'extension/tutorial.mp4';
            // Utilizamos el bucket 'library' porque permite lectura pública
            await uploadFileToR2('library', path, file);
            
            setSuccessMessage(`¡${isZip ? 'Archivo ZIP' : 'Video tutorial'} subido correctamente!`);
            setTimeout(() => setSuccessMessage(''), 4000);
            
            // Forzar recarga de los elementos si es necesario (el navegador cachea la URL)
            if (isZip) {
                window.location.reload();
            }
        } catch (error: any) {
            alert(`Error al subir: ${error.message}`);
        } finally {
            if (isZip) setUploadingZip(false);
            else setUploadingVideo(false);
            e.target.value = ''; // reset input
        }
    };

    const zipUrl = getSecureFileUrl('library', 'extension/campuslink-extension.zip');
    const videoUrl = getSecureFileUrl('library', 'extension/tutorial.mp4');

    return (
        <div className="p-6 sm:p-8 max-w-4xl mx-auto">
            {/* Back Button & Header */}
            <div className="mb-8">
                <Link 
                    href="/dashboard/herramientas" 
                    className="inline-flex items-center gap-2 text-bb-text-secondary hover:text-white transition-colors mb-6 text-sm font-medium"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Volver a Herramientas
                </Link>
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-amber-500/20">
                        <Download className="w-8 h-8 text-amber-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-bb-text">Extensión de Blackboard</h1>
                        <p className="text-bb-text-secondary mt-1">Sincroniza y descarga tus archivos de forma automática.</p>
                    </div>
                </div>
            </div>

            {/* Panel de Administrador (Solo visible para admins) */}
            {isAdmin && (
                <div className="mb-8 p-6 bg-bb-hover border border-blue-500/30 rounded-2xl">
                    <div className="flex items-center gap-2 mb-4">
                        <Settings className="w-5 h-5 text-blue-400" />
                        <h2 className="text-lg font-bold text-white">Panel de Administración</h2>
                    </div>
                    <p className="text-sm text-bb-text-secondary mb-6">Sube o actualiza los archivos públicos de la extensión. Estos cambios se reflejarán instantáneamente para todos los usuarios.</p>
                    
                    {successMessage && (
                        <div className="mb-6 p-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-2 text-green-400 text-sm">
                            <CheckCircle2 className="w-4 h-4" />
                            {successMessage}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-4">
                        <label 
                            className="cursor-pointer px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 flex items-center gap-2"
                            style={{ backgroundColor: colors?.primary }}
                        >
                            {uploadingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {uploadingZip ? 'Subiendo ZIP...' : 'Subir Archivo ZIP'}
                            <input 
                                type="file" 
                                accept=".zip" 
                                className="hidden" 
                                onChange={(e) => handleUpload(e, 'zip')}
                                disabled={uploadingZip || uploadingVideo}
                            />
                        </label>

                        <label 
                            className="cursor-pointer px-4 py-2.5 rounded-xl font-semibold text-sm bg-zinc-800 text-white transition-all hover:bg-zinc-700 flex items-center gap-2"
                        >
                            {uploadingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                            {uploadingVideo ? 'Subiendo Video...' : 'Subir Video Tutorial (MP4)'}
                            <input 
                                type="file" 
                                accept="video/mp4,video/webm" 
                                className="hidden" 
                                onChange={(e) => handleUpload(e, 'mp4')}
                                disabled={uploadingZip || uploadingVideo}
                            />
                        </label>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Left Column: Video & Instructions */}
                <div className="md:col-span-2 space-y-6">
                    {/* Video Section */}
                    <div className="bg-bb-card border border-bb-border rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Video className="w-5 h-5 text-bb-text-secondary" />
                            <h2 className="text-xl font-bold text-bb-text">¿Cómo instalar y usar?</h2>
                        </div>
                        <div className="aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center mb-4 relative">
                            {/* Intentar cargar el video. Si falla silenciosamente (por ejemplo, aún no se subió), el navegador mostrará el reproductor vacío o con error. */}
                            <video 
                                controls 
                                className="w-full h-full object-cover" 
                                poster="" // Podrías poner una imagen por defecto
                                onError={(e) => {
                                    // Si no existe el video, podemos ocultar el tag
                                    (e.target as HTMLVideoElement).style.display = 'none';
                                }}
                            >
                                <source src={videoUrl} type="video/mp4" />
                                Tu navegador no soporta el formato de video.
                            </video>
                            
                            <div className="absolute inset-0 flex flex-col items-center justify-center -z-10 bg-zinc-900 text-center p-6">
                                <Video className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                                <p className="text-zinc-500 text-sm">El video tutorial estará disponible pronto.</p>
                            </div>
                        </div>
                        <p className="text-sm text-bb-text-secondary">
                            En este video te mostramos paso a paso cómo cargar la extensión en tu navegador y cómo sincronizar tus cursos con un solo clic.
                        </p>
                    </div>

                    {/* Step-by-step text */}
                    <div className="bg-bb-card border border-bb-border rounded-2xl p-6">
                        <h2 className="text-xl font-bold text-bb-text mb-6">Pasos de Instalación</h2>
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold shrink-0">1</div>
                                <div>
                                    <h3 className="text-bb-text font-semibold mb-1">Descarga el archivo</h3>
                                    <p className="text-bb-text-secondary text-sm">Descarga el archivo ZIP desde el botón de la derecha y extráelo en una carpeta de tu computadora.</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold shrink-0">2</div>
                                <div>
                                    <h3 className="text-bb-text font-semibold mb-1">Abre las extensiones de Chrome</h3>
                                    <p className="text-bb-text-secondary text-sm">Ve a <code className="bg-zinc-800 px-2 py-0.5 rounded text-amber-400">chrome://extensions/</code> o abre el menú de extensiones de tu navegador.</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold shrink-0">3</div>
                                <div>
                                    <h3 className="text-bb-text font-semibold mb-1">Activa el Modo Desarrollador</h3>
                                    <p className="text-bb-text-secondary text-sm">En la esquina superior derecha, activa el interruptor que dice "Modo de desarrollador".</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold shrink-0">4</div>
                                <div>
                                    <h3 className="text-bb-text font-semibold mb-1">Carga la extensión descomprimida</h3>
                                    <p className="text-bb-text-secondary text-sm">Haz clic en "Cargar descomprimida" y selecciona la carpeta que extraíste en el paso 1.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Download Card */}
                <div className="space-y-6">
                    <div className="bg-bb-card border border-bb-border rounded-2xl p-6 sticky top-6">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                            <Puzzle className="w-6 h-6 text-blue-400" />
                        </div>
                        <h3 className="text-lg font-bold text-bb-text mb-2">Descargar Archivos</h3>
                        <p className="text-sm text-bb-text-secondary mb-6">
                            Obtén la última versión de la extensión para tu navegador basado en Chromium (Google Chrome, Edge, Brave).
                        </p>
                        
                        <a 
                            href={zipUrl} 
                            target="_blank" // Abrir en nueva pestaña para iniciar descarga si es necesario
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg mb-4"
                            style={{ backgroundColor: colors?.primary }}
                        >
                            <Download className="w-4 h-4" />
                            Descargar ZIP
                        </a>

                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                            <div className="flex items-start gap-2">
                                <Settings className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-400/90 leading-relaxed">
                                    Nota: Recuerda que necesitas una PC para usar esta extensión. No funciona en dispositivos móviles.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
