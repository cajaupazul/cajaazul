'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Loader2,
    Lock,
    AlertTriangle,
    Maximize2,
    Minimize2,
    ZoomIn,
    ZoomOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSecurity } from '@/lib/hooks/use-security';
import { pdfjs, Document, Page } from 'react-pdf';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface SecureFileViewerProps {
    filePath: string;
    fileName: string;
}

/**
 * Optimized Secure PDF Viewer
 * 
 * Features:
 * - Continuous Scroll (Native-like experience)
 * - Allows Left-Click and Scrolling
 * - Blocks Right-Click and Text Selection
 * - Proxy API to hide original URL
 * - Anti-screenshot blur on focus loss
 */
export default function SecureFileViewer({ filePath, fileName }: SecureFileViewerProps) {
    // 1. Activate Security Deterrent Layer
    useSecurity(true);

    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [numPages, setNumPages] = useState<number>(0);
    const [scale, setScale] = useState(1.2);
    const [containerWidth, setContainerWidth] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);

    // Responsive width detection
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                // Adjust for padding and scrollbar
                setContainerWidth(containerRef.current.clientWidth - 64);
            }
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    // Fetch Signed URL
    useEffect(() => {
        if (!filePath) return;
        setLoading(true);
        setError(null);

        let cleanPath = filePath;
        if (filePath.startsWith('http')) {
            const parts = filePath.split('/course_materials/');
            if (parts.length > 1) cleanPath = parts[1];
        }

        fetch('/api/files/secure-url', {
            method: 'POST',
            body: JSON.stringify({ filePath: cleanPath }),
        })
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Error al obtener URL segura');
                }
                return res.json();
            })
            .then(data => {
                // We use the proxy route for the source to be double sure
                setUrl(`/api/files/serve?path=${encodeURIComponent(cleanPath)}`);
            })
            .catch(err => {
                console.error(err);
                setError('No se pudo establecer conexión segura.');
                setLoading(false);
            });
    }, [filePath]);

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setLoading(false);
    };

    const toggleFullscreen = () => {
        const container = document.getElementById('secure-viewer-root');
        if (!container) return;
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => console.error(err));
            setIsFullscreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullscreen(false);
            }
        }
    };

    const handleZoom = (delta: number) => {
        setScale(prev => Math.max(0.6, Math.min(2.5, prev + delta)));
    };

    if (error) return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] p-10 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mb-6" />
            <h3 className="text-white font-black text-xl mb-4 tracking-tight uppercase">{error}</h3>
            <Button variant="outline" className="text-white" onClick={() => window.location.reload()}>REINTENTAR</Button>
        </div>
    );

    return (
        <div
            id="secure-viewer-root"
            className={`flex flex-col w-full bg-[#0a0a0a] overflow-hidden relative select-none ${isFullscreen ? 'h-screen' : 'h-full rounded-none sm:rounded-3xl border border-white/5 shadow-[0_0_100px_rgba(0,0,0,0.8)]'}`}
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* Ultra-Premium Glass Header */}
            <div className="bg-[#121212]/90 backdrop-blur-3xl p-4 flex items-center justify-between border-b border-white/5 shrink-0 gap-4 pr-16 z-[100]">
                <div className="flex items-center gap-4 overflow-hidden flex-1">
                    <div className="bg-blue-600 p-2.5 rounded-2xl shrink-0">
                        <Lock className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-white font-black text-xs md:text-sm truncate uppercase tracking-tight">{fileName}</h3>
                        <p className="text-[8px] text-blue-400 font-black uppercase tracking-widest mt-0.5">SISTEMA DE PROTECCIÓN ACTIVO</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                    <div className="hidden sm:flex items-center bg-black/50 border border-white/5 rounded-xl px-2 py-1 gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-white" onClick={() => handleZoom(-0.2)}><ZoomOut className="h-4 w-4" /></Button>
                        <span className="text-[10px] font-black text-zinc-400 min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-white" onClick={() => handleZoom(0.2)}><ZoomIn className="h-4 w-4" /></Button>
                    </div>

                    <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-9 w-9 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all">
                        {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                    </Button>
                </div>
            </div>

            {/* Continuous Scroll Content Area */}
            <div
                ref={containerRef}
                className="flex-1 relative w-full overflow-y-auto bg-[#1a1a1a] flex flex-col items-center p-4 md:p-12 scroll-smooth scrollbar-thin scrollbar-thumb-zinc-800"
            >
                {loading && (
                    <div className="flex flex-col items-center justify-center p-20">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Cargando Documento...</p>
                    </div>
                )}

                <Document
                    file={url}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={null}
                    className="flex flex-col items-center gap-8 md:gap-12"
                    onContextMenu={(e) => e.preventDefault()}
                >
                    {Array.from(new Array(numPages), (el, index) => (
                        <div key={`page_${index + 1}`} className="relative shadow-[0_20px_60px_rgba(0,0,0,0.6)] rounded-sm overflow-hidden bg-white">
                            <Page
                                pageNumber={index + 1}
                                scale={scale}
                                width={containerWidth > 0 ? Math.min(containerWidth, 1200) : undefined}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                className="max-w-full h-auto"
                                loading={
                                    <div className="w-full h-[600px] flex items-center justify-center bg-zinc-900/50">
                                        <Loader2 className="w-6 h-6 text-zinc-700 animate-spin" />
                                    </div>
                                }
                            />
                            {/* Individual page protective overlay (blocks selection but allows events to bubble for scroll) */}
                            <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
                        </div>
                    ))}
                </Document>

                {/* Global Protection Overlay (Passive) */}
                <div
                    className="fixed inset-0 z-[1000] pointer-events-none select-none"
                    onContextMenu={(e) => e.preventDefault()}
                />
            </div>

            {/* Security Footer */}
            <div className="bg-[#121212]/95 border-t border-white/5 p-3 text-center z-[100]">
                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-2">
                    <span className="w-1 h-1 bg-red-600 rounded-full shadow-[0_0_8px_rgba(220,38,38,1)] animate-pulse" />
                    Lectura Protegida • CampusLink Security v2.5
                </p>
            </div>

            <style jsx global>{`
                .react-pdf__Page__canvas {
                    margin: 0 auto;
                    max-width: 100% !important;
                    height: auto !important;
                }
                .scrollbar-thin::-webkit-scrollbar {
                    width: 6px;
                }
                .scrollbar-thin::-webkit-scrollbar-track {
                    background: transparent;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb {
                    background: #333;
                    border-radius: 10px;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb:hover {
                    background: #444;
                }
            `}</style>
        </div>
    );
}
