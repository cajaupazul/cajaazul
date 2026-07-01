'use client';

import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';

const SecureFileViewer = dynamic(() => import('./SecureFileViewer'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full text-white/50">Cargando visor...</div>
});

interface SecureFileModalProps {
    isOpen: boolean;
    onClose: () => void;
    filePath: string | null;
    fileName: string | null;
    useAdvancedViewer?: boolean;
    bucket?: string;
}

/**
 * Hook para detectar el ancho real de la sidebar en el DOM.
 * Busca el elemento de la barra lateral por su ID/clase y observa sus cambios de tamaño.
 */
function useSidebarWidth(isOpen: boolean) {
    const [sidebarWidth, setSidebarWidth] = useState(0);

    const measure = useCallback(() => {
        // La sidebar tiene la clase 'sidebar-nav' o podemos buscarla por su posición fixed a la izquierda
        // Buscamos el primer elemento fixed en el lado izquierdo con un width > 0
        const candidates = document.querySelectorAll('[class*="sidebar"], nav[class*="fixed"], aside[class*="fixed"]');
        let found = 0;
        candidates.forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.left === 0 && rect.width > 50 && rect.height > 200) {
                found = rect.width;
            }
        });
        setSidebarWidth(found);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        measure();

        const observer = new ResizeObserver(measure);
        const candidates = document.querySelectorAll('[class*="sidebar"], nav[class*="fixed"], aside[class*="fixed"]');
        candidates.forEach(el => observer.observe(el));
        window.addEventListener('resize', measure);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [isOpen, measure]);

    return sidebarWidth;
}

export default function SecureFileModal({ isOpen, onClose, filePath, fileName, useAdvancedViewer, bucket }: SecureFileModalProps) {
    const sidebarWidth = useSidebarWidth(isOpen);

    useEffect(() => {
        if (isOpen) {
            window.history.pushState({ secureModal: true }, '');
            const handlePopState = () => onClose();
            window.addEventListener('popstate', handlePopState);
            return () => window.removeEventListener('popstate', handlePopState);
        }
    }, [isOpen, onClose]);

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            onClose();
            if (window.history.state?.secureModal) {
                window.history.back();
            }
        }
    };

    if (!filePath) return null;

    // Ancho del panel: todo el espacio disponible a la derecha de la sidebar
    const panelStyle: React.CSSProperties = {
        left: 'auto',
        right: 0,
        top: 0,
        bottom: 0,
        transform: 'none',
        // Si la sidebar tiene ancho detectado, el panel ocupa el resto. Si no, ocupa casi todo
        width: sidebarWidth > 0 ? `calc(100vw - ${sidebarWidth}px)` : '100vw',
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent
                style={panelStyle}
                className="p-0 overflow-visible bg-[#f5f5f5] border-none shadow-2xl text-white max-w-none h-[100dvh] fixed !rounded-none sm:!rounded-none z-[99999] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right-full data-[state=closed]:slide-out-to-right-full duration-700 ease-out [&>button]:hidden"
            >
                <div className="sr-only">
                    <DialogTitle>Visor de Documento Seguro</DialogTitle>
                    <DialogDescription>Visualización protegida del archivo seleccionado</DialogDescription>
                </div>

                {/* Botón de cierre estilo Blackboard — pestaña plegada sobresaliendo a la izquierda */}
                <button
                    onClick={() => handleOpenChange(false)}
                    aria-label="Cerrar visor"
                    className="absolute top-0 -left-[52px] w-[52px] h-[52px] bg-[#0B132B] hover:bg-[#162548] transition-colors z-[999999] flex items-center justify-center"
                    style={{
                        // Efecto de esquina doblada: corte diagonal en la esquina inferior-izquierda
                        clipPath: 'polygon(0 0, 100% 0, 100% 100%, 30% 100%, 0 68%)',
                        boxShadow: '-4px 4px 12px rgba(0,0,0,0.4)',
                    }}
                    title="Cerrar"
                >
                    <X className="w-5 h-5 text-white" strokeWidth={2.5} />
                </button>

                <SecureFileViewer
                    filePath={filePath}
                    fileName={fileName || 'Documento'}
                    useAdvancedViewer={useAdvancedViewer}
                    onClose={() => handleOpenChange(false)}
                    bucket={bucket}
                />
            </DialogContent>
        </Dialog>
    );
}
