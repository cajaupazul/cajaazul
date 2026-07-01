'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';

const SecureFileViewer = dynamic(() => import('./SecureFileViewer'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full bg-[#f5f5f5] text-zinc-500 text-sm">
            Cargando visor...
        </div>
    )
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
 * Mide el ancho real de la sidebar buscando el primer elemento fixed
 * anclado al borde izquierdo de la pantalla con altura considerable.
 * Se actualiza automáticamente cuando la sidebar se abre o cierra.
 */
function useSidebarOffset() {
    const [offset, setOffset] = useState(0);

    const measure = useCallback(() => {
        // En móvil la sidebar no ocupa espacio (es overlay)
        if (typeof window === 'undefined' || window.innerWidth < 768) {
            setOffset(0);
            return;
        }

        // La sidebar del layout tiene clase 'w-72' y es fixed/relative
        // Buscamos el primer hijo del flex container que esté alineado a la izquierda
        const sidebarCandidates = document.querySelectorAll<HTMLElement>(
            'div.fixed.h-full, nav.fixed.h-full, aside.fixed.h-full'
        );

        let found = 0;
        sidebarCandidates.forEach(el => {
            const rect = el.getBoundingClientRect();
            // Debe estar en el borde izquierdo, tener ancho razonable y altura de pantalla completa
            if (
                rect.left <= 2 &&
                rect.width >= 60 &&
                rect.height >= window.innerHeight * 0.7
            ) {
                found = Math.max(found, rect.width);
            }
        });

        setOffset(found);
    }, []);

    useEffect(() => {
        measure();

        const ro = new ResizeObserver(measure);
        ro.observe(document.documentElement);

        // Observar cambios de clase/style en la sidebar para detectar cuando se abre/cierra
        const mo = new MutationObserver((mutations) => {
            // Solo reaccionar a cambios de clase o transform en elementos hijos directos del body
            const relevant = mutations.some(m =>
                m.type === 'attributes' &&
                (m.attributeName === 'class' || m.attributeName === 'style') &&
                (m.target as HTMLElement).matches?.('div, nav, aside')
            );
            if (relevant) measure();
        });

        mo.observe(document.body, {
            attributes: true,
            attributeFilter: ['class', 'style'],
            subtree: true
        });

        window.addEventListener('resize', measure);

        return () => {
            ro.disconnect();
            mo.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [measure]);

    return offset;
}

export default function SecureFileModal({
    isOpen,
    onClose,
    filePath,
    fileName,
    useAdvancedViewer,
    bucket,
}: SecureFileModalProps) {
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);
    const sidebarOffset = useSidebarOffset();

    // Montar el portal cuando isOpen cambia a true
    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            // Pequeño delay para que el DOM monte el elemento antes de iniciar la transición
            const t = setTimeout(() => setVisible(true), 20);

            window.history.pushState({ secureModal: true }, '');
            const handlePop = () => onClose();
            window.addEventListener('popstate', handlePop);

            return () => {
                clearTimeout(t);
                window.removeEventListener('popstate', handlePop);
            };
        } else {
            setVisible(false);
            // Esperar que termine la animación de salida antes de desmontar
            const t = setTimeout(() => setMounted(false), 750);
            return () => clearTimeout(t);
        }
    }, [isOpen, onClose]);

    const handleClose = useCallback(() => {
        onClose();
        if (window.history.state?.secureModal) {
            window.history.back();
        }
    }, [onClose]);

    if (!mounted || !filePath) return null;

    // Ancho del panel = viewport total menos el ancho de la sidebar
    // Si la sidebar está cerrada/en móvil, usa todo el ancho
    const panelLeft = sidebarOffset;

    return createPortal(
        <>
            {/* ── Backdrop ───────────────────────────────────── */}
            <div
                aria-hidden="true"
                onClick={handleClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 99990,
                    background: 'rgba(0,0,0,0.35)',
                    backdropFilter: 'blur(2px)',
                    opacity: visible ? 1 : 0,
                    transition: 'opacity 700ms ease',
                    pointerEvents: visible ? 'auto' : 'none',
                }}
            />

            {/* ── Panel deslizante ───────────────────────────── */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Visor de documento"
                style={{
                    position: 'fixed',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: panelLeft,          // Se adapta automáticamente a la sidebar
                    zIndex: 99999,
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#f5f5f5',
                    boxShadow: '-8px 0 40px rgba(0,0,0,0.3)',
                    // Animación: entra desde la derecha
                    transform: visible ? 'translateX(0)' : 'translateX(100%)',
                    transition: 'transform 750ms cubic-bezier(0.32, 0, 0.16, 1), left 300ms ease',
                    overflow: 'hidden',
                    userSelect: 'none',
                }}
            >
                {/* ── Botón Cerrar (X) — esquina superior derecha ── */}
                <button
                    onClick={handleClose}
                    aria-label="Cerrar visor de documento"
                    title="Cerrar"
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: '16px',
                        zIndex: 100,
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.9)',
                        border: '1px solid rgba(0,0,0,0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        transition: 'transform 150ms ease, background 150ms ease',
                    }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)';
                        (e.currentTarget as HTMLButtonElement).style.background = 'white';
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.9)';
                    }}
                >
                    <X size={16} strokeWidth={2.5} color="#333" />
                </button>

                {/* ── Contenido: visor del archivo ─────────────── */}
                <SecureFileViewer
                    filePath={filePath}
                    fileName={fileName || 'Documento'}
                    useAdvancedViewer={useAdvancedViewer}
                    onClose={handleClose}
                    bucket={bucket}
                />
            </div>
        </>,
        document.body
    );
}
