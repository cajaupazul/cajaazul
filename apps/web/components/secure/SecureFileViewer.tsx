'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, AlertCircle, Download, Lock, Maximize, Minimize, ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Document, Page, pdfjs } from 'react-pdf';
import * as docx from 'docx-preview';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import SecurePptxViewer from './SecurePptxViewer';

// V4.2+: Configuración del worker local.
if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface SecureFileViewerProps {
    filePath: string;
    fileName: string;
    useAdvancedViewer?: boolean;
    onClose?: (open: false) => void;
}

// ─── Virtualized Lazy PDF Page ────────────────────────────────────────────────
interface VirtualizedPageProps {
    pageNumber: number;
    pageWidth: number;
    scale: number;
    estimatedHeight: number;
    pdfReady: boolean;
    isMobile: boolean;
}

function VirtualizedLazyPage({ pageNumber, pageWidth, scale, estimatedHeight, pdfReady, isMobile }: VirtualizedPageProps) {
    const [shouldMount, setShouldMount] = useState(false);
    const [actualHeight, setActualHeight] = useState(estimatedHeight);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!pdfReady) return;
        const el = containerRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setShouldMount(entry.isIntersecting);
            },
            {
                // V5.6: Margen adaptativo: 800px en móvil (ahorro RAM) | 2500px en PC (fluidez)
                rootMargin: isMobile ? '800px 0px 800px 0px' : '2500px 0px 2500px 0px',
                threshold: 0
            }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [pdfReady]);

    return (
        <div
            ref={containerRef}
            className={`transition-all duration-300 overflow-hidden flex flex-col items-center ${isMobile ? 'mb-2' : 'mb-2'}`}
            style={{
                minHeight: shouldMount ? 'auto' : actualHeight * scale,
                height: shouldMount ? 'auto' : actualHeight * scale,
                width: '100%'
            }}
        >
            {shouldMount && pdfReady ? (
                <>
                    <Page
                        pageNumber={pageNumber}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        renderForms={false}
                        // V5.8: Calidad Cristalina (Fin de píxeles)
                        devicePixelRatio={typeof window !== 'undefined' ? window.devicePixelRatio : 2}
                        onRenderSuccess={(page) => {
                            setActualHeight(page.originalHeight * (pageWidth / page.originalWidth));
                        }}
                        width={pageWidth}
                        scale={scale}
                        className={`shadow-md overflow-hidden animate-in fade-in duration-500`}
                        loading={
                            <div className="bg-white flex flex-col items-center justify-center gap-2" style={{ width: pageWidth * scale, height: actualHeight * scale }}>
                                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                                <p className="text-gray-300 text-xs text-center px-4 font-medium uppercase tracking-[0.2em]">Cargando Pág. {pageNumber}</p>
                            </div>
                        }
                    />
                    <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
                </>
            ) : (
                <div
                    className="bg-white/40 flex flex-col items-center justify-center gap-2"
                    style={{ width: pageWidth * scale, height: actualHeight * scale }}
                >
                    <div className="w-8 h-8 rounded-full border-2 border-zinc-200 border-t-zinc-400 animate-spin" />
                    <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-[0.3em]">Preparando {pageNumber}</p>
                </div>
            )}
        </div>
    );
}

// ─── Mobile Navigator (For Large Files) ───────────────────────────────────────
interface MobilePdfNavigatorProps {
    numPages: number;
    pageWidth: number;
    scale: number;
    estimatedHeight: number;
}

function MobilePdfNavigator({ numPages, pageWidth, scale, estimatedHeight }: MobilePdfNavigatorProps) {
    const [currentPage, setCurrentPage] = useState(1);

    return (
        <div className="flex flex-col items-center justify-start min-h-full w-full bg-zinc-100/30">
            <div className="w-full flex-1 flex items-center justify-center py-6 px-0 overflow-hidden">
                <div className="relative shadow-2xl bg-white animate-in zoom-in-95 duration-500">
                    <Page
                        pageNumber={currentPage}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        renderForms={false}
                        devicePixelRatio={typeof window !== 'undefined' ? window.devicePixelRatio : 2}
                        width={pageWidth}
                        scale={scale}
                        loading={
                            <div className="flex flex-col items-center justify-center gap-4 bg-zinc-50" style={{ width: pageWidth * scale, height: estimatedHeight * scale }}>
                                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.3em]">Cargando Pág. {currentPage}</p>
                            </div>
                        }
                    />
                    <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
                </div>
            </div>

            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-4 bg-zinc-900/95 border border-white/10 px-6 py-3 rounded-2xl backdrop-blur-xl shadow-2xl">
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
                        <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${(currentPage / numPages) * 100}%` }} />
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SecureFileViewer({ filePath, fileName, useAdvancedViewer = false, onClose }: SecureFileViewerProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fileType, setFileType] = useState<'pdf' | 'image' | 'docx' | 'xlsx' | 'pptx' | 'other'>('other');
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [nativePreviewUrl, setNativePreviewUrl] = useState<string | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(useAdvancedViewer);
    const [isMobileDevice, setIsMobileDevice] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [fileSize, setFileSize] = useState<number>(0); // V4.6: Inteligencia por tamaño
    const [docxScale, setDocxScale] = useState(1);
    const [externalViewerUrl, setExternalViewerUrl] = useState<string | null>(null);
    const [useExternalViewer, setUseExternalViewer] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pdfReady, setPdfReady] = useState(false);
    const [containerWidth, setContainerWidth] = useState(0);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    const [zoomLevel, setZoomLevel] = useState(1);

    const docxContainerRef = useRef<HTMLDivElement>(null);
    const xlsxContainerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // V4.6+: Inteligencia de navegación basada en tamaño
    // PDFs < 5MB = Scroll continuo | >= 5MB = Página por página (Móvil)
    // V5.8: scroll naturalmente todo. Umbral subido a 20MB.
    const isLargeFile = useMemo(() => fileSize >= 20 * 1024 * 1024, [fileSize]);

    const fileSource = useMemo(() => {
        if (!blobUrl || !sessionToken) return null;
        if (filePath.toLowerCase().endsWith('.pdf')) {
            return {
                url: blobUrl,
                httpHeaders: { 'Authorization': `Bearer ${sessionToken}` },
                withCredentials: true,
                cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
                cMapPacked: true,
            };
        }
        return blobUrl;
    }, [filePath, blobUrl, sessionToken]);

    const pdfPageWidth = useMemo(() => {
        if (containerWidth === 0) return 300;
        const safetyMargin = isMobileDevice ? 0 : 20; // 20px padding
        return containerWidth - safetyMargin; // Fit to width without hard limit
    }, [containerWidth, isMobileDevice]);

    const estimatedPageHeight = Math.round(pdfPageWidth * 1.414);

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 4));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
                const mobile = entry.contentRect.width < 768;
                setIsMobile(mobile);
                setIsMobileDevice(mobile);
            }
        });
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (fileType === 'docx' && docxContainerRef.current && containerWidth > 0) {
            const timer = setTimeout(() => {
                const docEl = docxContainerRef.current?.querySelector('.docx-viewer') as HTMLElement;
                if (docEl) {
                    const docWidth = docEl.offsetWidth || 800;
                    const availableWidth = containerWidth - (isMobile ? 16 : 48);
                    if (docWidth > availableWidth) {
                        setDocxScale(availableWidth / docWidth);
                    } else {
                        setDocxScale(1);
                    }
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [fileType, containerWidth, isMobile, blobUrl]);

    useEffect(() => {
        setPdfReady(false);
        setNumPages(null);
        setSessionToken(null);
        loadContent();
        return () => {
            if (blobUrl && blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filePath, showAdvanced, isMobileDevice]);

    useEffect(() => {
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Defensa perimetral contra atajos de teclado (Ctrl+S, Ctrl+P)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P' || e.key === 'c' || e.key === 'C')) {
                e.preventDefault();
                e.stopPropagation();
                console.warn('Protección activa: Acción bloqueada.');
            }
        };
        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, []);

    // Interceptar Zoom del Navegador (Ctrl + Rueda) de forma global para bloquear el resize del tab de Chrome
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                // Check if we are inside our document viewer
                const container = document.getElementById('secure-pdf-scroll-container');
                if (container && container.contains(e.target as Node)) {
                    e.preventDefault(); // Stop Chrome from zooming the whole web page
                    e.stopPropagation();
                    const delta = e.deltaY > 0 ? -0.1 : 0.1;
                    setZoomLevel(prev => Math.min(Math.max(prev + delta, 0.5), 4));
                }
            }
        };

        // We MUST use passive: false on window to successfully override Chrome's native Ctrl+Scroll zooming
        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => window.removeEventListener('wheel', handleWheel);
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
            setSessionToken(token);

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

            const secureUrl = `${baseUrl}/storage/secure-url?path=${encodeURIComponent(cleanPath)}&bucket=course-materials`;

            // V4.6+: Obtener tamaño real del archivo vía HEAD
            try {
                const headRes = await fetch(secureUrl, {
                    method: 'HEAD',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const length = headRes.headers.get('Content-Length');
                if (length) setFileSize(parseInt(length));
            } catch (e) { console.warn("Falló detección de tamaño, usando modo seguro (Páginas)"); setFileSize(10 * 1024 * 1024); }

            if (type === 'pdf') {
                // FORZAR SIEMPRE EL MODO AVANZADO (PRO)
                // Es la única forma de aislar el visor y prevenir la descarga/clic derecho en el iframe nativo del navegador.
                setBlobUrl(secureUrl);
                setLoading(false);
                return;
            }

            const blobRes = await fetch(secureUrl, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!blobRes.ok) throw new Error(`Status ${blobRes.status}: Error al obtener archivo`);
            const blob = await blobRes.blob();
            const objUrl = URL.createObjectURL(blob);
            setBlobUrl(objUrl);

            if (type === 'docx') {
                setTimeout(async () => {
                    if (docxContainerRef.current) {
                        try {
                            await docx.renderAsync(blob, docxContainerRef.current, undefined, {
                                className: 'docx-viewer',
                                ignoreLastRenderedPageBreak: false
                            });
                            setDocxScale(0.99);
                        } catch { setUseExternalViewer(true); loadContent(true); }
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
                    } catch { setUseExternalViewer(true); loadContent(true); }
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

    if (loading && fileType !== 'pptx') {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-4 bg-white/50 backdrop-blur-md rounded-2xl border border-gray-100 shadow-xl">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-sm font-bold text-gray-800">Iniciando motor seguro...</p>
            </div>
        );
    }

    if (fileType === 'pptx' && !useExternalViewer) {
        return <SecurePptxViewer filePath={filePath} fileName={fileName} />;
    }

    if (error) {
        return (
            <div className="p-8 text-center bg-red-50/50 backdrop-blur border border-red-100 rounded-2xl max-w-lg mx-auto">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-red-900 font-bold text-lg mb-2">Error de Conexión</h3>
                <p className="text-red-600/70 text-sm mb-6">{error}</p>
                <div className="flex flex-col gap-2">
                    <Button onClick={() => loadContent()} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">Reintentar</Button>
                    <button onClick={() => { setUseExternalViewer(true); loadContent(); }} className="text-xs text-zinc-400 font-bold hover:text-zinc-600">Usar motor Microsoft</button>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`w-full ${isFullscreen ? 'h-screen fixed inset-0 z-[9999]' : 'h-full'} flex flex-col bg-[#F4F4F5] overflow-hidden rounded-xl relative select-none shadow-2xl`}
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* V4.6+: Encabezado inteligente (se oculta en fullscreen) */}
            {!isFullscreen && (
                <div className="h-14 bg-white/90 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-6 z-[110]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-100 italic font-black text-blue-600">v4</div>
                        <span className="text-xs font-black text-zinc-900 uppercase tracking-widest truncate max-w-[200px]">{fileName}</span>
                    </div>
                    {fileType === 'pdf' && (
                        <div className="hidden md:flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
                            <button onClick={handleZoomOut} className="p-1 px-2 text-zinc-600 hover:bg-white rounded transition-colors"><ZoomOut className="w-4 h-4" /></button>
                            <span className="text-xs font-bold w-12 text-center text-zinc-700 select-none">{Math.round(zoomLevel * 100)}%</span>
                            <button onClick={handleZoomIn} className="p-1 px-2 text-zinc-600 hover:bg-white rounded transition-colors"><ZoomIn className="w-4 h-4" /></button>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <button onClick={toggleFullscreen} className="p-2.5 text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all active:scale-95">
                            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            )}

            {/* V4.6+: Botón de cierre flotante y controles Zoom solo en Fullscreen */}
            {isFullscreen && (
                <div className="fixed top-6 right-6 z-[200] flex items-center gap-3">
                    {fileType === 'pdf' && (
                        <div className="flex items-center gap-1 bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-1.5 rounded-full shadow-2xl">
                            <button onClick={handleZoomOut} className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-full transition-all"><ZoomOut className="w-5 h-5" /></button>
                            <span className="text-xs font-bold w-12 text-center text-white select-none">{Math.round(zoomLevel * 100)}%</span>
                            <button onClick={handleZoomIn} className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-full transition-all"><ZoomIn className="w-5 h-5" /></button>
                        </div>
                    )}
                    <button
                        onClick={toggleFullscreen}
                        className="w-12 h-12 flex items-center justify-center bg-zinc-900/50 text-white rounded-full backdrop-blur-xl border border-white/10 hover:bg-zinc-900 hover:scale-110 transition-all shadow-2xl group"
                    >
                        <X className="w-6 h-6 group-active:scale-90" />
                    </button>
                </div>
            )}

            <div className={`flex-1 overflow-hidden relative ${isFullscreen ? 'bg-zinc-950' : 'bg-[#E4E4E7]/50'}`}>
                {fileType === 'pdf' && (
                    <div className="h-full w-full relative bg-[#525659]">
                        {fileSource && (
                            <div id="secure-pdf-scroll-container" className="h-full w-full overflow-auto flex flex-col items-center scroll-smooth scrollbar-none pb-20 pt-4">
                                <Document
                                    file={fileSource}
                                    onLoadSuccess={({ numPages: n }) => {
                                        setNumPages(n);
                                        setTimeout(() => setPdfReady(true), 150);
                                    }}
                                    onLoadError={(err) => {
                                        console.error('CRITICAL PDF ERROR:', err);
                                        setError('Error de motor local. Prueba "Reintentar" o desactiva "Modo Pro".');
                                    }}
                                    loading={<div className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-white mx-auto" /><p className="text-xs font-bold text-gray-300 mt-4 uppercase tracking-[0.2em]">Cargando Documento Seguro...</p></div>}
                                    className="max-w-full border-none"
                                >
                                    {numPages && (
                                        isMobile && isLargeFile ? (
                                            <MobilePdfNavigator numPages={numPages} pageWidth={pdfPageWidth} scale={zoomLevel} estimatedHeight={estimatedPageHeight} />
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                {Array.from({ length: numPages }, (_, i) => (
                                                    <VirtualizedLazyPage key={`vp_${i + 1}`} pageNumber={i + 1} pageWidth={pdfPageWidth} scale={zoomLevel} estimatedHeight={estimatedPageHeight} pdfReady={pdfReady} isMobile={isMobileDevice} />
                                                ))}
                                            </div>
                                        )
                                    )}
                                </Document>
                            </div>
                        )}
                    </div>
                )}

                {fileType === 'docx' && !useExternalViewer && (
                    <div className="h-full overflow-auto bg-zinc-100/50 flex flex-col items-center">
                        <div
                            ref={docxContainerRef}
                            className="docx-content-wrapper transition-transform duration-500 origin-top"
                            style={{
                                transform: `scale(${docxScale})`,
                                width: 'fit-content',
                                margin: isFullscreen ? '0' : '20px auto'
                            }}
                        />
                    </div>
                )}
                {fileType === 'xlsx' && !useExternalViewer && (
                    <div className="h-full overflow-auto bg-white shadow-inner"><div ref={xlsxContainerRef} className="excel-viewer p-6" /></div>
                )}
                {fileType === 'image' && blobUrl && (
                    <div className="h-full flex items-center justify-center p-12 overflow-auto bg-zinc-900 shadow-inner">
                        <img src={blobUrl} alt={fileName} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg pointer-events-none" />
                    </div>
                )}
                {useExternalViewer && externalViewerUrl && (
                    <iframe src={externalViewerUrl} className="w-full h-full border-none bg-zinc-100" />
                )}
                {fileType === 'other' && !loading && (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center text-zinc-500">
                        <Lock className="w-16 h-16 mb-4 opacity-20" />
                        <h3 className="font-bold text-xl text-zinc-900 mb-2">Vista previa no disponible</h3>
                        <Button onClick={handleDownload} className="mt-8 bg-zinc-900 text-white px-12 h-14 rounded-2xl">Descargar Archivo</Button>
                    </div>
                )}
            </div>

            {/* V4.6+: Pie de página inteligente (se oculta en fullscreen) */}
            {!isFullscreen && (
                <div className="bg-zinc-900 h-10 flex items-center justify-center">
                    <p className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.4em]">CampusLink Hybrid Engine v5.8 Stable</p>
                </div>
            )}

            <style jsx global>{`
                /* REPLICA VISUAL de Google Chrome PDF Viewer Nativo */
                .react-pdf__Document { 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    gap: 0; 
                    padding-bottom: 300px; /* Margen infinito inferior estilo Chrome */
                    width: 100%;
                }
                .react-pdf__Document > div {
                    margin-bottom: 8px !important;
                }
                .react-pdf__Page__canvas { 
                    border-radius: 0px; 
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3) !important; /* Sombra más pronunciada como Chrome */
                    /* Eliminamos transform scale y max-width para que el React-PDF re-renderice en alta definición basado en su ancho explícito */
                }
                .docx-content-wrapper .docx-viewer { 
                    background: white; 
                    box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
                    border-radius: 4px;
                    padding: ${isMobile ? '8px' : '40px'} !important;
                }
                .docx-content-wrapper table { width: 100% !important; border: 1px solid #eee; }
                .excel-viewer table { border-collapse: collapse; min-width: 100%; }
                .excel-viewer td { border: 1px solid #e2e8f0; padding: 12px; font-size: 13px; }
                .scrollbar-none::-webkit-scrollbar { display: none; }
                .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}
