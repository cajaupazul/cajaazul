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
    MousePointer2,
    CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Point {
    x: number;
    y: number;
    color: string;
    size: number;
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
    const [isPanning, setIsPanning] = useState(false);
    const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

    const BRUSH_SIZE = 8;
    const STAMP_SIZE = 40;

    // Load image and setup canvas size
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    useEffect(() => {
        const img = new Image();
        img.src = imageUrl;
        img.onload = () => {
            setImageSize({ width: img.width, height: img.height });
            if (canvasRef.current) {
                canvasRef.current.width = img.width;
                canvasRef.current.height = img.height;
                render();
            }
        };
    }, [imageUrl]);

    useEffect(() => {
        setPaths(initialData);
    }, [initialData]);

    const render = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw stored paths
        [...paths, { points: currentPath, mode, color }].forEach(path => {
            if (path.points.length === 0) return;

            if (path.mode === 'stamp') {
                path.points.forEach(point => drawStamp(ctx, point.x, point.y, path.color));
            } else {
                ctx.beginPath();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = path.color;
                ctx.lineWidth = BRUSH_SIZE;
                ctx.globalAlpha = 0.4; // Highlighter effect

                ctx.moveTo(path.points[0].x, path.points[0].y);
                path.points.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }
        });
    }, [paths, currentPath, mode, color]);

    useEffect(() => {
        render();
    }, [render]);

    const drawStamp = (ctx: CanvasRenderingContext2D, x: number, y: number, stampColor: string) => {
        const size = STAMP_SIZE;
        ctx.save();

        // Draw main circle/badge
        ctx.fillStyle = stampColor;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0,0,0,0.3)';

        // Rounded Rect for "APROBADO" badge
        const width = 80;
        const height = 24;
        const radius = 6;

        ctx.translate(x - width / 2, y - height / 2);

        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(width - radius, 0);
        ctx.quadraticCurveTo(width, 0, width, radius);
        ctx.lineTo(width, height - radius);
        ctx.quadraticCurveTo(width, height, width - radius, height);
        ctx.lineTo(radius, height);
        ctx.quadraticCurveTo(0, height, 0, height - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.fill();

        // White border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('APROBADO', width / 2, height / 2);

        ctx.restore();
    };

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
        if (mode === 'erase') {
            const point = getCanvasPoint(e);
            handleErase(point.x, point.y);
            return;
        }

        if (mode === 'stamp') {
            const point = getCanvasPoint(e);
            const newPath: Path = {
                mode: 'stamp',
                color: '#10b981',
                points: [point]
            };
            setPaths(prev => [...prev, newPath]);
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
        const threshold = 20;
        setPaths(prev => prev.filter(path => {
            return !path.points.some(p => {
                const dist = Math.sqrt(Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2));
                return dist < threshold;
            });
        }));
    };

    // Zoom and Pan logic
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setScale(prev => Math.min(Math.max(prev * delta, 0.5), 5));
        }
    };

    const resetZoom = () => {
        setScale(1);
        setOffset({ x: 0, y: 0 });
    };

    return (
        <div className="flex flex-col h-full space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-bb-card border border-bb-border rounded-2xl shadow-xl">
                <div className="flex items-center gap-2">
                    <Button
                        variant={mode === 'draw' ? 'default' : 'ghost'}
                        onClick={() => setMode('draw')}
                        className={cn("h-10 px-3 rounded-xl gap-2", mode === 'draw' && "bg-emerald-500 hover:bg-emerald-600")}
                    >
                        <Pencil className="w-4 h-4" />
                        <span className="hidden sm:inline">Pincel</span>
                    </Button>
                    <Button
                        variant={mode === 'stamp' ? 'default' : 'ghost'}
                        onClick={() => setMode('stamp')}
                        className={cn("h-10 px-3 rounded-xl gap-2", mode === 'stamp' && "bg-emerald-500 hover:bg-emerald-600")}
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Sello Aprobado</span>
                    </Button>
                    <Button
                        variant={mode === 'erase' ? 'default' : 'ghost'}
                        onClick={() => setMode('erase')}
                        className={cn("h-10 px-3 rounded-xl gap-2", mode === 'erase' && "bg-zinc-700 text-white")}
                    >
                        <Eraser className="w-4 h-4" />
                        <span className="hidden sm:inline">Borrador</span>
                    </Button>
                </div>

                <div className="h-8 w-px bg-bb-border mx-1 hidden sm:block" />

                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-bb-sidebar/50 rounded-xl p-1 gap-1">
                        <button
                            className={cn("w-8 h-8 rounded-lg transition-all", color === '#10b981' ? "ring-2 ring-white scale-110" : "opacity-50")}
                            style={{ backgroundColor: '#10b981' }}
                            onClick={() => setColor('#10b981')}
                        />
                        <button
                            className={cn("w-8 h-8 rounded-lg transition-all", color === '#3b82f6' ? "ring-2 ring-white scale-110" : "opacity-50")}
                            style={{ backgroundColor: '#3b82f6' }}
                            onClick={() => setColor('#3b82f6')}
                        />
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPaths([])}
                        className="h-10 w-10 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        title="Limpiar todo"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex-1" />

                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-bb-sidebar/50 rounded-xl p-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale(s => Math.max(s - 0.2, 0.5))}><ZoomOut className="w-4 h-4" /></Button>
                        <span className="text-[10px] font-black w-10 text-center">{Math.round(scale * 100)}%</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale(s => Math.min(s + 0.2, 5))}><ZoomIn className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetZoom}><Maximize className="w-4 h-4" /></Button>
                    </div>
                    <Button
                        onClick={() => onSave(paths)}
                        disabled={isSaving}
                        className="h-10 px-6 rounded-xl bg-blue-500 hover:bg-blue-600 font-bold gap-2"
                    >
                        {isSaving ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar
                    </Button>
                </div>
            </div>

            {/* Canvas Area */}
            <div
                ref={containerRef}
                className="flex-1 relative bg-black/40 rounded-3xl border border-bb-border overflow-auto cursor-crosshair no-scrollbar"
                onWheel={handleWheel}
            >
                <div
                    className="relative origin-top-left transition-transform duration-75"
                    style={{
                        transform: `scale(${scale}) translate(${offset.x}px, ${offset.y}px)`,
                        width: imageSize.width || '100%',
                        height: imageSize.height || 'h-full'
                    }}
                >
                    <img
                        src={imageUrl}
                        alt="Flowchart"
                        className="absolute inset-0 pointer-events-none"
                        style={{ width: imageSize.width, height: imageSize.height }}
                    />
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

            <div className="flex items-center justify-between px-2 text-[10px] text-bb-text-secondary">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1"><MousePointer2 className="w-3 h-3" /> Clic para pintar</span>
                    <span className="flex items-center gap-1 font-bold"><kbd className="bg-bb-border px-1.5 rounded">Ctrl + Scroll</kbd> Zoom</span>
                </div>
                <div className="italic">El progreso se guarda automáticamente al pulsar "Guardar"</div>
            </div>
        </div>
    );
}
