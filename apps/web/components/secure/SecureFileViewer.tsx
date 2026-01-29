
import { useState, useEffect, useRef } from 'react';
import path from 'path';
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
import { supabase } from '@/lib/supabase';

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

    // Define accepted types for react-pdf file prop
    type PDFFile = string | File | {
        url: string;
        httpHeaders?: Record<string, string>;
        withCredentials?: boolean;
    };

    const [url, setUrl] = useState<PDFFile | null>(null);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [numPages, setNumPages] = useState<number>(0);
    const [scale, setScale] = useState(1.2);
    const [containerWidth, setContainerWidth] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [fileType, setFileType] = useState<'pdf' | 'image' | 'other'>('pdf');

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

    // Construct Proxy URL and Headers
    useEffect(() => {
        if (!filePath) return;
        setLoading(true);
        setError(null);

        // Determine file type
        const lowerPath = filePath.toLowerCase();
        let effectiveType = 'other';
        let isOfficeDoc = false;

        if (lowerPath.endsWith('.pdf')) {
            effectiveType = 'pdf';
        } else if (lowerPath.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
            effectiveType = 'image';
        } else if (lowerPath.match(/\.(doc|docx|ppt|pptx|xls|xlsx)$/)) {
            // For office docs, we will try to load the converted PDF
            effectiveType = 'pdf';
            isOfficeDoc = true;
        }

        setFileType(effectiveType as any);

        const fetchToken = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                setError('No hay sesión activa');
                setLoading(false);
                return;
            }

            let cleanPath = filePath;
            if (filePath.startsWith('http')) {
                const parts = filePath.split('/course_materials/');
                if (parts.length > 1) cleanPath = parts[1];
            }

            // If secure-url style
            if (filePath.includes('secure-url')) {
                const urlObj = new URL(filePath);
                cleanPath = urlObj.searchParams.get('path') || cleanPath;
            }
            cleanPath = decodeURIComponent(cleanPath);

            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
            let proxyUrl = `${baseUrl}/storage/secure-url?path=${encodeURIComponent(cleanPath)}&bucket=course-materials`;

            if (isOfficeDoc) {
                // Point to the converted file location
                // Convention: converted/ORIGINAL_FILENAME.pdf
                // The worker saves as: destinationKey = `converted/${r2Key.replace(originalExt, '.pdf')}`;
                const originalExt = path.extname(cleanPath);
                // Be careful with path inputs, ensure we strip existing "converted/" if passing around?
                // Assuming cleanPath is relative like "folder/file.pptx"
                const convertedPath = `converted/${cleanPath.replace(originalExt, '.pdf')}`;
                proxyUrl = `${baseUrl}/storage/secure-url?path=${encodeURIComponent(convertedPath)}&bucket=course-materials`;

                console.log('Requesting converted document:', convertedPath);
            }

            // For download/image src, we might need a direct URL if we can't inject headers effortlessly in <img>?
            // Actually <img> doesn't support headers easily.
            // But we can use a token in query param IF the worker supported it (it doesn't, it uses Auth header).
            // WORKAROUND for images: fetch blob and create object URL.
            if (effectiveType === 'image') {
                try {
                    const res = await fetch(proxyUrl, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!res.ok) throw new Error('Error cargando imagen');
                    const blob = await res.blob();
                    const objectUrl = URL.createObjectURL(blob);
                    setDownloadUrl(objectUrl); // Use this for <img> src
                } catch (err: any) {
                    console.error(err);
                    setError('Error cargando imagen');
                }
                setLoading(false);
                return;
            }

            // For others/PDF (including converted Office docs)
            const downloadLink = isOfficeDoc
                ? `${baseUrl}/storage/secure-url?path=${encodeURIComponent(cleanPath)}&bucket=course-materials` // Original for download
                : proxyUrl;

            setDownloadUrl(downloadLink); // Base URL for download (needs fetch with headers to actually download, or we assume browser can handle... wait browser can't handle headers in <a href>)
            // Actually, for "other" types, dragging/downloading is hard if we require Headers.
            // We might need to implement a "download" handler that fetches blob and saves it.

            // Prepare the file object for react-pdf
            setUrl({
                url: proxyUrl,
                httpHeaders: {
                    'Authorization': `Bearer ${token}`
                },
                withCredentials: true
            });

            if (effectiveType !== 'pdf') { // Should catch types that are definitely not viewable
                setLoading(false);
            }
        };

        fetchToken();
    }, [filePath]);

    const handleDownload = async () => {
        if (!downloadUrl) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const res = await fetch(downloadUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName; // Force download name
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (e) {
            console.error("Download failed", e);
            alert("Error al descargar el archivo");
        }
    }

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
                    {fileType === 'pdf' && (
                        <div className="hidden sm:flex items-center bg-black/50 border border-white/5 rounded-xl px-2 py-1 gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-white" onClick={() => handleZoom(-0.2)}><ZoomOut className="h-4 w-4" /></Button>
                            <span className="text-[10px] font-black text-zinc-400 min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-white" onClick={() => handleZoom(0.2)}><ZoomIn className="h-4 w-4" /></Button>
                        </div>
                    )}

                    <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-9 w-9 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all">
                        {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                    </Button>
                </div>
            </div>

            {/* Content Area */}
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

                {!loading && fileType === 'pdf' && (
                    <Document
                        file={url || undefined}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={null}
                        className="flex flex-col items-center gap-8 md:gap-12"
                        onContextMenu={(e) => e.preventDefault()}
                        error={
                            <div className="flex flex-col items-center justify-center p-10 text-center">
                                <AlertTriangle className="w-8 h-8 text-yellow-500 mb-3" />
                                <p className="text-white text-sm">No se pudo cargar el PDF. Puede que e archivo esté dañado.</p>
                            </div>
                        }
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
                                {/* Individual page protective overlay */}
                                <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
                            </div>
                        ))}
                    </Document>
                )}

                {!loading && fileType === 'image' && downloadUrl && (
                    <div className="relative shadow-2xl rounded-xl overflow-hidden">
                        <img src={downloadUrl} alt={fileName} className="max-w-full h-auto" />
                    </div>
                )}

                {!loading && fileType === 'other' && (
                    <div className="flex flex-col items-center justify-center py-20 text-center max-w-md">
                        <div className="w-20 h-20 bg-zinc-800 rounded-2xl flex items-center justify-center mb-6 border border-zinc-700">
                            <Lock className="w-10 h-10 text-zinc-500" />
                        </div>
                        <h3 className="text-white font-bold text-xl mb-2">Vista Previa No Disponible</h3>
                        <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
                            Este tipo de archivo ({fileName.split('.').pop()?.toUpperCase()}) no puede visualizarse de forma segura en el navegador. Por favor descárgalo para verlo.
                        </p>
                        <Button
                            onClick={handleDownload}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-6 rounded-xl hover:scale-105 transition-all shadow-lg shadow-blue-600/20"
                        >
                            Descargar Archivo Seguro
                        </Button>
                    </div>
                )}

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
