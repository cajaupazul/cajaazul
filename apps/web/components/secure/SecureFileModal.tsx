'use client';

import { useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import dynamic from 'next/dynamic';

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

export default function SecureFileModal({ isOpen, onClose, filePath, fileName, useAdvancedViewer, bucket }: SecureFileModalProps) {
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

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent 
                style={{ left: 'auto', right: 0, top: 0, bottom: 0, transform: 'none' }}
                className="p-0 overflow-visible bg-[#f5f5f5] border-none shadow-2xl text-white w-full h-[100dvh] max-w-none sm:w-[95vw] md:w-[92vw] lg:w-[1200px] fixed !rounded-none sm:!rounded-none z-[99999] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right-full data-[state=closed]:slide-out-to-right-full duration-700 ease-out [&>button]:text-white [&>button]:hover:text-white [&>button]:hover:bg-slate-800 [&>button]:bg-[#0B132B] [&>button]:!rounded-none [&>button]:w-12 [&>button]:h-12 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:!right-auto [&>button]:!-left-12 [&>button]:!top-0 [&>button]:transition-all [&>button]:z-[999999] [&>button]:shadow-lg [&>button]:opacity-100"
            >
                <div className="sr-only">
                    <DialogTitle>Visor de Documento Seguro</DialogTitle>
                    <DialogDescription>Visualización protegida del archivo seleccionado</DialogDescription>
                </div>
                <SecureFileViewer filePath={filePath} fileName={fileName || 'Documento'} useAdvancedViewer={useAdvancedViewer} onClose={() => handleOpenChange(false)} bucket={bucket} />
            </DialogContent>
        </Dialog>
    );
}
