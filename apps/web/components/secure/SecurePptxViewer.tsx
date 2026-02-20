'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SecurePptxViewerProps {
    filePath: string; // Ruta relativa en el bucket (ej: "clases/tema1.pptx")
    bucket?: string;
    fileName?: string;
}

export default function SecurePptxViewer({ filePath, bucket = 'course-materials', fileName }: SecurePptxViewerProps) {
    const [iframeSrc, setIframeSrc] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const toggleFullscreen = () => {
        if (!containerRef.current) return;

        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    useEffect(() => {
        const generateSecureView = async () => {
            try {
                setLoading(true);
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) throw new Error("Sesión expirada");

                // 1. Llamar a Worker API para obtener la Signed URL de R2
                const apiUrl = process.env.NEXT_PUBLIC_API_URL;
                // Manejar path con query params si existen
                let cleanPath = filePath;
                if (filePath.includes('path=')) {
                    const urlObj = new URL(filePath, 'http://dummy.com');
                    cleanPath = urlObj.searchParams.get('path') || cleanPath;
                }
                const endpoint = `${apiUrl}/storage/preview-url?path=${encodeURIComponent(cleanPath)}&bucket=${bucket}`;

                const res = await fetch(endpoint, {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                });

                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(`Error API (${res.status}): ${errorText}`);
                }

                const data = await res.json();

                // recibir la URL pública del proxy (tokenizada)
                const streamUrl = data.url;

                // Construir la URL del Viewer de Microsoft
                // src debe estar encodeado
                const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(streamUrl)}`;

                setIframeSrc(viewerUrl);

            } catch (err: any) {
                console.error('[SecurePptxViewer] Error:', err);
                setError(err.message || "Error desconocido");
            } finally {
                setLoading(false);
            }
        };

        if (filePath) generateSecureView();
    }, [filePath, bucket]);

    if (loading) return (
        <div className="w-full h-[600px] bg-gray-50 flex flex-col items-center justify-center animate-pulse rounded-lg border border-gray-100">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
            <p className="text-gray-500 font-medium">Generando enlace seguro para {fileName || 'presentación'}...</p>
            <p className="text-xs text-gray-400 mt-2">Conectando con Microsoft Office Online</p>
        </div>
    );

    if (error) return (
        <div className="w-full h-[600px] bg-red-50 flex flex-col items-center justify-center rounded-lg border border-red-100 p-8 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
            <p className="text-red-700 font-medium text-lg">No se pudo cargar la presentación</p>
            <p className="text-red-500 text-sm mt-2 max-w-md">{error}</p>
            <p className="text-xs text-gray-500 mt-4">Verifica que tengas permisos y que las credenciales de R2 estén configuradas en el servidor.</p>
        </div>
    );

    return (
        <div
            ref={containerRef}
            className={`w-full ${isFullscreen ? 'h-screen' : 'h-[600px]'} bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200 relative group transition-all duration-300`}
            onContextMenu={(e) => { e.preventDefault(); return false; }}
        >
            <iframe
                ref={iframeRef}
                src={iframeSrc || ''}
                width="100%"
                height="100%"
                frameBorder="0"
                className="w-full h-full"
                title={`Presentación: ${fileName}`}
                onError={() => setError("Microsoft Viewer no pudo cargar el archivo (posible bloqueo de cross-origin o archivo corrupto)")}
                allowFullScreen
            />

            {/* ESCUDO DE CONTENIDO (Deja libre barra inferior de navegación pero bloquea la izquierda) */}
            {/* 1. Bloqueo superior y central para evitar clics derechos/interacciones */}
            <div
                className="absolute top-0 left-0 w-full h-[calc(100%-40px)] z-10 bg-transparent cursor-default"
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
            />

            {/* 2. Bloqueo agresivo del footer (Bloqueamos botones de los extremos) */}
            {/* Lado izquierdo: Bloquea el botón "Abrir en nueva pestaña" y el logo de PPT */}
            <div
                className="absolute bottom-0 left-0 w-[260px] h-12 z-[11] bg-transparent cursor-default"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            />
            {/* Lado derecho: Bloquea botones de opciones adicionales si aparecen */}
            <div
                className="absolute bottom-0 right-0 w-[120px] h-12 z-[11] bg-transparent cursor-default"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            />

            {/* Overlay indicators & Controls */}
            <div className="absolute top-4 right-4 z-20 flex gap-2">
                <button
                    onClick={toggleFullscreen}
                    className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm transition-all flex items-center justify-center border border-white/10"
                    title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                >
                    {isFullscreen ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 9L4 4m0 0l5 5m-5-5h5m-5 0v5m11 11l5 5m0 0l-5-5m5 5v-5m0 5h-5M4 15l5-5m-5 5v-5m0 5h5m11-11l-5 5m5-5h-5m5 0v5" /></svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    )}
                </button>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/75 text-white text-[10px] px-2 py-1 rounded-lg flex items-center border border-white/10 pointer-events-none self-center">
                    Vista Segura R2
                </div>
            </div>
        </div>
    );
}
