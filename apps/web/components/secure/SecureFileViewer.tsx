'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, FileText, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Document, Page, pdfjs } from 'react-pdf';
import * as docx from 'docx-preview';
import * as XLSX from 'xlsx';

// Worker for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface SecureFileViewerProps {
    filePath: string;
    fileName: string;
}

export default function SecureFileViewer({ filePath, fileName }: SecureFileViewerProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fileType, setFileType] = useState<'pdf' | 'image' | 'docx' | 'xlsx' | 'pptx' | 'other'>('other');
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [externalViewerUrl, setExternalViewerUrl] = useState<string | null>(null);
    const [numPages, setNumPages] = useState<number | null>(null);

    const docxContainerRef = useRef<HTMLDivElement>(null);
    const xlsxContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadContent();
        return () => {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    }, [filePath]);

    const loadContent = async () => {
        setLoading(true);
        setError(null);
        setBlobUrl(null);
        setExternalViewerUrl(null);

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
            // Handle if filePath is already a URL or has params (cleanup)
            if (filePath.includes('path=')) {
                const urlObj = new URL(filePath, 'http://dummy.com'); // Base dummy if relative
                cleanPath = urlObj.searchParams.get('path') || cleanPath;
            }
            cleanPath = decodeURIComponent(cleanPath);


            // 2. Strategy Selection
            if (type === 'pptx') {
                // FALLBACK STRATEGY: External Viewer (Microsoft)
                // We need a Public Temporary URL from our Worker
                const res = await fetch(`${baseUrl}/storage/preview-url?path=${encodeURIComponent(cleanPath)}&bucket=course-materials`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error("Error generando vista previa segura");

                const data = await res.json();
                // Microsoft Office Online Viewer
                // src must be encoded
                setExternalViewerUrl(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(data.url)}`);
                setLoading(false);
                return;
            }

            // CLIENT-SIDE STRATEGY: Download Blob & Render
            // Fetch Blob from Secure Proxy
            const secureUrl = `${baseUrl}/storage/secure-url?path=${encodeURIComponent(cleanPath)}&bucket=course-materials`;
            const blobRes = await fetch(secureUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!blobRes.ok) throw new Error("No se pudo descargar el archivo");

            const blob = await blobRes.blob();
            const objUrl = URL.createObjectURL(blob);
            setBlobUrl(objUrl);

            // Render Logic based on type
            if (type === 'docx') {
                if (docxContainerRef.current) {
                    await docx.renderAsync(blob, docxContainerRef.current, docxContainerRef.current, {
                        className: 'docx-viewer',
                        inWrapper: true,
                        ignoreWidth: false,
                        ignoreHeight: false
                    });
                }
            } else if (type === 'xlsx') {
                const arrayBuffer = await blob.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer);
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const html = XLSX.utils.sheet_to_html(worksheet);
                if (xlsxContainerRef.current) {
                    xlsxContainerRef.current.innerHTML = html;
                }
            }

            // PDF & Image handled by components using blobUrl

        } catch (err: any) {
            console.error("Error loading secure file:", err);
            setError(err.message || "Error cargando archivo");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-sm text-gray-500">Preparando visualización segura...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-red-50 rounded-lg">
                <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                <p className="text-red-700 font-medium">{error}</p>
                <button onClick={loadContent} className="mt-4 text-sm text-blue-600 hover:underline">Reintentar</button>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col bg-gray-50 min-h-[500px] overflow-hidden rounded-lg relative">
            {/* Prevention Overlay (Anti-Copy) */}
            <div className="absolute inset-0 z-50 pointer-events-none mix-blend-multiply" />

            {/* Content Renderers */}

            {/* 1. PDF */}
            {fileType === 'pdf' && blobUrl && (
                <div className="flex-1 overflow-auto bg-gray-100 flex justify-center p-4">
                    <Document
                        file={blobUrl}
                        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                        loading={<Loader2 className="animate-spin" />}
                        className="max-w-full"
                    >
                        {Array.from(new Array(numPages), (el, index) => (
                                        </div>
                                    }
                                />
            {/* Individual page protective overlay */}
            <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
        </div>
    ))
}
                    </Document >
                )}

{
    !loading && fileType === 'image' && downloadUrl && (
        <div className="relative shadow-2xl rounded-xl overflow-hidden">
            <img src={downloadUrl} alt={fileName} className="max-w-full h-auto" />
        </div>
    )
}

{
    !loading && fileType === 'other' && (
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
    )
}

{/* Global Protection Overlay (Passive) */ }
<div
    className="fixed inset-0 z-[1000] pointer-events-none select-none"
    onContextMenu={(e) => e.preventDefault()}
/>
            </div >

    {/* Security Footer */ }
    < div className = "bg-[#121212]/95 border-t border-white/5 p-3 text-center z-[100]" >
        <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-2">
            <span className="w-1 h-1 bg-red-600 rounded-full shadow-[0_0_8px_rgba(220,38,38,1)] animate-pulse" />
            Lectura Protegida • CampusLink Security v2.5
        </p>
            </div >

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
        </div >
    );
}
