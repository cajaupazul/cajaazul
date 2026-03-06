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
}

export default function SecureFileModal({ isOpen, onClose, filePath, fileName }: SecureFileModalProps) {
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
            <DialogContent className="p-0 overflow-hidden bg-transparent border-none shadow-none text-white w-full h-[100dvh] max-w-none sm:max-w-6xl sm:w-[98vw] sm:h-[95vh] fixed inset-0 sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] translate-x-0 translate-y-0 rounded-none sm:rounded-2xl z-[99999] [&>button]:text-white [&>button]:bg-white/10 [&>button]:hover:bg-white/20 [&>button]:rounded-full [&>button]:p-2 [&>button]:right-6 [&>button]:top-6 [&>button]:transition-all">
                <div className="sr-only">
                    <DialogTitle>Visor de Documento Seguro</DialogTitle>
                    <DialogDescription>Visualización protegida del archivo seleccionado</DialogDescription>
                </div>
                <SecureFileViewer filePath={filePath} fileName={fileName || 'Documento'} onClose={() => handleOpenChange(false)} />
            </DialogContent>
        </Dialog>
    );
}
