'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, Download, Lock, Maximize, Minimize, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Document, Page, pdfjs } from 'react-pdf';
import * as docx from 'docx-preview';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import SecurePptxViewer from './SecurePptxViewer';

// Worker sincronizado con la versión de la librería para evitar crashes por mismatch
if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

interface SecureFileViewerProps {
    filePath: string;
    fileName: string;
    onClose?: (open: false) => void;
}

// ─── Lazy PDF Page ─────────────────────────────────────────────────────────────
// Renderiza el canvas de la página SOLO cuando entra en viewport.
// CRÍTICO: Solo activa el observer cuando pdfReady=true (el worker ya está listo).
interface LazyPdfPageProps {
    pageNumber: number;
    pageWidth: number;
    estimatedHeight: number;
    pdfReady: boolean; // Bloquea el observer hasta que el PDF Document esté listo
}

function LazyPdfPage({ pageNumber, pageWidth, estimatedHeight, pdfReady }: LazyPdfPageProps) {
    const [shouldRender, setShouldRender] = useState(false);
    const placeholderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // No activar el observer hasta que el PDF worker esté confirmado como listo
        if (!pdfReady) return;

        const el = placeholderRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setShouldRender(true);
                    // Una vez renderizada, la dejamos montada para scroll fluido
                    observer.disconnect();
                }
            },
            // Pre-carga la página cuando está a 400px de entrar en pantalla
            { rootMargin: '400px 0px 400px 0px', threshold: 0 }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [pdfReady]); // Solo re-ejecuta cuando pdfReady cambia

    return (
        <div
            ref={placeholderRef}
            className="mb-8 relative transition-shadow duration-300 hover:shadow-2xl"
            style={{ minHeight: shouldRender ? undefined : estimatedHeight }}
        >
            {shouldRender ? (
                <>
                    <Page
                        pageNumber={pageNumber}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        width={pageWidth}
                        className="shadow-xl rounded-sm overflow-hidden"
                        loading={
                            <div
                                className="bg-white animate-pulse rounded-sm border border-gray-200 flex flex-col items-center justify-center gap-2"
                                style={{ width: pageWidth, height: estimatedHeight }}
                            >
                                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                                <p className="text-gray-300 text-xs">Página {pageNumber}</p>
                            </div>
                        }
                    />
                    {/* Overlay de protección individual */}
                    <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
                </>
            ) : (
                // Skeleton placeholder — mantiene el espacio para scroll estable
                <div
                    className="bg-gray-100/80 rounded-sm border border-gray-200 flex items-center justify-center"
                    style={{ width: pageWidth, height: estimatedHeight }}
                >
                    <p className="text-gray-300 text-xs font-medium select-none">Página {pageNumber}</p>
                </div>
            )}
        </div>
    );
}

// ─── Mobile Page Navigator ────────────────────────────────────────────────────
// En móvil (<768px): una sola página a la vez para evitar múltiples canvases en RAM.
interface MobilePdfNavigatorProps {
    numPages: number;
    pageWidth: number;
    estimatedHeight: number;
}

function MobilePdfNavigator({ numPages, pageWidth, estimatedHeight }: MobilePdfNavigatorProps) {
    const [currentPage, setCurrentPage] = useState(1);

    return (
        <div className="flex flex-col items-center gap-4 py-4 px-2">
            {/* Página actual */}
            <div className="relative w-full flex justify-center">
                <Page
                    pageNumber={currentPage}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    width={pageWidth}
                    className="shadow-xl rounded-sm overflow-hidden"
                    loading={
                        <div
                            className="bg-white animate-pulse rounded-sm border border-gray-200 flex flex-col items-center justify-center gap-2"
                            style={{ width: pageWidth, height: estimatedHeight }}
                        >
                            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                            <p className="text-gray-400 text-sm">Cargando...</p>
                        </div>
                    }
                />
                <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
            </div>

            {/* Controles de navegación */}
            <div className="flex items-center gap-4 bg-black/70 px-4 py-2 rounded-full backdrop-blur-sm sticky bottom-4">
                <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 text-white disabled:opacity-30 active:scale-90 transition-transform"
                    aria-label="Página anterior"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-white text-sm font-bold min-w-[80px] text-center">
                    {currentPage} / {numPages}
                </span>
                <button
                    onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                    disabled={currentPage === numPages}
                    className="p-1 text-white disabled:opacity-30 active:scale-90 transition-transform"
                    aria-label="Página siguiente"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SecureFileViewer({ filePath, fileName, onClose }: SecureFileViewerProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fileType, setFileType] = useState<'pdf' | 'image' | 'docx' | 'xlsx' | 'pptx' | 'other'>('other');
    const [fileBlob, setFileBlob] = useState<Blob | null>(null);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [externalViewerUrl, setExternalViewerUrl] = useState<string | null>(null);
    const [useExternalViewer, setUseExternalViewer] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [numPages, setNumPages] = useState<number | null>(null);
    // Estado clave: el PDF worker está listo — se activa en onLoadSuccess
    const [pdfReady, setPdfReady] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

    const docxContainerRef = useRef<HTMLDivElement>(null);
    const xlsxContainerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Ancho de página del PDF según contexto
    const pdfPageWidth = isFullscreen
        ? windowWidth - 60
        : Math.min(windowWidth - 80, 800);

    // Altura estimada (A4: ratio 1:1.414)
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
        // Resetear pdfReady cuando cambia el archivo
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
            containerRef.current.requestFullscreen().catch(err =>
                console.error(`Error enabling fullscreen: ${err.message}`)
            );
        } else {
            document.exitFullscreen();
        }
    };

    const loadContent = async (forceExternal = false) => {
        setLoading(true);
        setError(null);
        setBlobUrl(null);
        setFileBlob(null);
        setExternalViewerUrl(null);
        setPdfReady(false);
        setNumPages(null);
        if (!forceExternal) setUseExternalViewer(false);

        try {
            const lowerPath = filePath.toLowerCase();
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No hay sesión activa');

            let type: typeof fileType = 'other';
            if (lowerPath.endsWith('.pdf')) type = 'pdf';
            else if (lowerPath.match(/\.(jpg|jpeg|png|webp)$/)) type = 'image';
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
                if (!previewRes.ok) throw new Error('Error generando vista externa');
                const data = await previewRes.json();
                setExternalViewerUrl(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(data.url)}`);
                setLoading(false);
                return;
            }

            const secureUrl = `${baseUrl}/storage/secure-url?path=${encodeURIComponent(cleanPath)}&bucket=course-materials`;
            const blobRes = await fetch(secureUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!blobRes.ok) {
                const errorText = await blobRes.text().catch(() => 'Unknown error');
                throw new Error(`Error ${blobRes.status}: ${errorText}`);
            }

            const blob = await blobRes.blob();
            setFileBlob(blob);
            const objUrl = URL.createObjectURL(blob);
            setBlobUrl(objUrl);

            if (type === 'docx') {
                setTimeout(async () => {
                    if (docxContainerRef.current) {
                        try {
                            await docx.renderAsync(blob, docxContainerRef.current, undefined, {
                                className: 'docx-viewer',
                                inWrapper: true
                            });
                        } catch {
                            setUseExternalViewer(true);
                            loadContent(true);
                        }
                    }
                }, 0);
            }

            if (type === 'xlsx') {
                setTimeout(async () => {
                    try {
                        const arrayBuffer = await blob.arrayBuffer();
                        const workbook = XLSX.read(arrayBuffer);
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        const html = XLSX.utils.sheet_to_html(worksheet);
                        if (xlsxContainerRef.current) {
                            xlsxContainerRef.current.innerHTML = html;
                        }
                    } catch {
                        setUseExternalViewer(true);
                        loadContent(true);
                    }
                }, 0);
            }

        } catch (err: any) {
            setError(err.message || 'Error cargando archivo');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (blobUrl) {
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    // ── Loading state ──
    if (loading && fileType !== 'pptx') {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4 min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-sm text-gray-500 font-medium">Preparando visualización segura...</p>
                <p className="text-xs text-gray-400">Descargando archivo de forma cifrada</p>
            </div>
        );
    }

    if (fileType === 'pptx' && !useExternalViewer) {
        return <SecurePptxViewer filePath={filePath} fileName={fileName} />;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-red-50 rounded-lg min-h-[300px]">
                <AlertCircle className="w-8 h-8 text-red-500 mb-3" />
                <p className="text-red-700 font-semibold mb-1">Error al cargar el archivo</p>
                <p className="text-red-500 text-sm mb-4">{error}</p>
                <div className="flex gap-3">
                    <button onClick={() => loadContent()} className="text-sm text-blue-600 hover:underline font-medium">
                        Reintentar
                    </button>
                    {(fileType === 'docx' || fileType === 'xlsx') && !useExternalViewer && (
                        <button
                            onClick={() => { setUseExternalViewer(true); loadContent(); }}
                            className="text-sm text-orange-600 hover:underline font-medium"
                        >
                            Usar Visor Alternativo
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`w-full ${isFullscreen ? 'h-screen' : 'h-full'} flex flex-col bg-gray-50 min-h-[500px] overflow-hidden rounded-lg relative transition-all duration-300`}
            onContextMenu={(e) => { e.preventDefault(); return false; }}
        >
            {/* Overlay anti-copia pasivo */}
            <div className="absolute inset-0 z-50 pointer-events-none mix-blend-multiply" />

            {/* Botón fullscreen */}
            <div className="absolute top-4 right-4 z-[110] flex gap-2">
                <button
                    onClick={toggleFullscreen}
                    className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm transition-all flex items-center justify-center border border-white/10"
                    title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                >
                    {isFullscreen ? <Minimize className="w-5 h-5 flex-shrink-0" /> : <Maximize className="w-5 h-5 flex-shrink-0" />}
                </button>
            </div>

            <div className={`flex-1 flex flex-col overflow-hidden relative ${isFullscreen ? 'p-0' : ''}`}>

                {/* 1. PDF — Lazy loading por página */}
                {fileType === 'pdf' && blobUrl && (
                    <div
                        className="flex-1 overflow-auto bg-gray-100/50 flex justify-center p-4 scrollbar-thin"
                        onClick={(e) => { if (e.target === e.currentTarget) onClose?.(false); }}
                    >
                        <Document
                            file={blobUrl}
                            options={{
                                cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
                                cMapPacked: true,
                            }}
                            onLoadSuccess={({ numPages: n }) => {
                                setNumPages(n);
                                // CRÍTICO: Solo activar lazy loading una vez que el worker está listo
                                // Pequeño delay para garantizar que el worker está completamente inicializado
                                setTimeout(() => setPdfReady(true), 150);
                            }}
                            onLoadError={(err) => {
                                console.error('PDF Load Error:', err);
                                setError('No se pudo cargar el PDF. Intenta recargar la página.');
                            }}
                            loading={
                                <div className="flex flex-col items-center justify-center p-12">
                                    <Loader2 className="animate-spin text-blue-500 w-8 h-8 mb-2" />
                                    <p className="text-sm text-gray-500">Analizando documento...</p>
                                </div>
                            }
                            className="max-w-full"
                        >
                            {numPages && (
                                isMobile ? (
                                    // Móvil: una página a la vez
                                    <MobilePdfNavigator
                                        numPages={numPages}
                                        pageWidth={Math.min(windowWidth - 32, 600)}
                                        estimatedHeight={Math.round(Math.min(windowWidth - 32, 600) * 1.414)}
                                    />
                                ) : (
                                    // PC: scroll continuo con lazy loading por página
                                    Array.from({ length: numPages }, (_, i) => (
                                        <LazyPdfPage
                                            key={`page_${i + 1}`}
                                            pageNumber={i + 1}
                                            pageWidth={pdfPageWidth}
                                            estimatedHeight={estimatedPageHeight}
                                            pdfReady={pdfReady}
                                        />
                                    ))
                                )
                            )}
                        </Document>
                    </div>
                )}

                {/* 2. DOCX */}
                {fileType === 'docx' && !useExternalViewer && (
                    <div
                        className="flex-1 overflow-auto bg-white p-4 scrollbar-thin"
                        onClick={(e) => { if (e.target === e.currentTarget) onClose?.(false); }}
                    >
                        <div ref={docxContainerRef} className="max-w-[800px] mx-auto docx-content shadow-sm" />
                    </div>
                )}

                {/* 3. XLSX */}
                {fileType === 'xlsx' && !useExternalViewer && (
                    <div
                        className="flex-1 overflow-auto bg-white scrollbar-thin"
                        onClick={(e) => { if (e.target === e.currentTarget) onClose?.(false); }}
                    >
                        <div ref={xlsxContainerRef} className="p-4 overflow-x-auto excel-viewer" />
                    </div>
                )}

                {/* 4. Imagen */}
                {fileType === 'image' && blobUrl && (
                    <div
                        className="flex-1 flex items-center justify-center p-8 overflow-auto scrollbar-thin"
                        onClick={(e) => { if (e.target === e.currentTarget) onClose?.(false); }}
                    >
                        <div className="relative shadow-2xl rounded-xl overflow-hidden group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={blobUrl}
                                alt={fileName}
                                className={`${isFullscreen ? 'h-[90vh] w-auto' : 'max-w-full h-auto'} selection:bg-transparent`}
                                onContextMenu={(e) => e.preventDefault()}
                            />
                            <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
                        </div>
                    </div>
                )}

                {/* 5. Visor externo (Office Online fallback) */}
                {useExternalViewer && externalViewerUrl && (
                    <div className="flex-1 bg-gray-100 h-full relative">
                        <iframe
                            src={externalViewerUrl}
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            title="Document Viewer"
                            className="h-full border-none w-full min-h-[600px]"
                            allowFullScreen
                        />
                        <div className="absolute inset-x-0 top-0 h-10 bg-transparent pointer-events-none z-20" />
                    </div>
                )}

                {/* 6. Tipo no soportado */}
                {!loading && fileType === 'other' && (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
                        <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-6 border border-gray-200">
                            <Lock className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-gray-900 font-bold text-xl mb-2">Vista Previa No Disponible</h3>
                        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                            Este tipo de archivo (.{fileName.split('.').pop()?.toUpperCase()}) no puede visualizarse en el navegador.
                        </p>
                        <Button
                            onClick={handleDownload}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-6 rounded-xl transition-all shadow-lg"
                        >
                            <Download className="w-5 h-5 mr-2" />
                            Descargar Archivo
                        </Button>
                    </div>
                )}

                {/* Overlay global de protección */}
                <div
                    className="fixed inset-0 z-[1000] pointer-events-none select-none"
                    onContextMenu={(e) => e.preventDefault()}
                />
            </div>

            {/* Footer de seguridad */}
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
                .docx-content table { width: 100% !important; border-collapse: collapse; }
                .excel-viewer table { border-collapse: collapse; width: 100%; }
                .excel-viewer th, .excel-viewer td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
                .scrollbar-thin::-webkit-scrollbar { width: 6px; }
                .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
                .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
        </div>
    );
}
