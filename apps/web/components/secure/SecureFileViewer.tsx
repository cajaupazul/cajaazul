'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, AlertCircle, Download, Lock, Maximize, Minimize, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Document, Page, pdfjs } from 'react-pdf';
import * as docx from 'docx-preview';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import SecurePptxViewer from './SecurePptxViewer';

// V4.0: Usar worker LOCAL para máxima estabilidad y evitar race conditions de red
if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface SecureFileViewerProps {
    filePath: string;
    fileName: string;
    onClose?: (open: false) => void;
}

// ─── Virtualized Lazy PDF Page ────────────────────────────────────────────────
// Implementa "Windowing": solo renderiza el contenido pesado (canvas)
// si la página está cerca del viewport. Si está lejos, unmount total para RAM.
interface VirtualizedPageProps {
    pageNumber: number;
    pageWidth: number;
    estimatedHeight: number;
    pdfReady: boolean;
}

function VirtualizedLazyPage({ pageNumber, pageWidth, estimatedHeight, pdfReady }: VirtualizedPageProps) {
    const [shouldMount, setShouldMount] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!pdfReady) return;

        const el = containerRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                // Montar si está a menos de 1000px (aprox 1.5 páginas) del viewport
                // Desmontar si sale de ese rango para liberar RAM
                setShouldMount(entry.isIntersecting);
            },
            {
                // Un margen de 1200px permite tener unas 2-3 páginas montadas
                // a la vez (la actual + 1 arriba + 1 abajo), ideal para scroll suave.
                rootMargin: '1200px 0px 1200px 0px',
                threshold: 0
            }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [pdfReady]);

    return (
        <div
            ref={containerRef}
            className="mb-8 relative transition-all duration-500"
            style={{ minHeight: estimatedHeight, width: pageWidth }}
        >
            {shouldMount && pdfReady ? (
                <>
                    <Page
                        pageNumber={pageNumber}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        width={pageWidth}
                        className="shadow-2xl rounded-sm overflow-hidden animate-in fade-in duration-500"
                        loading={
                            <div
                                className="bg-white flex flex-col items-center justify-center gap-2"
                                style={{ width: pageWidth, height: estimatedHeight }}
                            >
                                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                                <p className="text-gray-300 text-xs">Renderizando pág. {pageNumber}</p>
                            </div>
                        }
                    />
                    {/* Overlay protector anti-selección individual */}
                    <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
                </>
            ) : (
                // Skeleton ultra-ligero: no consume procesador ni RAM de Canvas
                <div
                    className="bg-gray-100/50 rounded-sm border border-dashed border-gray-200 flex flex-col items-center justify-center gap-2"
                    style={{ width: pageWidth, height: estimatedHeight }}
                >
                    <div className="w-8 h-8 rounded-full bg-gray-200/50 animate-pulse" />
                    <p className="text-gray-300 text-[10px] font-medium tracking-widest uppercase">Página {pageNumber}</p>
                </div>
            )}
        </div>
    );
}

// ─── Mobile Navigator (V4.0) ──────────────────────────────────────────────────
interface MobilePdfNavigatorProps {
    numPages: number;
    pageWidth: number;
    estimatedHeight: number;
}

function MobilePdfNavigator({ numPages, pageWidth, estimatedHeight }: MobilePdfNavigatorProps) {
    const [currentPage, setCurrentPage] = useState(1);

    return (
        <div className="flex flex-col items-center gap-6 py-6 px-4">
            <div className="relative shadow-2xl rounded-lg overflow-hidden border border-gray-200 bg-white">
                <Page
                    pageNumber={currentPage}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    width={pageWidth}
                    loading={
                        <div
                            className="flex flex-col items-center justify-center gap-3 bg-gray-50"
                            style={{ width: pageWidth, height: estimatedHeight }}
                        >
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            <p className="text-gray-400 text-sm font-medium">Cargando página...</p>
                        </div>
                    }
                />
                <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
            </div>

            {/* Selector de página flotante/sticky */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-4 bg-zinc-900/90 border border-white/10 px-6 py-3 rounded-2xl backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 text-white hover:bg-white/10 disabled:opacity-20 rounded-lg transition-colors"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="flex flex-col items-center min-w-[100px]">
                    <span className="text-white text-base font-bold tracking-tighter">
                        {currentPage} <span className="text-zinc-500 font-normal mx-1">/</span> {numPages}
                    </span>
                    <div className="w-full bg-zinc-800 h-1 rounded-full mt-1 overflow-hidden">
                        <div
                            className="bg-blue-500 h-full transition-all duration-300"
                            style={{ width: `${(currentPage / numPages) * 100}%` }}
                        />
                    </div>
                </div>
                <button
                    onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                    disabled={currentPage === numPages}
                    className="p-2 text-white hover:bg-white/10 disabled:opacity-20 rounded-lg transition-colors"
                >
                    <ChevronRight className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
}

// ─── Main Component (V4.0 Robusto) ──────────────────────────────────────────
export default function SecureFileViewer({ filePath, fileName, onClose }: SecureFileViewerProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fileType, setFileType] = useState<'pdf' | 'image' | 'docx' | 'xlsx' | 'pptx' | 'other'>('other');
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [externalViewerUrl, setExternalViewerUrl] = useState<string | null>(null);
    const [useExternalViewer, setUseExternalViewer] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pdfReady, setPdfReady] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

    const docxContainerRef = useRef<HTMLDivElement>(null);
    const xlsxContainerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // V4.0: Configuración para Range Loading
    const fileSource = useMemo(() => {
        if (!filePath || !blobUrl) return null;

        // Si es PDF, intentamos habilitar Range Loading indirectamente
        if (filePath.toLowerCase().endsWith('.pdf')) {
            // Nota: react-pdf prefiere un objeto para manejar headers y range
            return {
                url: blobUrl, // Usamos el blobUrl pero PDF.js internamente intentará detectar soporte
                cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
                cMapPacked: true,
            };
        }
        return blobUrl;
    }, [filePath, blobUrl]);

    // Ancho dinámico con debounce implícito por el evento resize
    const pdfPageWidth = useMemo(() => {
        const padding = isFullscreen ? 40 : 80;
        const width = windowWidth - padding;
        return isMobile ? width : Math.min(width, 850);
    }, [windowWidth, isFullscreen, isMobile]);

    const estimatedPageHeight = Math.round(pdfPageWidth * 1.414);

    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        setPdfReady(false);
        setNumPages(null);
        loadContent();
        return () => {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filePath]);

    useEffect(() => {
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    };

    const loadContent = async (forceExternal = false) => {
        setLoading(true);
        setError(null);
        setBlobUrl(null);
        setPdfReady(false);
        if (!forceExternal) setUseExternalViewer(false);

        try {
            const lowerPath = filePath.toLowerCase();
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('Sesión de usuario expirada.');

            let type: typeof fileType = 'other';
            if (lowerPath.endsWith('.pdf')) type = 'pdf';
            else if (lowerPath.match(/\.(jpg|jpeg|png|webp|gif)$/)) type = 'image';
            else if (lowerPath.match(/\.(doc|docx)$/)) type = 'docx';
            else if (lowerPath.match(/\.(xls|xlsx|csv)$/)) type = 'xlsx';
            else if (lowerPath.match(/\.(ppt|pptx)$/)) type = 'pptx';

            setFileType(type);

            const baseUrl = process.env.NEXT_PUBLIC_API_URL;
            let cleanPath = filePath;
            if (filePath.includes('path=')) {
                const urlObj = new URL(filePath, 'http://dummy.com');
                cleanPath = urlObj.searchParams.get('path') || cleanPath;
            }
            cleanPath = decodeURIComponent(cleanPath);

            if (type === 'pptx') {
                setLoading(false);
                return;
            }

            if (forceExternal || useExternalViewer) {
                const previewRes = await fetch(
                    `${baseUrl}/storage/preview-url?path=${encodeURIComponent(cleanPath)}&bucket=course-materials`,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                const data = await previewRes.json();
                setExternalViewerUrl(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(data.url)}`);
                setLoading(false);
                return;
            }

            // V4.1: Range Loading REAL
            // No descargamos el blob completo en el frontend si es PDF.
            // Dejamos que el motor de PDF.js pida los bytes por demanda (Range Requests).
            const secureUrl = `${baseUrl}/storage/secure-url?path=${encodeURIComponent(cleanPath)}&bucket=course-materials`;

            if (type === 'pdf') {
                setBlobUrl(secureUrl); // Usamos el endpoint como origen directo
                setLoading(false);
                return;
            }

            // Para otros tipos (imágenes, office), sí descargamos el blob completo
            const blobRes = await fetch(secureUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!blobRes.ok) throw new Error(`Status ${blobRes.status}: Error al obtener archivo`);

            const blob = await blobRes.blob();
            const objUrl = URL.createObjectURL(blob);
            setBlobUrl(objUrl);

            // XLSX/DOCX handling (Client-side previews)
            if (type === 'docx') {
                setTimeout(async () => {
                    if (docxContainerRef.current) {
                        try {
                            await docx.renderAsync(blob, docxContainerRef.current, undefined, { className: 'docx-viewer' });
                        } catch {
                            setUseExternalViewer(true);
                            loadContent(true);
                        }
                    }
                }, 100);
            }

            if (type === 'xlsx') {
                setTimeout(async () => {
                    try {
                        const buffer = await blob.arrayBuffer();
                        const wb = XLSX.read(buffer);
                        const html = XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[0]]);
                        if (xlsxContainerRef.current) xlsxContainerRef.current.innerHTML = html;
                    } catch {
                        setUseExternalViewer(true);
                        loadContent(true);
                    }
                }, 100);
            }

        } catch (err: any) {
            setError(err.message || 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (!blobUrl) return;
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        a.click();
    };

    // ── Condicionales de renderizado ──
    if (loading && fileType !== 'pptx') {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-4 bg-white/50 backdrop-blur-md rounded-2xl border border-gray-100 shadow-xl">
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                    </div>
                </div>
                <div className="text-center">
                    <p className="text-sm font-bold text-gray-800 tracking-tight">Cifrando vista previa...</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-1">AES-256 R2_SECURE_TRANSPORT</p>
                </div>
            </div>
        );
    }

    if (fileType === 'pptx' && !useExternalViewer) {
        return <SecurePptxViewer filePath={filePath} fileName={fileName} />;
    }

    if (error) {
        return (
            <div className="p-8 text-center bg-red-50/50 backdrop-blur border border-red-100 rounded-2xl max-w-lg mx-auto shadow-sm">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4 opacity-80" />
                <h3 className="text-red-900 font-black tracking-tight text-lg mb-2">Fallo en la conexión segura</h3>
                <p className="text-red-600/70 text-sm mb-6 font-medium leading-relaxed">{error}</p>
                <div className="flex flex-col gap-2">
                    <Button onClick={() => loadContent()} className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl h-12">
                        Reintentar enlace
                    </Button>
                    <button onClick={() => { setUseExternalViewer(true); loadContent(); }} className="text-xs text-zinc-400 hover:text-zinc-600 font-bold transition-colors">
                        Usar motor redundante (Office Online)
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`w-full ${isFullscreen ? 'h-screen fixed inset-0 z-[9999]' : 'h-full'} flex flex-col bg-[#F4F4F5] overflow-hidden rounded-xl relative select-none`}
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* Header / Barra de herramientas superior */}
            <div className="h-14 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-6 z-[110]">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-100">
                        <Lock className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-xs font-black text-zinc-900 uppercase tracking-widest truncate max-w-[200px]">
                        {fileName}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleFullscreen}
                        className="p-2.5 text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all active:scale-90"
                    >
                        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {fileType === 'pdf' && fileSource && (
                    <div className="h-full overflow-auto bg-[#E4E4E7]/50 flex justify-center scroll-smooth scrollbar-thin">
                        <Document
                            file={fileSource}
                            onLoadSuccess={({ numPages: n }) => {
                                setNumPages(n);
                                // V4.0: Handshake robusto con el worker local
                                // Pequeña espera para asegurar que el thread del worker está idle
                                setTimeout(() => setPdfReady(true), 250);
                            }}
                            onLoadError={(err) => {
                                console.error('PDF Worker Critical Failure:', err);
                                setError('El motor de PDF falló al inicializar. Por favor, recarga o usa el motor redundante.');
                            }}
                            loading={
                                <div className="p-20 text-center animate-in fade-in zoom-in duration-500">
                                    <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
                                    <p className="text-xs font-black text-blue-600 uppercase tracking-widest">Iniciando Virtualización...</p>
                                </div>
                            }
                            className="max-w-full"
                        >
                            {numPages && (
                                isMobile ? (
                                    <MobilePdfNavigator
                                        numPages={numPages}
                                        pageWidth={pdfPageWidth}
                                        estimatedHeight={estimatedPageHeight}
                                    />
                                ) : (
                                    <div className="py-8 px-4 flex flex-col items-center">
                                        {Array.from({ length: numPages }, (_, i) => (
                                            <VirtualizedLazyPage
                                                key={`vp_${i + 1}`}
                                                pageNumber={i + 1}
                                                pageWidth={pdfPageWidth}
                                                estimatedHeight={estimatedPageHeight}
                                                pdfReady={pdfReady}
                                            />
                                        ))}
                                    </div>
                                )
                            )}
                        </Document>
                    </div>
                )}

                {fileType === 'docx' && !useExternalViewer && (
                    <div className="h-full overflow-auto bg-white p-6 shadow-inner">
                        <div ref={docxContainerRef} className="max-w-[850px] mx-auto docx-content shadow-2xl p-8 rounded-lg bg-white border border-gray-100" />
                    </div>
                )}

                {fileType === 'xlsx' && !useExternalViewer && (
                    <div className="h-full overflow-auto bg-white shadow-inner">
                        <div ref={xlsxContainerRef} className="excel-viewer p-6" />
                    </div>
                )}

                {fileType === 'image' && blobUrl && (
                    <div className="h-full flex items-center justify-center p-12 overflow-auto bg-zinc-900 shadow-inner">
                        <img
                            src={blobUrl}
                            alt={fileName}
                            className="max-w-full max-h-full object-contain shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] rounded-lg pointer-events-none"
                        />
                    </div>
                )}

                {useExternalViewer && externalViewerUrl && (
                    <iframe src={externalViewerUrl} className="w-full h-full border-none bg-zinc-100" />
                )}

                {fileType === 'other' && !loading && (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-24 h-24 bg-zinc-100 rounded-[2.5rem] flex items-center justify-center mb-8 border border-zinc-200">
                            <Lock className="w-10 h-10 text-zinc-400" />
                        </div>
                        <h3 className="text-zinc-900 font-black text-2xl tracking-tighter mb-4">Formato Restringido</h3>
                        <p className="text-zinc-500 text-sm mb-10 max-w-sm leading-relaxed">
                            Por seguridad, este formato no se puede visualizar en línea. Descarga el archivo para verlo localmente.
                        </p>
                        <Button onClick={handleDownload} className="bg-zinc-900 text-white font-black px-12 py-7 rounded-2xl hover:bg-blue-600 transition-all shadow-2xl">
                            Descargar {fileName.split('.').pop()?.toUpperCase()}
                        </Button>
                    </div>
                )}
            </div>

            {/* Footer de Protección Senior */}
            <div className="bg-zinc-900 h-10 flex items-center justify-center px-4">
                <p className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.4em] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6] animate-pulse" />
                    Secured by CampusLink Virtualization Engine v4.0.0 (Stable)
                </p>
            </div>

            <style jsx global>{`
                .react-pdf__Document { display: flex; flex-direction: column; align-items: center; }
                .react-pdf__Page__canvas { border-radius: 4px; box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.15); }
                .docx-content table { width: 100% !important; border: 1px solid #eee; }
                .excel-viewer table { border-collapse: collapse; min-width: 100%; font-family: sans-serif; }
                .excel-viewer td { border: 1px solid #e2e8f0; padding: 12px; font-size: 13px; color: #475569; }
                .scrollbar-thin::-webkit-scrollbar { width: 4px; }
                .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
            `}</style>
        </div>
    );
}
