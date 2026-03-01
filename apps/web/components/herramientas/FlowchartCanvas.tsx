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
    ChevronLeft,
    CheckCircle2,
    X,
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
    const [isPanning, setIsPanning] = useState(false);
    const [mode, setMode] = useState<'draw' | 'stamp' | 'erase' | 'pan'>('draw');
    const [color, setColor] = useState('#10b981');
    const [brushSize, setBrushSize] = useState(8);

    const [paths, setPaths] = useState<Path[]>(initialData);
    const [history, setHistory] = useState<Path[][]>([initialData]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const [currentPath, setCurrentPath] = useState<Point[]>([]);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const [isImmersive, setIsImmersive] = useState(false);
    const [stampImage, setStampImage] = useState<HTMLImageElement | null>(null);

    const lastMousePos = useRef<{ x: number, y: number } | null>(null);
    const touchDistRef = useRef<number | null>(null);

    const STAMP_SIZE = 100;
    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#ffffff', '#000000'];

    // Load stamp image with aggressive fallbacks
    useEffect(() => {
        const loadStamp = async () => {
            const urls = ['/cellos/aprov.svg', '/cellos/aprov', '/cellos/cello.svg', '/icons/stamp-approved.svg'];
            for (const url of urls) {
                try {
                    const img = new Image();
                    img.src = url;
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                    });
                    setStampImage(img);
                    return;
                } catch (e) { }
            }
        };
        loadStamp();
    }, []);

    // FIX: Manual non-passive listeners for wheel and touch
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.min(Math.max(scale * delta, 0.05), 20);

            // Zoom towards mouse
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const dx = (mouseX - offset.x) / scale;
            const dy = (mouseY - offset.y) / scale;

            setOffset({
                x: mouseX - dx * newScale,
                y: mouseY - dy * newScale
            });
            setScale(newScale);
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && touchDistRef.current !== null) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const delta = dist / touchDistRef.current;
                const newScale = Math.min(Math.max(scale * delta, 0.05), 20);

                // Pinch center zoom
                const rect = container.getBoundingClientRect();
                const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

                const dx = (centerX - offset.x) / scale;
                const dy = (centerY - offset.y) / scale;

                setOffset({
                    x: centerX - dx * newScale,
                    y: centerY - dy * newScale
                });
                setScale(newScale);
                touchDistRef.current = dist;
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });

        return () => {
            container.removeEventListener('wheel', handleWheel);
            container.removeEventListener('touchmove', handleTouchMove);
        };
    }, [scale, offset]);

    const addToHistory = useCallback((newPaths: Path[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push([...newPaths]);
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setPaths(newPaths);
    }, [history, historyIndex]);

    const undo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setPaths([...history[newIndex]]);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setPaths([...history[newIndex]]);
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
            const width = 80;
            const height = 24;
            ctx.save();
            ctx.translate(x - width / 2, y - height / 2);
            ctx.fillStyle = stampColor;
            ctx.beginPath();
            ctx.roundRect(0, 0, width, height, 6);
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('APROBADO', width / 2, height / 2);
            ctx.restore();
        }
    }, [stampImage]);

    const render = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const allPaths = [...paths];
        if (currentPath.length > 0) {
            allPaths.push({ points: currentPath, mode: mode === 'erase' ? 'draw' : (mode as any), color, size: brushSize });
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
                ctx.globalAlpha = 0.4;
                ctx.moveTo(path.points[0].x, path.points[0].y);
                path.points.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }
        });
    }, [paths, currentPath, mode, color, brushSize, drawStamp]);

    const handleResetZoom = useCallback(() => {
        if (containerRef.current && imageSize.width > 0) {
            const container = containerRef.current;
            const padding = 40;
            const availableWidth = container.clientWidth - padding;
            const availableHeight = container.clientHeight - padding;
            const fitScale = Math.min(availableWidth / imageSize.width, availableHeight / imageSize.height, 0.95);
            setScale(fitScale);
            setOffset({
                x: (container.clientWidth - imageSize.width * fitScale) / 2,
                y: (container.clientHeight - imageSize.height * fitScale) / 2
            });
        }
    }, [imageSize]);

    useEffect(() => {
        const img = new Image();
        img.src = imageUrl;
        img.onload = () => {
            setImageSize({ width: img.width, height: img.height });
            if (canvasRef.current) {
                canvasRef.current.width = img.width;
                canvasRef.current.height = img.height;
                handleResetZoom();
            }
        };
    }, [imageUrl, handleResetZoom]);

    useEffect(() => {
        setPaths(initialData);
        setHistory([initialData]);
        setHistoryIndex(0);
    }, [initialData]);

    useEffect(() => {
        render();
    }, [render]);

    useEffect(() => {
        if (isImmersive) {
            setTimeout(handleResetZoom, 350);
        }
    }, [isImmersive, handleResetZoom]);

    const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): { x: number, y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        return {
            x: (clientX - rect.left) / scale,
            y: (clientY - rect.top) / scale
        };
    };

    const startAction = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isImmersive) {
            setIsImmersive(true);
            return;
        }

        if ('touches' in e && e.touches.length === 2) {
            touchDistRef.current = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            return;
        }

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        // Middle button or Pan mode or Spacebar (simulated)
        if (mode === 'pan' || (e as React.MouseEvent).button === 1 || (e as React.MouseEvent).button === 2) {
            setIsPanning(true);
            lastMousePos.current = { x: clientX, y: clientY };
            return;
        }

        if (mode === 'erase') {
            const point = getCanvasPoint(e);
            handleErase(point.x, point.y);
        } else if (mode === 'stamp') {
            const point = getCanvasPoint(e);
            addToHistory([...paths, { mode: 'stamp', color, points: [point] }]);
        } else {
            setIsDrawing(true);
            setCurrentPath([getCanvasPoint(e)]);
        }
    };

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        if (isPanning && lastMousePos.current) {
            const dx = clientX - lastMousePos.current.x;
            const dy = clientY - lastMousePos.current.y;
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            lastMousePos.current = { x: clientX, y: clientY };
            return;
        }

        if (!isDrawing) return;
        setCurrentPath(prev => [...prev, getCanvasPoint(e)]);
    };

    const endAction = () => {
        setIsPanning(false);
        setIsDrawing(false);
        touchDistRef.current = null;
        if (currentPath.length > 0) {
            addToHistory([...paths, { points: currentPath, mode: 'draw', color, size: brushSize }]);
        }
        setCurrentPath([]);
    };

    const handleErase = (x: number, y: number) => {
        const threshold = 35 / scale;
        const newPaths = paths.filter(path => !path.points.some(p => Math.hypot(p.x - x, p.y - y) < threshold));
        if (newPaths.length !== paths.length) addToHistory(newPaths);
    };

    return (
        <div className={cn("relative transition-all duration-300 ease-in-out select-none", isImmersive ? "fixed inset-0 z-[9999] bg-bb-darker" : "h-full w-full bg-bb-sidebar/20 rounded-3xl")}>
            <AnimatePresence>
                {isImmersive && (
                    <>
                        {/* Sidebar */}
                        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="absolute left-4 top-1/2 -translate-y-1/2 z-[10000] flex flex-col gap-3 p-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl max-h-[90vh] no-scrollbar overflow-y-auto">
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
                            <input type="range" min="2" max="30" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-20 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer -rotate-90 my-6" />
                            <div className="h-px w-8 bg-white/10 mx-auto" />
                            <Button variant="ghost" size="icon" disabled={historyIndex === 0} onClick={undo} className="h-12 w-12 rounded-2xl text-zinc-400 disabled:opacity-20"><Undo2 className="w-5 h-5" /></Button>
                            <Button variant="ghost" size="icon" disabled={historyIndex === history.length - 1} onClick={redo} className="h-12 w-12 rounded-2xl text-zinc-400 disabled:opacity-20"><Redo2 className="w-5 h-5" /></Button>
                        </motion.div>

                        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="absolute top-4 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-4 px-6 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                            <span className="text-[10px] font-black w-10 text-center text-white">{Math.round(scale * 100)}%</span>
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
                    "relative overflow-hidden touch-none w-full h-full",
                    isImmersive ? "bg-bb-darker" : "rounded-3xl border border-bb-border cursor-pointer",
                    mode === 'pan' && "cursor-grab active:cursor-grabbing"
                )}
                onMouseDown={startAction}
                onMouseMove={handleMove}
                onMouseUp={endAction}
                onMouseLeave={endAction}
                onTouchStart={startAction}
                onTouchEnd={endAction}
                onContextMenu={(e) => e.preventDefault()}
            >
                {!isImmersive && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <div className="text-bb-text-secondary text-xs font-black uppercase tracking-widest opacity-20 bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm">Click para Modo Inmersivo</div>
                    </div>
                )}
                <div
                    className="relative origin-top-left transition-transform duration-75 will-change-transform"
                    style={{
                        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                        width: imageSize.width,
                        height: imageSize.height
                    }}
                >
                    {imageUrl && <img src={imageUrl} alt="Flowchart" className="absolute inset-0 pointer-events-none" style={{ width: imageSize.width, height: imageSize.height }} />}
                    <canvas ref={canvasRef} className="absolute inset-0" />
                </div>
            </div>

            {isImmersive && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] text-white/30 font-bold uppercase tracking-widest pointer-events-none z-[10001]">
                    Rueda: Zoom • Click Derecho/Central: Mover • Pinch: Zoom Móvil
                </div>
            )}
        </div>
    );
}
