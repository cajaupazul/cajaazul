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
    const iframeRef = useRef<HTMLIFrameElement>(null);

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

                console.log('[SecurePptxViewer] Solicitando URL firmada:', endpoint);

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
                console.log('[SecurePptxViewer] Stream URL Recibida:', streamUrl);

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
            className="w-full h-[600px] bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200 relative group"
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

            {/* ESCUDO INTEGRAL (Full Shield) */}
            {/* Cubre TODO el iframe para interceptar el click derecho (Context Menu) */}
            {/* Al hacer click izquierdo, intentamos pasar el foco al iframe para permitir navegación por teclado */}
            <div
                className="absolute inset-0 z-10 bg-transparent cursor-default"
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }}
                onClick={() => {
                    // Intentar dar foco al iframe para que funcionen las flechas del teclado
                    if (iframeRef.current) {
                        iframeRef.current.focus();
                    }
                }}
            />

            <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-black/75 text-white text-[10px] px-2 py-1 rounded pointer-events-none">
                Vista Segura R2
            </div>
        </div>
    );
}
