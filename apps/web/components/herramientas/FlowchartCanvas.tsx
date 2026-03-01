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
    Minimize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Point {
    x: number;
    y: number;
    color?: string;
    size?: number;
    isStamp?: boolean;
}

interface Path {
    points: Point[];
    mode: 'draw' | 'stamp';
    color: string;
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
    const [mode, setMode] = useState<'draw' | 'stamp' | 'erase'>('draw');
    const [color, setColor] = useState('#10b981'); // Emerald 500
    const [paths, setPaths] = useState<Path[]>(initialData);
    const [currentPath, setCurrentPath] = useState<Point[]>([]);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const [isImmersive, setIsImmersive] = useState(false);
    const [stampImage, setStampImage] = useState<HTMLImageElement | null>(null);

    const BRUSH_SIZE = 8;
    const STAMP_SIZE = 50;

    // Load stamp image
    useEffect(() => {
        const img = new Image();
        img.src = '/icons/stamp-approved.svg';
        img.onload = () => setStampImage(img);
    }, []);

    const drawStamp = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, stampColor: string) => {
        if (stampImage) {
            const aspect = stampImage.height / stampImage.width;
            const w = STAMP_SIZE * 2;
            const h = w * aspect;
            ctx.drawImage(stampImage, x - w / 2, y - h / 2, w, h);
        } else {
            const width = 80;
            const height = 24;
            const radius = 6;
            ctx.save();
            ctx.translate(x - width / 2, y - height / 2);
            ctx.fillStyle = stampColor;
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.moveTo(radius, 0); ctx.lineTo(width - radius, 0); ctx.quadraticCurveTo(width, 0, width, radius);
            ctx.lineTo(width, height - radius); ctx.quadraticCurveTo(width, height, width - radius, height);
            ctx.lineTo(radius, height); ctx.quadraticCurveTo(0, height, 0, height - radius);
            ctx.lineTo(0, radius); ctx.quadraticCurveTo(0, 0, radius, 0);
            ctx.closePath();
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
            allPaths.push({ points: currentPath, mode: mode === 'erase' ? 'draw' : (mode as any), color });
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
                ctx.lineWidth = BRUSH_SIZE;
                ctx.globalAlpha = 0.4;
                ctx.moveTo(path.points[0].x, path.points[0].y);
                path.points.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }
        });
    }, [paths, currentPath, mode, color, drawStamp]);

    // Initial Scaling
    const handleResetZoom = useCallback(() => {
        if (containerRef.current && imageSize.width > 0) {
            const container = containerRef.current;
            const padding = 40;
            const availableWidth = container.clientWidth - padding;
            const availableHeight = container.clientHeight - padding;
            const scaleX = availableWidth / imageSize.width;
            const scaleY = availableHeight / imageSize.height;
            const fitScale = Math.min(scaleX, scaleY, 0.95);
            setScale(fitScale);
            setOffset({
                x: (container.clientWidth / fitScale - imageSize.width) / 2,
                y: (container.clientHeight / fitScale - imageSize.height) / 2
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
                render();
            }
        };
    }, [imageUrl, handleResetZoom, render]);

    useEffect(() => {
        setPaths(initialData);
    }, [initialData]);

    useEffect(() => {
        render();
    }, [render]);

    // Update zoom/offset when entering immersive mode
    useEffect(() => {
        if (isImmersive) {
            setTimeout(handleResetZoom, 350); // wait for animation
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
        const x = (clientX - rect.left) * (canvas.width / rect.width);
        const y = (clientY - rect.top) * (canvas.height / rect.height);
        return { x, y };
    };

    const startAction = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isImmersive) {
            setIsImmersive(true);
            return;
        }

        if (mode === 'erase') {
            const point = getCanvasPoint(e);
            handleErase(point.x, point.y);
            return;
        }
        if (mode === 'stamp') {
            const point = getCanvasPoint(e);
            setPaths(prev => [...prev, { mode: 'stamp', color: '#10b981', points: [point] }]);
            return;
        }
        if (mode === 'draw') {
            setIsDrawing(true);
            const point = getCanvasPoint(e);
            setCurrentPath([point]);
        }
    };

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const point = getCanvasPoint(e);
        setCurrentPath(prev => [...prev, point]);
    };

    const endAction = () => {
        if (isDrawing) {
            setIsDrawing(false);
            if (currentPath.length > 0) {
                setPaths(prev => [...prev, { points: currentPath, mode: 'draw', color }]);
            }
            setCurrentPath([]);
        }
    };

    const handleErase = (x: number, y: number) => {
        const threshold = 35;
        setPaths(prev => prev.filter(path => {
            return !path.points.some(p => {
                const dist = Math.sqrt(Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2));
                return dist < threshold;
            });
        }));
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setScale(prev => Math.min(Math.max(prev * delta, 0.1), 5));
        }
    };

    return (
        <div
            className={cn(
                "relative transition-all duration-300 ease-in-out",
                isImmersive ? "fixed inset-0 z-[9999] bg-bb-darker p-0" : "h-full w-full bg-bb-sidebar/20 rounded-3xl"
            )}
        >
            {/* Minimal Background Plate */}
            {!isImmersive && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-bb-text-secondary text-xs font-black uppercase tracking-widest opacity-20">
                        Presiona para Activar Pantalla Completa
                    </div>
                </div>
            )}

            {/* Immersive Sidebar/Controls */}
            <AnimatePresence>
                {isImmersive && (
                    <motion.div
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -20, opacity: 0 }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-[10000] flex flex-col gap-3 p-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl"
                    >
                        <Button
                            variant="ghost" size="icon"
                            onClick={() => setMode('draw')}
                            className={cn("h-12 w-12 rounded-2xl", mode === 'draw' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-zinc-400 hover:text-white")}
                        >
                            <Pencil className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="ghost" size="icon"
                            onClick={() => setMode('stamp')}
                            className={cn("h-12 w-12 rounded-2xl", mode === 'stamp' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-zinc-400 hover:text-white")}
                        >
                            <CheckCircle2 className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="ghost" size="icon"
                            onClick={() => setMode('erase')}
                            className={cn("h-12 w-12 rounded-2xl", mode === 'erase' ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white")}
                        >
                            <Eraser className="w-5 h-5" />
                        </Button>
                        <div className="h-px w-8 bg-white/10 mx-auto my-1" />
                        <button
                            className={cn("w-10 h-10 rounded-xl mx-auto transition-all", color === '#10b981' ? "ring-2 ring-white scale-110" : "opacity-30")}
                            style={{ backgroundColor: '#10b981' }}
                            onClick={() => setColor('#10b981')}
                        />
                        <button
                            className={cn("w-10 h-10 rounded-xl mx-auto transition-all", color === '#3b82f6' ? "ring-2 ring-white scale-110" : "opacity-30")}
                            style={{ backgroundColor: '#3b82f6' }}
                            onClick={() => setColor('#3b82f6')}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Top Immersive Header */}
            <AnimatePresence>
                {isImmersive && (
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        className="absolute top-4 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-4 px-6 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl"
                    >
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400" onClick={() => setScale(s => Math.max(s - 0.1, 0.1))}><ZoomOut className="w-4 h-4" /></Button>
                            <span className="text-[10px] font-black w-10 text-center text-white">{Math.round(scale * 100)}%</span>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400" onClick={() => setScale(s => Math.min(s + 0.1, 5))}><ZoomIn className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400" onClick={handleResetZoom}><Maximize className="w-4 h-4" /></Button>
                        </div>
                        <div className="h-6 w-px bg-white/10" />
                        <Button
                            onClick={() => onSave(paths)}
                            disabled={isSaving}
                            className="h-10 px-6 rounded-xl bg-blue-500 hover:bg-blue-600 font-bold gap-2 text-white"
                        >
                            {isSaving ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>Guardar</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsImmersive(false)}
                            className="h-10 w-10 rounded-xl bg-zinc-800 text-white hover:bg-zinc-700"
                            title="Regresar"
                        >
                            <Minimize2 className="w-5 h-5" />
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bottom Actions */}
            <AnimatePresence>
                {isImmersive && (
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        className="absolute bottom-6 right-6 z-[10000]"
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { if (confirm('¿Borrar todo el dibujo?')) setPaths([]); }}
                            className="h-12 w-12 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                            title="Limpiar todo"
                        >
                            <Trash2 className="w-5 h-5" />
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Canvas Area */}
            <div
                ref={containerRef}
                className={cn(
                    "relative overflow-auto cursor-crosshair no-scrollbar touch-none w-full h-full",
                    isImmersive ? "bg-bb-darker" : "rounded-3xl"
                )}
                onWheel={handleWheel}
            >
                <div
                    className="relative origin-top-left transition-transform duration-75"
                    style={{
                        transform: `scale(${scale}) translate(${offset.x}px, ${offset.y}px)`,
                        width: imageSize.width,
                        height: imageSize.height
                    }}
                >
                    {imageUrl && (
                        <img
                            src={imageUrl}
                            alt="Flowchart"
                            className="absolute inset-0 pointer-events-none"
                            style={{ width: imageSize.width, height: imageSize.height }}
                        />
                    )}
                    <canvas
                        ref={canvasRef}
                        className="absolute inset-0"
                        onMouseDown={startAction}
                        onMouseMove={handleMove}
                        onMouseUp={endAction}
                        onMouseLeave={endAction}
                        onTouchStart={startAction}
                        onTouchMove={handleMove}
                        onTouchEnd={endAction}
                    />
                </div>
            </div>

            {isImmersive && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] text-white/30 font-bold uppercase tracking-widest pointer-events-none z-[10001]">
                    Modo Inmersivo Activo • Ctrl + Scroll para Zoom
                </div>
            )}
        </div>
    );
}
