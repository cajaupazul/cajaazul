'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
    Pencil,
    Eraser,
    Trash2,
    Save,
    RotateCcw,
    Maximize,
    CheckCircle2,
    Minimize2,
    Undo2,
    Redo2,
    Hand
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Point {
    x: number;
    y: number;
}

interface Path {
    points: Point[];
    mode: 'draw' | 'stamp';
    color: string;
    size?: number;
}

interface FlowchartCanvasProps {
    imageUrl: string;
    initialData?: Path[];
    onSave: (data: Path[]) => void;
    isSaving?: boolean;
}

export default function FlowchartCanvas({
    imageUrl,
    initialData = [],
    onSave,
    isSaving = false
}: FlowchartCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // React State for UI
    const [mode, setMode] = useState<'draw' | 'stamp' | 'erase' | 'pan'>('draw');
    const [color, setColor] = useState('#10b981');
    const [brushSize, setBrushSize] = useState(15);
    const [scale, setScale] = useState(1);
    const [isImmersive, setIsImmersive] = useState(false);
    const [stampImage, setStampImage] = useState<HTMLImageElement | null>(null);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [historyLength, setHistoryLength] = useState(1);

    // Refs for interaction state (to avoid stale closures and high-perf updates)
    const state = useRef({
        paths: initialData as Path[],
        history: [initialData] as Path[][],
        historyIndex: 0,
        currentPath: [] as Point[],
        scale: 1,
        offset: { x: 0, y: 0 },
        isPanning: false,
        isDrawing: false,
        lastMousePos: { x: 0, y: 0 },
        imageSize: { width: 0, height: 0 },
        touchDist: null as number | null,
        mode: 'draw' as 'draw' | 'stamp' | 'erase' | 'pan',
        color: '#10b981',
        brushSize: 15,
        needsRender: true
    });

    const STAMP_SIZE = 140;
    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#ffffff', '#000000'];

    // Sync React state to Ref for persistent access in listeners
    useEffect(() => { state.current.mode = mode; }, [mode]);
    useEffect(() => { state.current.color = color; }, [color]);
    useEffect(() => { state.current.brushSize = brushSize; }, [brushSize]);

    // Load Stamp Image
    useEffect(() => {
        const loadStamp = async () => {
            const urls = [
                '/cellos/Gemini_Generated_Image_1cxzh91cxzh91cxz.png',
                '/cellos/aprov.svg',
                '/cellos/cello',
                '/icons/stamp-approved.svg'
            ];
            for (const url of urls) {
                try {
                    const img = new Image();
                    img.src = url;
                    await new Promise((resolve, reject) => {
                        img.onload = () => resolve(true);
                        img.onerror = reject;
                    });
                    setStampImage(img);
                    return;
                } catch (e) { }
            }
        };
        loadStamp();
    }, []);

    const addToHistory = useCallback((newPaths: Path[]) => {
        const newHistory = state.current.history.slice(0, state.current.historyIndex + 1);
        newHistory.push([...newPaths]);
        if (newHistory.length > 50) newHistory.shift();

        state.current.history = newHistory;
        state.current.historyIndex = newHistory.length - 1;
        state.current.paths = newPaths;

        setHistoryIndex(state.current.historyIndex);
        setHistoryLength(newHistory.length);
        state.current.needsRender = true;
    }, []);

    const undo = () => {
        if (state.current.historyIndex > 0) {
            state.current.historyIndex--;
            state.current.paths = [...state.current.history[state.current.historyIndex]];
            setHistoryIndex(state.current.historyIndex);
            state.current.needsRender = true;
        }
    };

    const redo = () => {
        if (state.current.historyIndex < state.current.history.length - 1) {
            state.current.historyIndex++;
            state.current.paths = [...state.current.history[state.current.historyIndex]];
            setHistoryIndex(state.current.historyIndex);
            state.current.needsRender = true;
        }
    };

    const handleResetZoom = useCallback(() => {
        if (containerRef.current && state.current.imageSize.width > 0) {
            const container = containerRef.current;
            const iw = state.current.imageSize.width;
            const ih = state.current.imageSize.height;
            const cw = container.clientWidth;
            const ch = container.clientHeight;

            const pad = 40;
            const fs = Math.min((cw - pad) / iw, (ch - pad) / ih, 1.0);

            state.current.scale = fs;
            state.current.offset = {
                x: (cw - iw * fs) / 2,
                y: (ch - ih * fs) / 2
            };
            setScale(fs);
            state.current.needsRender = true;
        }
    }, []);

    // Initial Centering on load or immersive toggle
    useEffect(() => {
        const img = new Image();
        img.src = imageUrl;
        img.onload = () => {
            state.current.imageSize = { width: img.width, height: img.height };
            if (canvasRef.current) {
                canvasRef.current.width = img.width;
                canvasRef.current.height = img.height;
                // Wait a bit for container to settle
                setTimeout(handleResetZoom, 50);
            }
        };
    }, [imageUrl, handleResetZoom]);

    useEffect(() => {
        if (isImmersive) {
            setTimeout(handleResetZoom, 350); // Match animation
        }
    }, [isImmersive, handleResetZoom]);

    // Redrawing
    useEffect(() => {
        let frame: number;
        const ctx = canvasRef.current?.getContext('2d');

        const loop = () => {
            if (state.current.needsRender && ctx && canvasRef.current) {
                const c = canvasRef.current;
                ctx.clearRect(0, 0, c.width, c.height);

                const allPaths = [...state.current.paths];
                if (state.current.currentPath.length > 0) {
                    allPaths.push({
                        points: state.current.currentPath,
                        mode: state.current.mode === 'erase' ? 'draw' : (state.current.mode as any),
                        color: state.current.color,
                        size: state.current.brushSize
                    });
                }

                allPaths.forEach(path => {
                    if (path.points.length === 0) return;
                    if (path.mode === 'stamp') {
                        path.points.forEach(p => {
                            if (stampImage) {
                                ctx.save();
                                const w = STAMP_SIZE;
                                const h = w * (stampImage.height / stampImage.width);
                                ctx.drawImage(stampImage, p.x - w / 2, p.y - h / 2, w, h);
                                ctx.restore();
                            } else {
                                ctx.save();
                                ctx.translate(p.x, p.y);
                                ctx.rotate(-0.15);
                                ctx.strokeStyle = path.color;
                                ctx.lineWidth = 3;
                                ctx.strokeRect(-60, -20, 120, 40);
                                ctx.fillStyle = path.color;
                                ctx.font = 'bold 18px sans-serif';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.fillText('APROBADO', 0, 0);
                                ctx.restore();
                            }
                        });
                    } else {
                        ctx.beginPath();
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.strokeStyle = path.color;
                        ctx.lineWidth = path.size || state.current.brushSize;
                        ctx.globalAlpha = 0.8;
                        ctx.moveTo(path.points[0].x, path.points[0].y);
                        path.points.forEach(p => ctx.lineTo(p.x, p.y));
                        ctx.stroke();
                        ctx.globalAlpha = 1.0;
                    }
                });
                state.current.needsRender = false;
            }
            frame = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(frame);
    }, [stampImage]);

    // Event Management
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const getCanvasPoint = (clientX: number, clientY: number) => {
            const rect = container.getBoundingClientRect();
            return {
                x: (clientX - rect.left - state.current.offset.x) / state.current.scale,
                y: (clientY - rect.top - state.current.offset.y) / state.current.scale
            };
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const s = state.current.scale;
            const newScale = Math.min(Math.max(s * delta, 0.05), 30);

            const rect = container.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            const dx = (mx - state.current.offset.x) / s;
            const dy = (my - state.current.offset.y) / s;

            state.current.offset = {
                x: mx - dx * newScale,
                y: my - dy * newScale
            };
            state.current.scale = newScale;
            setScale(newScale);
        };

        const onMouseDown = (e: MouseEvent) => {
            if (!isImmersive) return;

            const isMiddle = e.button === 1;
            const isRight = e.button === 2;

            if (state.current.mode === 'pan' || isMiddle || isRight) {
                state.current.isPanning = true;
                state.current.lastMousePos = { x: e.clientX, y: e.clientY };
                container.style.cursor = 'grabbing';
                return;
            }

            const p = getCanvasPoint(e.clientX, e.clientY);
            if (state.current.mode === 'erase') {
                const threshold = 30 / state.current.scale;
                const newPaths = state.current.paths.filter(path =>
                    !path.points.some(pt => Math.hypot(pt.x - p.x, pt.y - p.y) < threshold)
                );
                if (newPaths.length !== state.current.paths.length) addToHistory(newPaths);
            } else if (state.current.mode === 'stamp') {
                addToHistory([...state.current.paths, { mode: 'stamp', color: state.current.color, points: [p] }]);
            } else {
                state.current.isDrawing = true;
                state.current.currentPath = [p];
            }
            state.current.needsRender = true;
        };

        const onMouseMove = (e: MouseEvent) => {
            if (state.current.isPanning) {
                const dx = e.clientX - state.current.lastMousePos.x;
                const dy = e.clientY - state.current.lastMousePos.y;
                state.current.offset.x += dx;
                state.current.offset.y += dy;
                state.current.lastMousePos = { x: e.clientX, y: e.clientY };
                state.current.needsRender = true;
                return;
            }

            if (state.current.isDrawing) {
                state.current.currentPath.push(getCanvasPoint(e.clientX, e.clientY));
                state.current.needsRender = true;
            }
        };

        const onMouseUp = () => {
            if (state.current.isDrawing) {
                addToHistory([...state.current.paths, {
                    points: [...state.current.currentPath],
                    mode: 'draw',
                    color: state.current.color,
                    size: state.current.brushSize
                }]);
            }
            state.current.isDrawing = false;
            state.current.isPanning = false;
            state.current.currentPath = [];
            state.current.needsRender = true;
            container.style.cursor = state.current.mode === 'pan' ? 'grab' : 'crosshair';
        };

        // Touch Support
        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                state.current.touchDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                return;
            }
            const t = e.touches[0];
            onMouseDown(new MouseEvent('mousedown', { clientX: t.clientX, clientY: t.clientY, button: 0 } as any));
        };

        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && state.current.touchDist !== null) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const delta = dist / state.current.touchDist;
                const s = state.current.scale;
                const newScale = Math.min(Math.max(s * delta, 0.05), 30);

                const rect = container.getBoundingClientRect();
                const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

                const dx = (cx - state.current.offset.x) / s;
                const dy = (cy - state.current.offset.y) / s;

                state.current.offset = { x: cx - dx * newScale, y: cy - dy * newScale };
                state.current.scale = newScale;
                state.current.touchDist = dist;
                setScale(newScale);
                state.current.needsRender = true;
                return;
            }
            const t = e.touches[0];
            onMouseMove(new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY } as any));
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        container.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        container.addEventListener('touchstart', onTouchStart, { passive: false });
        container.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onMouseUp);
        container.addEventListener('contextmenu', e => e.preventDefault());

        return () => {
            container.removeEventListener('wheel', onWheel);
            container.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            container.removeEventListener('touchstart', onTouchStart);
            container.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onMouseUp);
        };
    }, [isImmersive]);

    return (
        <div className={cn("relative transition-all duration-300 ease-in-out select-none overflow-hidden", isImmersive ? "fixed inset-0 z-[9999] bg-bb-darker" : "h-full w-full bg-bb-sidebar/20 rounded-3xl")}>
            <AnimatePresence>
                {isImmersive && (
                    <>
                        {/* Sidebar */}
                        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="absolute left-6 top-1/2 -translate-y-1/2 z-[10000] flex flex-col gap-4 p-4 bg-black/80 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl">
                            <Button variant="ghost" size="icon" onClick={() => setMode('draw')} className={cn("h-12 w-12 rounded-2xl transition-all", mode === 'draw' ? "bg-emerald-500 text-white scale-110 shadow-lg shadow-emerald-500/20" : "text-zinc-400")}><Pencil className="w-5 h-5" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setMode('stamp')} className={cn("h-12 w-12 rounded-2xl transition-all", mode === 'stamp' ? "bg-emerald-500 text-white scale-110 shadow-lg shadow-emerald-500/20" : "text-zinc-400")}><CheckCircle2 className="w-5 h-5" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setMode('pan')} className={cn("h-12 w-12 rounded-2xl transition-all", mode === 'pan' ? "bg-blue-500 text-white scale-110 shadow-lg shadow-blue-500/20" : "text-zinc-400")}><Hand className="w-5 h-5" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setMode('erase')} className={cn("h-12 w-12 rounded-2xl transition-all", mode === 'erase' ? "bg-zinc-700 text-white scale-110" : "text-zinc-400")}><Eraser className="w-5 h-5" /></Button>

                            <div className="h-px w-8 bg-white/10 mx-auto" />

                            <div className="grid grid-cols-2 gap-2">
                                {COLORS.map(c => (
                                    <button key={c} className={cn("w-6 h-6 rounded-full border border-white/20 transition-transform", color === c ? "ring-2 ring-white scale-125" : "opacity-40 hover:opacity-60")} style={{ backgroundColor: c }} onClick={() => setColor(c)} />
                                ))}
                            </div>

                            <div className="h-px w-8 bg-white/10 mx-auto" />

                            <input type="range" min="4" max="80" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-24 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer -rotate-90 my-10" />

                            <div className="h-px w-8 bg-white/10 mx-auto" />

                            <Button variant="ghost" size="icon" disabled={historyIndex === 0} onClick={undo} className="h-10 w-10 text-zinc-400 disabled:opacity-20"><Undo2 className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" disabled={historyIndex === historyLength - 1} onClick={redo} className="h-10 w-10 text-zinc-400 disabled:opacity-20"><Redo2 className="w-4 h-4" /></Button>
                        </motion.div>

                        {/* Top Bar */}
                        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="absolute top-6 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-6 px-8 py-3 bg-black/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
                            <div className="flex flex-col items-center min-w-16">
                                <span className="text-[10px] font-black tracking-tighter text-emerald-400">ZOOM</span>
                                <span className="text-sm font-black text-white">{Math.round(scale * 100)}%</span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-10 w-10 text-zinc-400 hover:text-white bg-white/5" onClick={handleResetZoom}><Maximize className="w-5 h-5" /></Button>
                            <div className="h-8 w-px bg-white/10" />
                            <Button onClick={() => onSave(state.current.paths)} disabled={isSaving} className="h-12 px-8 rounded-2xl bg-emerald-500 hover:bg-emerald-600 font-black gap-3 text-white transition-all active:scale-95">
                                {isSaving ? <RotateCcw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                <span>GUARDAR</span>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setIsImmersive(false)} className="h-12 w-12 rounded-2xl bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"><Minimize2 className="w-6 h-6" /></Button>
                        </motion.div>

                        {/* Trash */}
                        <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} className="absolute bottom-8 right-8 z-[10000]">
                            <Button variant="ghost" size="icon" onClick={() => { if (confirm('¿Borrar todo?')) addToHistory([]); }} className="h-14 w-14 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-6 h-6" /></Button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <div
                ref={containerRef}
                className={cn(
                    "relative w-full h-full touch-none",
                    !isImmersive ? "cursor-pointer group" : (mode === 'pan' ? "cursor-grab" : "cursor-crosshair")
                )}
                onClick={() => !isImmersive && setIsImmersive(true)}
            >
                {!isImmersive && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/40 group-hover:bg-black/60 transition-colors">
                        <div className="bg-emerald-500 text-white text-[10px] font-black uppercase tracking-[0.2em] px-6 py-3 rounded-full shadow-2xl animate-pulse">
                            ENTRAR A MODO EDICIÓN
                        </div>
                    </div>
                )}

                <div
                    className="absolute top-0 left-0 will-change-transform"
                    style={{
                        transform: `translate(${state.current.offset.x}px, ${state.current.offset.y}px) scale(${state.current.scale})`,
                        width: state.current.imageSize.width || '100%',
                        height: state.current.imageSize.height || '100%'
                    }}
                >
                    {imageUrl && (
                        <img
                            src={imageUrl}
                            alt="Flowchart"
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                width: state.current.imageSize.width,
                                height: state.current.imageSize.height
                            }}
                        />
                    )}
                    <canvas ref={canvasRef} className="absolute inset-0" />
                </div>
            </div>

            {isImmersive && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-white/40 font-black tracking-widest pointer-events-none z-[10001] bg-black/60 px-6 py-2 rounded-full backdrop-blur-md border border-white/5 uppercase">
                    Scroll: Zoom • Click Derecho o herramienta mano: Mover • Pinch: Zoom Móvil
                </div>
            )}
        </div>
    );
}
