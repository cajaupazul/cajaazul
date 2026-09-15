'use client';

import React, { useEffect, useState, useRef } from 'react';

interface EndfieldLoadingScreenProps {
    isReady: boolean;
    onFinished?: () => void;
}

const STORE_LOADING_YELLOW = '#facc15';
const STORE_LOADING_TRACK = 'rgba(250, 204, 21, 0.2)';

export default function EndfieldLoadingScreen({
    isReady,
    onFinished
}: EndfieldLoadingScreenProps) {
    const [progress, setProgress] = useState(0);
    const [phase, setPhase] = useState<'loading' | 'completed' | 'transition' | 'done'>('loading');
    const [pctTopPx, setPctTopPx] = useState(20);

    const containerRef = useRef<HTMLDivElement>(null);
    const progressRef = useRef(0);
    const isReadyRef = useRef(isReady);
    const hasReached100Ref = useRef(false);

    // Actualizar referencia de isReady
    useEffect(() => {
        isReadyRef.current = isReady;
    }, [isReady]);

    // Manejar resize del contenedor para reposicionar el porcentaje en Desktop
    useEffect(() => {
        const updatePosition = () => {
            if (!containerRef.current) return;
            const height = containerRef.current.clientHeight;
            const labelHeight = 82;
            const edgeGap = 20;
            const progressY = (progressRef.current / 100) * height;
            const centeredTop = progressY - labelHeight / 2;
            setPctTopPx(Math.max(edgeGap, Math.min(centeredTop, height - labelHeight - edgeGap)));
        };

        updatePosition();
        const observer = new ResizeObserver(updatePosition);
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Bucle de incremento fluido de progreso sin saltos bruscos
    useEffect(() => {
        let animationFrameId: number;
        let lastTime = performance.now();

        const updateProgress = (now: number) => {
            const delta = Math.min((now - lastTime) / 1000, 0.1); // Proteger contra pausas de pestaña
            lastTime = now;

            const current = progressRef.current;
            const ready = isReadyRef.current;

            let next = current;

            if (ready) {
                // Cuando está listo, subir hacia 100% de forma progresiva y elegante (sin saltos instantáneos)
                const remaining = 100 - current;
                // Velocidad suave: tarda al menos 400-600ms en recorrer el tramo final hacia 100
                const speed = Math.max(35, remaining * 3.5);
                next = Math.min(100, current + speed * delta);
            } else {
                // Mientras espera a que los recursos carguen:
                if (current < 35) {
                    next = current + 42 * delta; // Primeros números suben a buen ritmo
                } else if (current < 65) {
                    next = current + 26 * delta;
                } else if (current < 85) {
                    next = current + 12 * delta;
                } else if (current < 94) {
                    next = current + 3.5 * delta; // Avance sutil para no congelarse
                }
            }

            progressRef.current = next;
            setProgress(next);

            // Calcular posición vertical dentro del contenedor (Desktop)
            if (containerRef.current) {
                const height = containerRef.current.clientHeight;
                const labelHeight = 82;
                const edgeGap = 20;
                const progressY = (next / 100) * height;
                const centeredTop = progressY - labelHeight / 2;
                setPctTopPx(Math.max(edgeGap, Math.min(centeredTop, height - labelHeight - edgeGap)));
            }

            // Al tocar el 100% exacto:
            if (next >= 100 && !hasReached100Ref.current) {
                hasReached100Ref.current = true;
                setPhase('completed');

                // Pausa deliberada de 280ms para que el usuario aprecie el "100% System Ready"
                setTimeout(() => {
                    setPhase('transition');
                }, 280);
            } else if (next < 100) {
                animationFrameId = requestAnimationFrame(updateProgress);
            }
        };

        animationFrameId = requestAnimationFrame(updateProgress);

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, []);

    // Manejar la animación de salida de la cortina amarilla
    useEffect(() => {
        if (phase === 'transition') {
            const timer = setTimeout(() => {
                setPhase('done');
                if (onFinished) {
                    onFinished();
                }
            }, 1050); // Duración de la cortina amarilla
            return () => clearTimeout(timer);
        }
    }, [phase, onFinished]);

    if (phase === 'done') {
        return null;
    }

    const floorPct = Math.min(100, Math.floor(progress));
    const visibleProgress = Math.max(2, Math.min(100, progress));
    const isCompleted = floorPct >= 100;

    return (
        <div
            ref={containerRef}
            role="progressbar"
            aria-live="polite"
            aria-label={`Cargando tienda: ${floorPct}%`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={floorPct}
            className="absolute inset-0 z-40 h-full min-h-0 select-none overflow-hidden bg-[var(--bb-dark)] text-[var(--bb-text)] transition-colors duration-200"
        >
            {/* ── OVERLAY AMARILLO (CORTINA EXPANSIVA DENTRO DEL CONTENEDOR) ── */}
            <div
                className={`pointer-events-none absolute inset-0 z-50 transition-all ${
                    phase === 'transition' ? 'opacity-100' : 'opacity-0'
                }`}
                style={{
                    backgroundColor: STORE_LOADING_YELLOW,
                    width: phase === 'transition' ? '100%' : '0%',
                    transform: phase === 'transition' ? 'translateX(0%)' : 'translateX(0%)',
                    animation: phase === 'transition' ? 'endfieldYellowWipe 1.05s cubic-bezier(0.76, 0, 0.24, 1) forwards' : 'none'
                }}
            />

            {/* ── PANTALLA PRINCIPAL DE CARGA (CONFINADA AL ÁREA DE TIENDA) ── */}
            <div className={`relative h-full w-full text-[var(--bb-text)] transition-opacity duration-150 ${phase === 'transition' ? 'opacity-0' : 'opacity-100'}`}>

                {/* ─────────────────── DESKTOP ( >= 641px ) ─────────────────── */}
                <div className="hidden sm:block">
                    {/* Barra vertical izquierda que crece hacia abajo */}
                    <div
                        aria-hidden="true"
                        className="absolute bottom-0 left-0 top-0 z-20 w-[6px] overflow-hidden"
                        style={{ backgroundColor: STORE_LOADING_TRACK }}
                    >
                        <div
                            className="absolute left-0 top-0 w-full transition-[height] duration-75 ease-out"
                            style={{
                                height: `${visibleProgress}%`,
                                backgroundColor: STORE_LOADING_YELLOW
                            }}
                        />
                    </div>

                    {/* Porcentaje que sigue la punta de la barra */}
                    <div
                        className="absolute left-[26px] z-20 flex flex-col transition-[top] duration-75 ease-out"
                        style={{
                            top: `${pctTopPx}px`
                        }}
                    >
                        <div className="flex items-baseline text-[54px] font-semibold leading-none tracking-[-1px]" style={{ color: STORE_LOADING_YELLOW }}>
                            <span>{floorPct}</span>
                            <span className="text-[26px] font-normal ml-0.5">%</span>
                        </div>
                        <div className={`mt-1 font-mono text-[11px] uppercase tracking-[1.5px] transition-colors ${isCompleted ? 'font-bold' : 'text-[var(--bb-text-secondary)]'}`} style={isCompleted ? { color: STORE_LOADING_YELLOW } : undefined}>
                            {isCompleted ? 'SYSTEM READY' : 'UPDATING...'}
                        </div>
                    </div>

                    {/* Logo central Desktop */}
                    <div className="absolute left-[54%] top-[45%] z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col text-[var(--bb-text)] select-none">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.42em] text-[var(--bb-text-secondary)]">
                                CAMPUSLINK
                            </span>
                            <div className="h-[2px] w-5 bg-yellow-400 opacity-90" />
                        </div>
                        <div className="flex items-baseline font-black leading-none tracking-[-0.04em]">
                            <span className="text-[58px] font-black uppercase text-[var(--bb-text)] drop-shadow-sm">
                                KUBBO
                            </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-[32px] font-black uppercase tracking-[0.14em] text-[var(--bb-text)]">
                                STORE
                            </span>
                            <div className="relative flex h-8 w-8 items-center justify-center rounded-md border border-[var(--bb-border)] bg-[var(--bb-card)] shadow-inner">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <polygon points="12,2 21,7 12,12 3,7" fill="#facc15" />
                                    <polygon points="3,7 12,12 12,22 3,17" fill="currentColor" opacity="0.8" />
                                    <polygon points="12,12 21,7 21,17 12,22" fill="currentColor" opacity="0.45" />
                                    <line x1="12" y1="2" x2="12" y2="12" stroke="#18181b" strokeWidth="1.2" />
                                    <line x1="3" y1="7" x2="12" y2="12" stroke="#18181b" strokeWidth="1.2" />
                                    <line x1="21" y1="7" x2="12" y2="12" stroke="#18181b" strokeWidth="1.2" />
                                </svg>
                                <span className="absolute -bottom-1 -right-1 h-1.5 w-1.5 bg-yellow-400" />
                            </div>
                        </div>
                    </div>

                    {/* Bloque técnico Desktop */}
                    <div className="absolute left-[54%] top-[45%] z-20 flex -translate-x-1/2 translate-y-[85px] items-start gap-2.5 text-[var(--bb-text-secondary)] opacity-60">
                        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="block mt-0.5 shrink-0">
                            <polygon points="10,2 18,16 2,16" stroke="currentColor" strokeWidth="1.2" fill="none" />
                            <polygon points="10,7 15,14 5,14" fill="currentColor" opacity="0.45" />
                        </svg>
                        <div className="text-[8px] tracking-[2px] leading-[1.9] uppercase font-mono">
                            KUBBO STORE PROTOCOL // V2.0<br />
                            SYSTEM INTERFACES & COSMETICS<br />
                            ■■ ■■ ■■ ■■ ■■<br />
                            ■■ ■■ ■■ ■■ ■■
                        </div>
                    </div>

                    {/* Línea divisora y slogan */}
                    <div className="absolute bottom-[18%] left-0 right-0 z-20 h-px bg-[var(--bb-border)]" />
                    <div className="absolute bottom-[calc(18%-32px)] left-[54%] z-20 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] uppercase tracking-[5px] text-[var(--bb-text-secondary)]">
                        CAMPUSLINK / KUBBO STORE
                    </div>
                </div>

                {/* ─────────────────── MÓVIL ( <= 640px ) ─────────────────── */}
                <div className="relative block h-full min-h-0 w-full sm:hidden">
                    {/* Logo móvil centrado */}
                    <div className="absolute left-1/2 top-[38%] z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col text-[var(--bb-text)] select-none">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-[8px] font-bold uppercase tracking-[0.42em] text-[var(--bb-text-secondary)]">
                                CAMPUSLINK
                            </span>
                            <div className="h-[2px] w-4 bg-yellow-400 opacity-90" />
                        </div>
                        <div className="flex items-baseline font-black leading-none tracking-[-0.04em]">
                            <span className="text-[46px] font-black uppercase text-[var(--bb-text)] drop-shadow-sm">
                                KUBBO
                            </span>
                        </div>
                        <div className="flex items-center gap-2.5 mt-1">
                            <span className="text-[26px] font-black uppercase tracking-[0.14em] text-[var(--bb-text)]">
                                STORE
                            </span>
                            <div className="relative flex h-7 w-7 items-center justify-center rounded-md border border-[var(--bb-border)] bg-[var(--bb-card)] shadow-inner">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                                    <polygon points="12,2 21,7 12,12 3,7" fill="#facc15" />
                                    <polygon points="3,7 12,12 12,22 3,17" fill="currentColor" opacity="0.8" />
                                    <polygon points="12,12 21,7 21,17 12,22" fill="currentColor" opacity="0.45" />
                                    <line x1="12" y1="2" x2="12" y2="12" stroke="#18181b" strokeWidth="1.2" />
                                    <line x1="3" y1="7" x2="12" y2="12" stroke="#18181b" strokeWidth="1.2" />
                                    <line x1="21" y1="7" x2="12" y2="12" stroke="#18181b" strokeWidth="1.2" />
                                </svg>
                                <span className="absolute -bottom-0.5 -right-0.5 h-1 w-1 bg-yellow-400" />
                            </div>
                        </div>
                    </div>

                    {/* Bloque técnico móvil */}
                    <div className="absolute bottom-[calc(26%+70px)] left-[24px] z-20 flex flex-col gap-1 text-[var(--bb-text-secondary)] opacity-60">
                        <div className="flex items-center gap-1.5">
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                                <polygon points="10,2 18,16 2,16" stroke="currentColor" strokeWidth="1.2" fill="none" />
                                <polygon points="10,7 15,14 5,14" fill="currentColor" opacity="0.45" />
                            </svg>
                            <span className="font-mono text-[8px] uppercase tracking-[2px]">
                                KUBBO STORE PROTOCOL
                            </span>
                        </div>
                        <div className="font-mono text-[7px] tracking-[2px] opacity-60">
                            ■■ ■■ ■■ ■■ ■■ ■■ ■■ ■■
                        </div>
                    </div>

                    {/* Porcentaje móvil */}
                    <div className="absolute left-[24px] bottom-[calc(26%+8px)] z-20 flex flex-col">
                        <div className="flex items-baseline text-[44px] font-semibold leading-none tracking-[-1px]" style={{ color: STORE_LOADING_YELLOW }}>
                            <span>{floorPct}</span>
                            <span className="text-[22px] font-normal ml-0.5">%</span>
                        </div>
                        <div className={`mt-1 font-mono text-[10px] uppercase tracking-[1.5px] transition-colors ${isCompleted ? 'font-bold' : 'text-[var(--bb-text-secondary)]'}`} style={isCompleted ? { color: STORE_LOADING_YELLOW } : undefined}>
                            {isCompleted ? 'SYSTEM READY' : 'UPDATING...'}
                        </div>
                    </div>

                    {/* Barra horizontal móvil que crece hacia la derecha */}
                    <div
                        aria-hidden="true"
                        className="absolute bottom-[26%] left-0 right-0 z-20 h-1 overflow-hidden"
                        style={{ backgroundColor: STORE_LOADING_TRACK }}
                    >
                        <div
                            className="h-full transition-[width] duration-75 ease-out"
                            style={{
                                width: `${visibleProgress}%`,
                                backgroundColor: STORE_LOADING_YELLOW
                            }}
                        />
                    </div>

                    {/* Slogan móvil inferior */}
                    <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-[var(--bb-border)] p-4 text-center font-mono text-[9px] uppercase tracking-[3px] text-[var(--bb-text-secondary)]">
                        CAMPUSLINK / KUBBO STORE
                    </div>
                </div>

            </div>

            {/* Estilo para la animación keyframe del barrido amarillo */}
            <style jsx global>{`
                @keyframes endfieldYellowWipe {
                    0% {
                        width: 0%;
                        transform: translateX(0%);
                    }
                    45% {
                        width: 100%;
                        transform: translateX(0%);
                    }
                    55% {
                        width: 100%;
                        transform: translateX(0%);
                    }
                    100% {
                        width: 100%;
                        transform: translateX(100%);
                    }
                }
            `}</style>
        </div>
    );
}
