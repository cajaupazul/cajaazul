'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, AlertCircle, FileText, Download, Lock, Maximize, Minimize } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Document, Page, pdfjs } from 'react-pdf';
import * as docx from 'docx-preview';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import SecurePptxViewer from './SecurePptxViewer';

// Worker local para evitar problemas de CORS con CDN
if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface SecureFileViewerProps {
    filePath: string;
    fileName: string;
    onClose?: (open: false) => void;
}

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
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    const docxContainerRef = useRef<HTMLDivElement>(null);
    const xlsxContainerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const pdfFile = useMemo(() => fileBlob || blobUrl, [fileBlob, blobUrl]);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        loadContent();
        return () => {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    }, [filePath]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

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

    const loadContent = async () => {
        setLoading(true);
        setError(null);
        setBlobUrl(null);
        setFileBlob(null);
        setExternalViewerUrl(null);
        setUseExternalViewer(false);

        try {
            const lowerPath = filePath.toLowerCase();
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) throw new Error("No hay sesión activa");

            // 1. Determine Type
            let type: any = 'other';
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

            // 2. Strategy Selection for PPTX
            if (type === 'pptx') {
                setLoading(false);
                return;
            }

            // External viewer fallback
            if (useExternalViewer) {
                const previewRes = await fetch(`${baseUrl}/storage/preview-url?path=${encodeURIComponent(cleanPath)}&bucket=course-materials`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!previewRes.ok) throw new Error("Error generando vista externa");
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
                const errorText = await blobRes.text().catch(() => "Unknown error");
                throw new Error(`Error ${blobRes.status}: ${errorText}`);
            }

            const blob = await blobRes.blob();
            setFileBlob(blob);

            const objUrl = URL.createObjectURL(blob);
            setBlobUrl(objUrl);

            // Client-side rendering (docx/xlsx)
            if (type === 'docx') {
                setTimeout(async () => {
                    if (docxContainerRef.current) {
                        try {
                            await docx.renderAsync(blob, docxContainerRef.current, undefined, {
                                className: 'docx-viewer',
                                inWrapper: true
                            });
                        } catch (e) {
                            setUseExternalViewer(true);
                            loadContent();
                        }
                    }
                }, 0);
            } else if (type === 'xlsx') {
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
                    } catch (e) {
                        setUseExternalViewer(true);
                        loadContent();
                    }
                }, 0);
            }

        } catch (err: any) {
            setError(err.message || "Error cargando archivo");
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

    // Render logic moved after all hooks
    if (loading && fileType !== 'pptx') {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-sm text-gray-500">Preparando visualización segura...</p>
            </div>
        );
    }

    if (fileType === 'pptx' && !useExternalViewer) {
        return <SecurePptxViewer filePath={filePath} fileName={fileName} />;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-red-50 rounded-lg">
                <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                <p className="text-red-700 font-medium">{error}</p>
                <div className="flex gap-4">
                    <button onClick={loadContent} className="mt-4 text-sm text-blue-600 hover:underline">Reintentar</button>
                    {(fileType === 'docx' || fileType === 'xlsx') && !useExternalViewer && (
                        <button
                            onClick={() => { setUseExternalViewer(true); loadContent(); }}
                            className="mt-4 text-sm text-orange-600 hover:underline"
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
            {/* Prevention Overlay (Anti-Copy) */}
            <div className="absolute inset-0 z-50 pointer-events-none mix-blend-multiply" />

            {/* Float Controls (Fullscreen) */}
            <div className="absolute top-4 right-4 z-[110] flex gap-2">
                <button
                    onClick={toggleFullscreen}
                    className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm transition-all flex items-center justify-center border border-white/10"
                    title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                >
                    {isFullscreen ? (
                        <Minimize className="w-5 h-5 flex-shrink-0" />
                    ) : (
                        <Maximize className="w-5 h-5 flex-shrink-0" />
                    )}
                </button>
            </div>

            {/* Content Renderers */}
            <div className={`flex-1 flex flex-col overflow-hidden relative ${isFullscreen ? 'p-0' : ''}`}>
                {/* 1. PDF */}
                {fileType === 'pdf' && pdfFile && (
                    <div className="flex-1 overflow-auto bg-gray-100/50 flex justify-center p-4 scrollbar-thin" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(false); }}>
                        <Document
                            file={pdfFile}
                            cMapUrl={`https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`}
                            cMapPacked={true}
                            onLoadSuccess={({ numPages }) => {
                                setNumPages(numPages);
                            }}
                            onLoadError={(error) => {
                                console.error("PDF Load Error:", error);
                                if (error instanceof Error) {
                                    console.error("Error Message:", error.message);
                                }
                            }}
                            loading={
                                <div className="flex flex-col items-center justify-center p-12">
                                    <Loader2 className="animate-spin text-blue-500 w-8 h-8 mb-2" />
                                    <p className="text-sm text-gray-500">Cargando documento...</p>
                                </div>
                            }
                            className="max-w-full"
                        >
                            {Array.from(new Array(numPages || 0), (_, index) => (
                                <div key={`page_${index + 1}`} className="mb-8 relative transition-all duration-300 hover:shadow-2xl">
                                    <Page
                                        pageNumber={index + 1}
                                        renderTextLayer={true}
                                        renderAnnotationLayer={false}
                                        width={isFullscreen ? (windowWidth - 60) : Math.min(windowWidth - 80, 800)}
                                        className="shadow-xl rounded-sm overflow-hidden"
                                        loading={
                                            <div className="w-full h-[1100px] bg-white animate-pulse rounded-sm border border-gray-100 flex items-center justify-center" style={{ width: isFullscreen ? (windowWidth - 100) : 800 }}>
                                                <p className="text-gray-300 text-sm">Procesando página {index + 1}...</p>
                                            </div>
                                        }
                                    />
                                    {/* Individual page protective overlay */}
                                    <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
                                </div>
                            ))}
                        </Document>
                    </div>
                )}

                {/* 2. DOCX */}
                {fileType === 'docx' && !useExternalViewer && (
                    <div className="flex-1 overflow-auto bg-white p-4 scrollbar-thin" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(false); }}>
                        <div ref={docxContainerRef} className="max-w-[800px] mx-auto docx-content shadow-sm" />
                    </div>
                )}

                {/* 3. XLSX */}
                {fileType === 'xlsx' && !useExternalViewer && (
                    <div className="flex-1 overflow-auto bg-white scrollbar-thin" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(false); }}>
                        <div ref={xlsxContainerRef} className="p-4 overflow-x-auto excel-viewer" />
                    </div>
                )}

                {/* 4. IMAGE */}
                {fileType === 'image' && blobUrl && (
                    <div className="flex-1 flex items-center justify-center p-8 overflow-auto scrollbar-thin" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(false); }}>
                        <div className="relative shadow-2xl rounded-xl overflow-hidden group">
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

                {/* 5. External Fallback (DOCX/XLSX) */}
                {useExternalViewer && externalViewerUrl && (
                    <div className="flex-1 bg-gray-100 h-full relative">
                        <iframe
                            src={externalViewerUrl || ''}
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            title="Document Viewer"
                            className="h-full border-none w-full min-h-[600px]"
                            allowFullScreen
                        />
                        {/* Protective mask for the iframe (partial) */}
                        <div className="absolute inset-x-0 top-0 h-10 bg-transparent pointer-events-none z-20" />
                    </div>
                )}

                {/* 6. Fallback */}
                {!loading && fileType === 'other' && (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
                        <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-6 border border-gray-200">
                            <Lock className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-gray-900 font-bold text-xl mb-2">Vista Previa No Disponible</h3>
                        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                            Este tipo de archivo ({fileName.split('.').pop()?.toUpperCase()}) no puede visualizarse de forma segura en el navegador.
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
                .docx-content table {
                    width: 100% !important;
                    border-collapse: collapse;
                }
                .excel-viewer table {
                    border-collapse: collapse;
                    width: 100%;
                }
                .excel-viewer th, .excel-viewer td {
                    border: 1px solid #e5e7eb;
                    padding: 8px;
                    text-align: left;
                }
                .scrollbar-thin::-webkit-scrollbar {
                    width: 6px;
                }
                .scrollbar-thin::-webkit-scrollbar-track {
                    background: transparent;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 10px;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            `}</style>
        </div>
    );
}
