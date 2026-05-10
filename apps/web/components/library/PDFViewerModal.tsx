'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Maximize2, Minimize2, Download } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';

interface PDFViewerModalProps {
  url: string | null;
  title: string;
  isOpen: boolean;
  onClose: () => void;
}

export const PDFViewerModal: React.FC<PDFViewerModalProps> = ({ 
  url, 
  title, 
  isOpen, 
  onClose 
}) => {
  const { colors } = useTheme();

  if (!url) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[100vw] w-full h-[100vh] p-0 bg-bb-dark border-0 rounded-none overflow-hidden flex flex-col z-[100]">
        <DialogHeader className="h-16 px-6 bg-bb-sidebar border-b border-bb-border flex flex-row items-center justify-between shrink-0">
          <div className="flex flex-col min-w-0">
            <DialogTitle className="text-bb-text text-sm md:text-base font-bold truncate">
              {title}
            </DialogTitle>
            <p className="text-[10px] text-bb-text-secondary uppercase tracking-widest font-black">Lector de Biblioteca</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open(url, '_blank')}
              className="text-bb-text-secondary hover:text-white hover:bg-white/10"
              title="Descargar PDF"
            >
              <Download className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-bb-text-secondary hover:text-red-500 hover:bg-red-500/10"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-bb-dark relative overflow-hidden">
          <iframe
            src={`${url}#toolbar=1&navpanes=0&scrollbar=1`}
            className="w-full h-full border-none"
            title={title}
          />
          
          {/* Custom Overlay message for some browsers */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/10">
              <p className="text-white text-xs font-bold">Usa los controles del navegador para navegar por las páginas</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
