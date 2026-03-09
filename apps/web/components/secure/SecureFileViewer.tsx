'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, AlertCircle, Download, Lock, Maximize, Minimize, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Document, Page, pdfjs } from 'react-pdf';
import * as docx from 'docx-preview';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import SecurePptxViewer from './SecurePptxViewer';

// V4.2: Configuración del worker local. 
// Es CRÍTICO que el worker y la librería tengan la misma versión bit-por-bit.
if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface SecureFileViewerProps {
    filePath: string;
    fileName: string;
    onClose?: (open: false) => void;
}

// ─── Virtualized Lazy PDF Page ────────────────────────────────────────────────
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
                setShouldMount(entry.isIntersecting);
            },
            {
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
                            <div className="bg-white flex flex-col items-center justify-center gap-2" style={{ width: pageWidth, height: estimatedHeight }}>
                                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                                <p className="text-gray-300 text-xs">Pág. {pageNumber}</p>
                            </div>
                        }
                    />
                    <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
                </>
            ) : (
                <div className="bg-gray-100/50 rounded-sm border border-dashed border-gray-200 flex flex-col items-center justify-center gap-2" style={{ width: pageWidth, height: estimatedHeight }}>
                    <div className="w-8 h-8 rounded-full bg-gray-200/50 animate-pulse" />
                    <p className="text-gray-300 text-[10px] font-medium uppercase tracking-widest">Página {pageNumber}</p>
                </div>
            )}
        </div>
    );
}

// ─── Mobile Navigator ─────────────────────────────────────────────────────────
interface MobilePdfNavigatorProps {
    numPages: number;
    pageWidth: number;
    estimatedHeight: number;
}

function MobilePdfNavigator({ numPages, pageWidth, estimatedHeight }: MobilePdfNavigatorProps) {
    const [currentPage, setCurrentPage] = useState(1);

    return (
        <div className="flex flex-col items-center justify-center min-h-full w-full gap-6 py-4 pb-28 px-0.5">
            <div className="relative shadow-2xl rounded-sm overflow-hidden border border-zinc-200 bg-white">
                <Page
                    pageNumber={currentPage}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    width={pageWidth}
                    loading={
                        <div className="flex flex-col items-center justify-center gap-3 bg-gray-50" style={{ width: pageWidth, height: estimatedHeight }}>
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        </div>
                    }
                />
                <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
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
export default function SecureFileViewer({ filePath, fileName, onClose }: SecureFileViewerProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fileType, setFileType] = useState<'pdf' | 'image' | 'docx' | 'xlsx' | 'pptx' | 'other'>('other');
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [sessionToken, setSessionToken] = useState<string | null>(null); // V4.2: Auth para Range Requests
    const [externalViewerUrl, setExternalViewerUrl] = useState<string | null>(null);
    const [useExternalViewer, setUseExternalViewer] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pdfReady, setPdfReady] = useState(false);
    const [containerWidth, setContainerWidth] = useState(0); // V4.4: Ancho dinámico real
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

    const docxContainerRef = useRef<HTMLDivElement>(null);
    const xlsxContainerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // V4.2: Re-introducción de headers HTTP para que PDF.js pueda realizar Range Requests autenticados
    const fileSource = useMemo(() => {
        if (!blobUrl || !sessionToken) return null;

        if (filePath.toLowerCase().endsWith('.pdf')) {
            return {
                url: blobUrl,
                httpHeaders: {
                    'Authorization': `Bearer ${sessionToken}`
                },
                withCredentials: true,
                cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
                cMapPacked: true,
            };
        }
        return blobUrl;
    }, [filePath, blobUrl, sessionToken]);

    const pdfPageWidth = useMemo(() => {
        if (containerWidth === 0) return 300;
        // V4.4: Usamos el ancho real del contenedor menos un margen de seguridad mínimo (2px para bordes)
        const safetyMargin = isMobile ? 4 : (isFullscreen ? 40 : 80);
        const availableWidth = containerWidth - safetyMargin;
        return isMobile ? availableWidth : Math.min(availableWidth, 850);
    }, [containerWidth, isFullscreen, isMobile]);

    const estimatedPageHeight = Math.round(pdfPageWidth * 1.414);

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
                setIsMobile(entry.contentRect.width < 768);
            }
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        setPdfReady(false);
        setNumPages(null);
        setSessionToken(null);
        loadContent();
        return () => {
            if (blobUrl && blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
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
            setSessionToken(token); // Guardamos token para PDF.js

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

            if (type === 'pdf') {
                // V4.2: Para PDF usamos la URL de la API directamente (con headers de auth via Document prop)
                setBlobUrl(secureUrl);
                setLoading(false);
                return;
            }

            // Descarga normal para el resto
            const blobRes = await fetch(secureUrl, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!blobRes.ok) throw new Error(`Status ${blobRes.status}: Error al obtener archivo`);
            const blob = await blobRes.blob();
            const objUrl = URL.createObjectURL(blob);
            setBlobUrl(objUrl);

            if (type === 'docx') {
                setTimeout(async () => {
                    if (docxContainerRef.current) {
                        try {
                            await docx.renderAsync(blob, docxContainerRef.current, undefined, { className: 'docx-viewer' });
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
            className={`w-full ${isFullscreen ? 'h-screen fixed inset-0 z-[9999]' : 'h-full'} flex flex-col bg-[#F4F4F5] overflow-hidden rounded-xl relative select-none`}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div className="h-14 bg-white/90 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-6 z-[110]">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-100 italic font-black text-blue-600">v4</div>
                    <span className="text-xs font-black text-zinc-900 uppercase tracking-widest truncate max-w-[200px]">{fileName}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={toggleFullscreen} className="p-2.5 text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all active:scale-95">
                        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {fileType === 'pdf' && fileSource && (
                    <div className="h-full overflow-auto bg-[#E4E4E7]/50 flex flex-col items-center scroll-smooth scrollbar-none">
                        <Document
                            file={fileSource}
                            onLoadSuccess={({ numPages: n }) => {
                                setNumPages(n);
                                setTimeout(() => setPdfReady(true), 150);
                            }}
                            onLoadError={(err) => {
                                console.error('CRITICAL PDF ERROR:', err);
                                if (err && typeof err === 'object') {
                                    console.log('Error Properties:', Object.keys(err));
                                    setError(`Fallo de motor (v4.2): ${JSON.stringify(err)}`);
                                } else {
                                    setError('Error de motor local. Prueba "Reintentar" o usa "Motor Microsoft".');
                                }
                            }}
                            loading={<div className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto" /><p className="text-xs font-bold text-blue-600 mt-4 uppercase tracking-[0.2em]">Iniciando Virtualización...</p></div>}
                            className="max-w-full"
                        >
                            {numPages && (
                                isMobile ? (
                                    <MobilePdfNavigator numPages={numPages} pageWidth={pdfPageWidth} estimatedHeight={estimatedPageHeight} />
                                ) : (
                                    <div className="py-8 px-4 flex flex-col items-center">
                                        {Array.from({ length: numPages }, (_, i) => (
                                            <VirtualizedLazyPage key={`vp_${i + 1}`} pageNumber={i + 1} pageWidth={pdfPageWidth} estimatedHeight={estimatedPageHeight} pdfReady={pdfReady} />
                                        ))}
                                    </div>
                                )
                            )}
                        </Document>
                    </div>
                )}

                {fileType === 'docx' && !useExternalViewer && (
                    <div className="h-full overflow-auto bg-white p-6 shadow-inner"><div ref={docxContainerRef} className="max-w-[850px] mx-auto docx-content shadow-2xl p-8 rounded-lg bg-white border border-gray-100" /></div>
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

            <div className="bg-zinc-900 h-10 flex items-center justify-center">
                <p className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.4em]">CampusLink Advanced Virtualization Engine v4.4 Stable</p>
            </div>

            <style jsx global>{`
                .react-pdf__Document { display: flex; flex-direction: column; align-items: center; }
                .react-pdf__Page__canvas { border-radius: 4px; box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.15); }
                .docx-content table { width: 100% !important; border: 1px solid #eee; }
                .excel-viewer table { border-collapse: collapse; min-width: 100%; }
                .excel-viewer td { border: 1px solid #e2e8f0; padding: 12px; font-size: 13px; }
            `}</style>
        </div>
    );
}
