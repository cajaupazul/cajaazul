'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
    Pencil,
    Eraser,
    Trash2,
    Save,
    RotateCcw,
    ZoomIn,
    ZoomOut,
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
    const [isDrawing, setIsDrawing] = useState(false);
    const [mode, setMode] = useState<'draw' | 'stamp' | 'erase' | 'pan'>('draw');
    const [color, setColor] = useState('#10b981');
    const [brushSize, setBrushSize] = useState(15);

    // State for React UI
    const [paths, setPaths] = useState<Path[]>(initialData);
    const [history, setHistory] = useState<Path[][]>([initialData]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [scale, setScale] = useState(1);
    const [isImmersive, setIsImmersive] = useState(false);
    const [stampImage, setStampImage] = useState<HTMLImageElement | null>(null);

    // Refs for performance and event handling
    const stateRef = useRef({
        paths: initialData as Path[],
        currentPath: [] as Point[],
        scale: 1,
        offset: { x: 0, y: 0 },
        isPanning: false,
        isDrawing: false,
        lastMousePos: { x: 0, y: 0 },
        imageSize: { width: 0, height: 0 },
        touchDist: null as number | null,
    });

    const STAMP_SIZE = 130;
    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#ffffff', '#000000'];

    // Load stamp image
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
                        img.onload = () => {
                            if (img.width > 0) resolve(true);
                            else reject();
                        };
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
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push([...newPaths]);
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setPaths(newPaths);
        stateRef.current.paths = newPaths;
    }, [history, historyIndex]);

    const undo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            const prevPaths = history[newIndex];
            setHistoryIndex(newIndex);
            setPaths([...prevPaths]);
            stateRef.current.paths = [...prevPaths];
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            const nextPaths = history[newIndex];
            setHistoryIndex(newIndex);
            setPaths([...nextPaths]);
            stateRef.current.paths = [...nextPaths];
        }
    };

    const drawStamp = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, stampColor: string) => {
        if (stampImage) {
            ctx.save();
            const w = STAMP_SIZE;
            const aspect = stampImage.height / stampImage.width;
            const h = w * aspect;
            ctx.drawImage(stampImage, x - w / 2, y - h / 2, w, h);
            ctx.restore();
        } else {
            // High quality fallback
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(-0.2);
            ctx.strokeStyle = stampColor;
            ctx.lineWidth = 3;
            ctx.strokeRect(-50, -15, 100, 30);
            ctx.fillStyle = stampColor;
            ctx.font = 'bold 16px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('APROBADO', 0, 0);
            ctx.restore();
        }
    }, [stampImage]);

    // Rendering loop
    const render = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const { paths: savedPaths, currentPath: drawingPath } = stateRef.current;
        const allPaths = [...savedPaths];

        if (drawingPath.length > 0) {
            allPaths.push({
                points: drawingPath,
                mode: mode === 'erase' ? 'draw' : (mode as any),
                color,
                size: brushSize
            });
        }

        allPaths.forEach(path => {
            if (path.points.length === 0) return;
            if (path.mode === 'stamp') {
                path.points.forEach(point => drawStamp(ctx, point.x, point.y, path.color));
            } else {
                ctx.beginPath();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = path.color;
                ctx.lineWidth = path.size || brushSize;
                ctx.globalAlpha = 0.7;
                ctx.moveTo(path.points[0].x, path.points[0].y);
                path.points.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }
        });
    }, [mode, color, brushSize, drawStamp]);

    // Update scale state for UI
    useEffect(() => {
        const timer = setInterval(() => {
            if (scale !== stateRef.current.scale) {
                setScale(stateRef.current.scale);
            }
        }, 100);
        return () => clearInterval(timer);
    }, [scale]);

    // Animation frame for rendering
    useEffect(() => {
        let frame: number;
        const loop = () => {
            render();
            frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frame);
    }, [render]);

    // Centering and initial view
    const handleResetZoom = useCallback(() => {
        if (containerRef.current && stateRef.current.imageSize.width > 0) {
            const container = containerRef.current;
            const { width: iw, height: ih } = stateRef.current.imageSize;
            const pad = 60;
            const fs = Math.min((container.clientWidth - pad) / iw, (container.clientHeight - pad) / ih, 1.0);

            stateRef.current.scale = fs;
            stateRef.current.offset = {
                x: (container.clientWidth - iw * fs) / 2,
                y: (container.clientHeight - ih * fs) / 2
            };
            setScale(fs);
        }
    }, []);

    // Load image and setup canvas
    useEffect(() => {
        const img = new Image();
        img.src = imageUrl;
        img.onload = () => {
            stateRef.current.imageSize = { width: img.width, height: img.height };
            if (canvasRef.current) {
                canvasRef.current.width = img.width;
                canvasRef.current.height = img.height;
                handleResetZoom();
            }
        };
    }, [imageUrl, handleResetZoom]);

    // Event listeners
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const getPoint = (clientX: number, clientY: number) => {
            const rect = container.getBoundingClientRect();
            const { scale: s, offset: o } = stateRef.current;
            return {
                x: (clientX - rect.left - o.x) / s,
                y: (clientY - rect.top - o.y) / s
            };
        };

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const s = stateRef.current.scale;
            const newScale = Math.min(Math.max(s * delta, 0.05), 30);

            const rect = container.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            const dx = (mx - stateRef.current.offset.x) / s;
            const dy = (my - stateRef.current.offset.y) / s;

            stateRef.current.offset = {
                x: mx - dx * newScale,
                y: my - dy * newScale
            };
            stateRef.current.scale = newScale;
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (!isImmersive) return;

            const isMiddle = e.button === 1;
            const isRight = e.button === 2;

            if (mode === 'pan' || isMiddle || isRight) {
                stateRef.current.isPanning = true;
                stateRef.current.lastMousePos = { x: e.clientX, y: e.clientY };
                return;
            }

            const p = getPoint(e.clientX, e.clientY);
            if (mode === 'erase') {
                const threshold = 30 / stateRef.current.scale;
                const newPaths = stateRef.current.paths.filter(path =>
                    !path.points.some(pt => Math.hypot(pt.x - p.x, pt.y - p.y) < threshold)
                );
                if (newPaths.length !== stateRef.current.paths.length) addToHistory(newPaths);
            } else if (mode === 'stamp') {
                addToHistory([...stateRef.current.paths, { mode: 'stamp', color, points: [p] }]);
            } else {
                stateRef.current.isDrawing = true;
                stateRef.current.currentPath = [p];
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (stateRef.current.isPanning) {
                const dx = e.clientX - stateRef.current.lastMousePos.x;
                const dy = e.clientY - stateRef.current.lastMousePos.y;
                stateRef.current.offset.x += dx;
                stateRef.current.offset.y += dy;
                stateRef.current.lastMousePos = { x: e.clientX, y: e.clientY };
                return;
            }

            if (stateRef.current.isDrawing) {
                stateRef.current.currentPath.push(getPoint(e.clientX, e.clientY));
            }
        };

        const handleMouseUp = () => {
            if (stateRef.current.isDrawing) {
                const newPath = {
                    points: [...stateRef.current.currentPath],
                    mode: 'draw' as const,
                    color,
                    size: brushSize
                };
                addToHistory([...stateRef.current.paths, newPath]);
            }
            stateRef.current.isDrawing = false;
            stateRef.current.isPanning = false;
            stateRef.current.currentPath = [];
        };

        // Touch handlers (simplified for brevity but functional)
        const handleTouchStart = (e: TouchEvent) => {
            if (!isImmersive) return;
            if (e.touches.length === 2) {
                stateRef.current.touchDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                return;
            }
            const t = e.touches[0];
            handleMouseDown(new MouseEvent('mousedown', { clientX: t.clientX, clientY: t.clientY, button: 0 } as any));
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && stateRef.current.touchDist !== null) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const delta = dist / stateRef.current.touchDist;
                const s = stateRef.current.scale;
                const newScale = Math.min(Math.max(s * delta, 0.05), 30);

                const rect = container.getBoundingClientRect();
                const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

                const dx = (cx - stateRef.current.offset.x) / s;
                const dy = (cy - stateRef.current.offset.y) / s;

                stateRef.current.offset = { x: cx - dx * newScale, y: cy - dy * newScale };
                stateRef.current.scale = newScale;
                stateRef.current.touchDist = dist;
                return;
            }
            const t = e.touches[0];
            handleMouseMove(new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY } as any));
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        container.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleMouseUp);
        container.addEventListener('contextmenu', e => e.preventDefault());

        return () => {
            container.removeEventListener('wheel', handleWheel);
            container.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleMouseUp);
        };
    }, [isImmersive, mode, color, brushSize, addToHistory]);

    return (
        <div className={cn("relative transition-all duration-300 ease-in-out select-none overflow-hidden", isImmersive ? "fixed inset-0 z-[9999] bg-bb-darker" : "h-full w-full bg-bb-sidebar/20 rounded-3xl")}>
            <AnimatePresence>
                {isImmersive && (
                    <>
                        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="absolute left-4 top-1/2 -translate-y-1/2 z-[10000] flex flex-col gap-3 p-3 bg-black/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
                            <Button variant="ghost" size="icon" onClick={() => setMode('draw')} className={cn("h-12 w-12 rounded-2xl", mode === 'draw' ? "bg-emerald-500 text-white" : "text-zinc-400")}><Pencil className="w-5 h-5" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setMode('stamp')} className={cn("h-12 w-12 rounded-2xl", mode === 'stamp' ? "bg-emerald-500 text-white" : "text-zinc-400")}><CheckCircle2 className="w-5 h-5" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setMode('pan')} className={cn("h-12 w-12 rounded-2xl", mode === 'pan' ? "bg-blue-500 text-white" : "text-zinc-400")}><Hand className="w-5 h-5" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setMode('erase')} className={cn("h-12 w-12 rounded-2xl", mode === 'erase' ? "bg-zinc-700 text-white" : "text-zinc-400")}><Eraser className="w-5 h-5" /></Button>
                            <div className="h-px w-8 bg-white/10 mx-auto" />
                            <div className="grid grid-cols-2 gap-2">
                                {COLORS.map(c => (
                                    <button key={c} className={cn("w-5 h-5 rounded-full border border-white/20", color === c ? "ring-2 ring-white scale-110" : "opacity-40")} style={{ backgroundColor: c }} onClick={() => setColor(c)} />
                                ))}
                            </div>
                            <div className="h-px w-8 bg-white/10 mx-auto" />
                            <input type="range" min="4" max="80" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-24 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer -rotate-90 my-8" />
                            <div className="h-px w-8 bg-white/10 mx-auto" />
                            <Button variant="ghost" size="icon" disabled={historyIndex === 0} onClick={undo} className="h-12 w-12 rounded-2xl text-zinc-400 disabled:opacity-20"><Undo2 className="w-5 h-5" /></Button>
                            <Button variant="ghost" size="icon" disabled={historyIndex === history.length - 1} onClick={redo} className="h-12 w-12 rounded-2xl text-zinc-400 disabled:opacity-20"><Redo2 className="w-5 h-5" /></Button>
                        </motion.div>

                        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="absolute top-4 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-4 px-6 py-2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                            <span className="text-[10px] font-black w-12 text-center text-white">{Math.round(scale * 100)}%</span>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400" onClick={handleResetZoom}><Maximize className="w-4 h-4" /></Button>
                            <div className="h-6 w-px bg-white/10" />
                            <Button onClick={() => onSave(paths)} disabled={isSaving} className="h-10 px-6 rounded-xl bg-blue-500 hover:bg-blue-600 font-bold gap-2 text-white">
                                {isSaving ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                <span>Guardar</span>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setIsImmersive(false)} className="h-10 w-10 rounded-xl bg-zinc-800 text-white"><Minimize2 className="w-5 h-5" /></Button>
                        </motion.div>

                        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="absolute bottom-6 right-6 z-[10000]">
                            <Button variant="ghost" size="icon" onClick={() => { if (confirm('¿Borrar todo?')) addToHistory([]); }} className="h-12 w-12 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20"><Trash2 className="w-5 h-5" /></Button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <div
                ref={containerRef}
                className={cn(
                    "relative w-full h-full touch-none",
                    !isImmersive && "cursor-pointer group"
                )}
                onClick={() => !isImmersive && setIsImmersive(true)}
            >
                {!isImmersive && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/20 group-hover:bg-black/40 transition-colors">
                        <div className="text-white text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full border border-white/20 backdrop-blur-sm">Click para Modo Edición</div>
                    </div>
                )}

                <div
                    className="absolute top-0 left-0 will-change-transform"
                    style={{
                        transform: `translate(${stateRef.current.offset.x}px, ${stateRef.current.offset.y}px) scale(${stateRef.current.scale})`,
                        width: stateRef.current.imageSize.width || '100%',
                        height: stateRef.current.imageSize.height || '100%'
                    }}
                >
                    {imageUrl && (
                        <img
                            src={imageUrl}
                            alt="Flowchart"
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                width: stateRef.current.imageSize.width,
                                height: stateRef.current.imageSize.height
                            }}
                        />
                    )}
                    <canvas ref={canvasRef} className="absolute inset-0" />
                </div>
            </div>

            {isImmersive && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] text-white/40 font-bold uppercase tracking-widest pointer-events-none z-[10001] bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                    Scroll: Zoom • Click Derecho: Mover • Pinch: Zoom Móvil
                </div>
            )}
        </div>
    );
}
