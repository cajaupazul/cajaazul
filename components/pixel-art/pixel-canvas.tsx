'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Palette, COLOR_PALETTE, COLOR_MAP } from './palette';
import { NavigationControls } from './overlay-controls';
import { Upload, X, Grid as GridIcon, Lock, Unlock, Image as ImageIcon, Trash2, Move } from 'lucide-react';
import { cn } from '@/lib/utils';

const GRID_WIDTH = 1000;
const GRID_HEIGHT = 1000;

// Pre-compute integer colors for faster 32-bit writes
const computeUint32Colors = (palette: string[]) => {
    const buffer = new Uint32Array(palette.length);
    palette.forEach((hex, i) => {
        // Hex is #RRGGBB
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const a = 255;

        // ABGR for Little Endian
        buffer[i] = (a << 24) | (b << 16) | (g << 8) | r;
    });
    return buffer;
};

const UINT32_PALETTE = computeUint32Colors(COLOR_PALETTE);

interface PixelCanvasProps {
    eventId: string;
    onClose: () => void;
}

export default function PixelCanvas({ eventId, onClose }: PixelCanvasProps) {
    const displayCanvasRef = useRef<HTMLCanvasElement>(null);
    const dataCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const guidanceCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const [scale, setScale] = useState(1);
    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);

    const [selectedColor, setSelectedColor] = useState<string | null>('#000000');
    const [isPanning, setIsPanning] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(1);

    // Guidance State
    const [guidanceImage, setGuidanceImage] = useState<HTMLImageElement | null>(null);
    const [guidanceOpacity, setGuidanceOpacity] = useState(0.5);
    const [guidancePixelation, setGuidancePixelation] = useState(1);
    const [isEditingGuidance, setIsEditingGuidance] = useState(false);
    const [guidanceState, setGuidanceState] = useState({ x: 0, y: 0, scale: 1 });
    const [showGuidancePanel, setShowGuidancePanel] = useState(false);

    const [tooltipData, setTooltipData] = useState<{ x: number, y: number, color: string } | null>(null);

    // Use a Ref for pixel data to avoid re-renders on every pixel change
    const pixelDataRef = useRef<Uint8Array>(new Uint8Array(GRID_WIDTH * GRID_HEIGHT));

    const lastMouseRef = useRef<{ x: number, y: number } | null>(null);

    // Optimization Flags
    const needsRedrawRef = useRef(true);
    const isRunningRef = useRef(true);
    const frameIdRef = useRef<number>(0);

    // --- Data Fetching & Subscription ---

    useEffect(() => {
        let channel = supabase.channel(`pixel-art-${eventId}`);

        const init = async () => {
            await fetchGridData();

            channel
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'pixel_history',
                    filter: `event_id=eq.${eventId}`,
                }, (payload) => {
                    const { x, y, color_index } = payload.new;
                    updateLocalPixel(x, y, color_index);
                })
                .on('presence', { event: 'sync' }, () => {
                    const state = channel.presenceState();
                    setOnlineUsers(Object.keys(state).length || 1);
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        await channel.track({ online_at: new Date().toISOString() });
                    }
                });
        };

        init();

        return () => {
            supabase.removeChannel(channel);
            isRunningRef.current = false;
            cancelAnimationFrame(frameIdRef.current);
        };
    }, [eventId]);

    const fetchGridData = async () => {
        try {
            const { data, error } = await supabase
                .from('pixel_board_state')
                .select('pixels')
                .eq('event_id', eventId)
                .single();

            if (data?.pixels) {
                let bytes: Uint8Array;
                if (typeof data.pixels === 'string') {
                    const hex = data.pixels.startsWith('\\x') ? data.pixels.slice(2) : data.pixels;
                    const len = hex.length / 2;
                    bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
                    }
                } else {
                    bytes = new Uint8Array(data.pixels);
                }

                if (bytes.length === GRID_WIDTH * GRID_HEIGHT) {
                    pixelDataRef.current = bytes;
                    // Trigger full redraw
                    updateDataCanvasFull();
                    needsRedrawRef.current = true;
                }
            }
        } catch (e) {
            console.error("Error fetching board:", e);
        }
    };

    const updateLocalPixel = (x: number, y: number, colorIndex: number) => {
        if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
            const idx = y * GRID_WIDTH + x;
            pixelDataRef.current[idx] = colorIndex;

            // Update just that pixel in the offscreen data canvas
            const ctx = dataCanvasRef.current?.getContext('2d');
            if (ctx) {
                // Optimized single pixel fill
                ctx.fillStyle = COLOR_PALETTE[colorIndex];
                ctx.fillRect(x, y, 1, 1);
            }
            needsRedrawRef.current = true;
        }
    };

    // --- Image Processing (Memoized) ---
    const getProcessedGuidanceCanvas = useCallback(() => {
        if (!guidanceImage) return null;
        if (!guidanceCanvasRef.current) {
            guidanceCanvasRef.current = document.createElement('canvas');
        }
        const canvas = guidanceCanvasRef.current;
        const w = guidanceImage.naturalWidth;
        const h = guidanceImage.naturalHeight;

        if (guidancePixelation <= 1) return guidanceImage;

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return guidanceImage;

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, w, h);

        const tinyW = Math.max(1, Math.floor(w / guidancePixelation));
        const tinyH = Math.max(1, Math.floor(h / guidancePixelation));

        // Use temp canvas for downscaling
        const tinyCanvas = document.createElement('canvas');
        tinyCanvas.width = tinyW;
        tinyCanvas.height = tinyH;
        const tinyCtx = tinyCanvas.getContext('2d');
        if (!tinyCtx) return guidanceImage;

        tinyCtx.imageSmoothingEnabled = false;
        tinyCtx.drawImage(guidanceImage, 0, 0, tinyW, tinyH);

        // Upscale back
        ctx.drawImage(tinyCanvas, 0, 0, tinyW, tinyH, 0, 0, w, h);

        return canvas;
    }, [guidanceImage, guidancePixelation]);


    // --- Rendering Optimization ---

    // Initial Full Paint (Heavy, done once or on reload)
    const updateDataCanvasFull = useCallback(() => {
        const canvas = dataCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const imageData = ctx.createImageData(GRID_WIDTH, GRID_HEIGHT);
        // Use Uint32 view for 4x faster writes
        const data32 = new Uint32Array(imageData.data.buffer);
        const pixels = pixelDataRef.current;
        const len = pixels.length;

        for (let i = 0; i < len; i++) {
            data32[i] = UINT32_PALETTE[pixels[i]];
        }

        ctx.putImageData(imageData, 0, 0);
    }, []);

    // Main Render Loop
    const render = useCallback(() => {
        if (!isRunningRef.current) return;

        const displayCanvas = displayCanvasRef.current;
        const dataCanvas = dataCanvasRef.current;

        if (displayCanvas && dataCanvas) {
            const ctx = displayCanvas.getContext('2d', { alpha: false }); // Alpha false optimization
            if (ctx) {
                // Clear
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, displayCanvas.width, displayCanvas.height);

                ctx.save();

                // Transform
                ctx.translate(displayCanvas.width / 2, displayCanvas.height / 2);
                ctx.scale(scale, scale);
                ctx.translate(offsetX, offsetY);

                const pixelStartX = -GRID_WIDTH / 2;
                const pixelStartY = -GRID_HEIGHT / 2;

                // 1. Draw Data (Bitmapped)
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(dataCanvas, pixelStartX, pixelStartY);

                // 2. Guidance
                const drawableGuidance = getProcessedGuidanceCanvas();
                if (drawableGuidance && guidanceImage) {
                    ctx.save();
                    ctx.globalAlpha = guidanceOpacity;

                    const gWidth = guidanceImage.naturalWidth * guidanceState.scale;
                    const gHeight = guidanceImage.naturalHeight * guidanceState.scale;

                    ctx.drawImage(
                        drawableGuidance,
                        guidanceState.x - gWidth / 2,
                        guidanceState.y - gHeight / 2,
                        gWidth,
                        gHeight
                    );

                    if (isEditingGuidance) {
                        ctx.strokeStyle = '#f59e0b';
                        ctx.lineWidth = 2 / scale;
                        ctx.strokeRect(
                            guidanceState.x - gWidth / 2,
                            guidanceState.y - gHeight / 2,
                            gWidth,
                            gHeight
                        );
                    }
                    ctx.restore();
                }

                // 3. Grid Lines (Expensive loop, only draw if zoomed in enough)
                if (scale > 15) {
                    ctx.beginPath();
                    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                    ctx.lineWidth = 0.5 / scale;

                    for (let i = 0; i <= GRID_WIDTH; i++) {
                        ctx.moveTo(pixelStartX + i, pixelStartY);
                        ctx.lineTo(pixelStartX + i, pixelStartY + GRID_HEIGHT);
                    }
                    for (let i = 0; i <= GRID_HEIGHT; i++) {
                        ctx.moveTo(pixelStartX, pixelStartY + i);
                        ctx.lineTo(pixelStartX + GRID_WIDTH, pixelStartY + i);
                    }
                    ctx.stroke();
                }

                ctx.restore();
            }
        }

        frameIdRef.current = requestAnimationFrame(render);
    }, [scale, offsetX, offsetY, guidanceImage, guidanceOpacity, guidanceState, isEditingGuidance, getProcessedGuidanceCanvas]);

    // Restart loop when dependencies change
    useEffect(() => {
        isRunningRef.current = true;
        needsRedrawRef.current = true; // Force draw
        frameIdRef.current = requestAnimationFrame(render);

        return () => cancelAnimationFrame(frameIdRef.current);
    }, [render]);


    // --- Input Handling ---

    const screenToWorld = (sx: number, sy: number) => {
        const displayCanvas = displayCanvasRef.current;
        if (!displayCanvas) return { x: 0, y: 0, worldX: 0, worldY: 0 };

        const cx = displayCanvas.width / 2;
        const cy = displayCanvas.height / 2;

        const worldX = (sx - cx) / scale - offsetX;
        const worldY = (sy - cy) / scale - offsetY;

        const pixelX = Math.floor(worldX + GRID_WIDTH / 2);
        const pixelY = Math.floor(worldY + GRID_HEIGHT / 2);

        return { x: pixelX, y: pixelY, worldX, worldY };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isEditingGuidance && guidanceImage) {
            lastMouseRef.current = { x: e.clientX, y: e.clientY };
            return;
        }
        if (e.button === 1 || e.button === 2 || selectedColor === null || e.ctrlKey || isPanning) {
            setIsPanning(true);
            lastMouseRef.current = { x: e.clientX, y: e.clientY };
            return;
        }
        paintPixel(e.clientX, e.clientY);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const { x, y, worldX, worldY } = screenToWorld(e.clientX, e.clientY);

        // Tooltip / Color Sampling Logic
        if (guidanceImage && !isEditingGuidance && !isPanning && !e.buttons) {
            const gWidth = guidanceImage.naturalWidth * guidanceState.scale;
            const gHeight = guidanceImage.naturalHeight * guidanceState.scale;
            const gLeft = guidanceState.x - gWidth / 2;
            const gTop = guidanceState.y - gHeight / 2;
            const relX = worldX - gLeft;
            const relY = worldY - gTop;

            if (relX >= 0 && relX <= gWidth && relY >= 0 && relY <= gHeight) {
                const srcCanvas = getProcessedGuidanceCanvas();
                if (srcCanvas instanceof HTMLCanvasElement) {
                    const ctx = srcCanvas.getContext('2d');
                    if (ctx) {
                        const imgX = Math.floor(relX / guidanceState.scale);
                        const imgY = Math.floor(relY / guidanceState.scale);
                        // Optimized read: single pixel
                        const pixel = ctx.getImageData(imgX, imgY, 1, 1).data;
                        if (pixel[3] > 10) {
                            setTooltipData({ x: e.clientX, y: e.clientY, color: `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})` });
                        } else {
                            setTooltipData(null);
                        }
                    }
                }
            } else {
                setTooltipData(null);
            }
        } else if (tooltipData) {
            setTooltipData(null);
        }

        if (isEditingGuidance && guidanceImage && e.buttons === 1 && lastMouseRef.current) {
            const dx = (e.clientX - lastMouseRef.current.x) / scale;
            const dy = (e.clientY - lastMouseRef.current.y) / scale;
            setGuidanceState(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            lastMouseRef.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (isPanning && lastMouseRef.current) {
            const dx = e.clientX - lastMouseRef.current.x;
            const dy = e.clientY - lastMouseRef.current.y;
            setOffsetX(prev => prev + dx / scale);
            setOffsetY(prev => prev + dy / scale);
            lastMouseRef.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (e.buttons === 1 && !isPanning && selectedColor && !isEditingGuidance) {
            paintPixel(e.clientX, e.clientY);
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
        lastMouseRef.current = null;
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const delta = -Math.sign(e.deltaY);
        const factor = Math.exp(delta * zoomIntensity);

        if (isEditingGuidance && guidanceImage) {
            setGuidanceState(prev => ({
                ...prev,
                scale: Math.max(0.001, Math.min(1000, prev.scale * factor))
            }));
        } else {
            setScale(s => Math.max(0.05, Math.min(100, s * factor)));
        }
    };

    const paintPixel = async (clientX: number, clientY: number) => {
        const { x, y } = screenToWorld(clientX, clientY);
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return;
        if (!selectedColor) return;

        const newColorIndex = COLOR_MAP[selectedColor];
        const currentIndex = pixelDataRef.current[y * GRID_WIDTH + x];
        if (newColorIndex === currentIndex) return;

        updateLocalPixel(x, y, newColorIndex);

        try {
            await supabase.from('pixel_history').insert({
                event_id: eventId,
                x,
                y,
                color_index: newColorIndex
            });
        } catch (err) {
            console.error("Error painting:", err);
        }
    };

    const handleUploadGuidance = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                setGuidanceImage(img);
                setGuidanceState({ x: 0, y: 0, scale: 1 });
                setIsEditingGuidance(true);
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    useEffect(() => {
        const handleResize = () => {
            if (displayCanvasRef.current && containerRef.current) {
                displayCanvasRef.current.width = window.innerWidth;
                displayCanvasRef.current.height = window.innerHeight;
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-[#1a1a1a] overflow-hidden">
            <canvas ref={dataCanvasRef} width={GRID_WIDTH} height={GRID_HEIGHT} className="hidden" />

            <div
                ref={containerRef}
                className="w-full h-full relative cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onContextMenu={(e) => e.preventDefault()}
            >
                <canvas ref={displayCanvasRef} className="block w-full h-full" style={{ touchAction: 'none' }} />

                {/* --- Top Bar --- */}
                <div className="absolute top-4 left-4 z-10 pointer-events-none">
                    <div className="bg-black/50 backdrop-blur text-white px-3 py-1.5 rounded-full text-xs font-mono border border-white/10 flex items-center gap-2 pointer-events-auto shadow-lg">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        {onlineUsers} online
                    </div>
                </div>

                <div className="absolute top-4 right-4 z-10 pointer-events-auto">
                    <button
                        onClick={onClose}
                        className="bg-red-500/90 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-all group"
                        title="Salir"
                    >
                        <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                    </button>
                </div>

                {/* --- Tooltip --- */}
                {tooltipData && (
                    <div className="fixed z-50 pointer-events-none flex items-center gap-2 bg-black/80 text-white text-xs px-2 py-1 rounded border border-white/20 shadow-xl"
                        style={{ left: tooltipData.x + 15, top: tooltipData.y + 15 }}>
                        <div className="w-4 h-4 rounded border border-white/50" style={{ backgroundColor: tooltipData.color }} />
                        <span className="font-mono">{tooltipData.color}</span>
                    </div>
                )}

                {/* --- Bottom Dock (Palette + Tools) --- */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-end gap-3 pointer-events-none max-w-[95vw]">

                    {/* Palette */}
                    <div className="pointer-events-auto shadow-2xl rounded-2xl overflow-hidden border border-white/10">
                        <Palette
                            selectedColor={isPanning || isEditingGuidance ? null : selectedColor}
                            onSelectColor={(c) => {
                                if (isEditingGuidance) setIsEditingGuidance(false);
                                setSelectedColor(c);
                                setIsPanning(false);
                            }}
                            className="border-none bg-black/80 backdrop-blur-md"
                        />
                    </div>

                    {/* Guidance Tool Button */}
                    <div className="relative pointer-events-auto">
                        {showGuidancePanel && (
                            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-64 bg-black/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-4 text-gray-200 flex flex-col gap-4 animate-in slide-in-from-bottom-2 fade-in duration-200">
                                <div className="flex items-center justify-between text-xs font-bold text-white uppercase tracking-wider">
                                    <span>Guía / Plantilla</span>
                                    {guidanceImage && (
                                        <button onClick={() => { setGuidanceImage(null); setIsEditingGuidance(false); }} className="text-red-400 hover:text-red-300 p-1">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {!guidanceImage ? (
                                    <button
                                        onClick={() => document.getElementById('guidance-upload')?.click()}
                                        className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/10 hover:bg-white/20 text-sm transition-all border border-white/5 border-dashed"
                                    >
                                        <Upload className="w-4 h-4" />
                                        Subir Imagen
                                    </button>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Opacity */}
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-[10px] text-gray-400">
                                                <span>Opacidad</span>
                                                <span>{Math.round(guidanceOpacity * 100)}%</span>
                                            </div>
                                            <input
                                                type="range" min="0" max="1" step="0.05"
                                                value={guidanceOpacity}
                                                onChange={(e) => setGuidanceOpacity(parseFloat(e.target.value))}
                                                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                            />
                                        </div>

                                        {/* Pixelation */}
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-[10px] text-gray-400">
                                                <span>Pixelado (Ayuda)</span>
                                                <span>{guidancePixelation}x</span>
                                            </div>
                                            <div className="flex gap-2 items-center">
                                                <GridIcon className="w-3.5 h-3.5 text-gray-500" />
                                                <input
                                                    type="range" min="1" max="20" step="1"
                                                    value={guidancePixelation}
                                                    onChange={(e) => setGuidancePixelation(parseInt(e.target.value))}
                                                    className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                                />
                                            </div>
                                        </div>

                                        {/* Edit Mode Toggle */}
                                        <button
                                            onClick={() => setIsEditingGuidance(!isEditingGuidance)}
                                            className={cn(
                                                "w-full flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-bold transition-all border",
                                                isEditingGuidance
                                                    ? "bg-amber-500/20 text-amber-400 border-amber-500/50"
                                                    : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                                            )}
                                        >
                                            {isEditingGuidance ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                            {isEditingGuidance ? "Moviendo..." : "Posición Fija"}
                                        </button>
                                    </div>
                                )}
                                <input id="guidance-upload" type="file" accept="image/*" className="hidden" onChange={(e) => {
                                    if (e.target.files?.[0]) handleUploadGuidance(e.target.files[0]);
                                }} />
                            </div>
                        )}
                        <button
                            onClick={() => setShowGuidancePanel(!showGuidancePanel)}
                            className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-lg border",
                                showGuidancePanel
                                    ? "bg-blue-600 text-white border-blue-400 scale-110"
                                    : "bg-black/80 backdrop-blur-md text-gray-300 border-white/10 hover:bg-black/90 hover:scale-105"
                            )}
                            title="Herramientas de Guía"
                        >
                            <ImageIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* --- Bottom Right NavControls --- */}
                <div className="absolute bottom-8 right-6 z-20">
                    <NavigationControls
                        scale={scale}
                        onZoomIn={() => setScale(s => Math.min(50, s * 1.2))}
                        onZoomOut={() => setScale(s => Math.max(0.1, s * 0.8))}
                        onReset={() => { setScale(1); setOffsetX(0); setOffsetY(0); }}
                        isPanning={isPanning}
                        onTogglePan={() => { setIsPanning(!isPanning); if (!isPanning) setSelectedColor(null); }}
                    />
                </div>

                {isEditingGuidance && (
                    <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-amber-500/90 backdrop-blur text-white px-6 py-2 rounded-full shadow-2xl border border-amber-400/50 pointer-events-none animate-pulse z-30 font-semibold text-sm flex items-center gap-2">
                        <Move className="w-4 h-4" />
                        Arrastra para mover • Scroll para escalar
                    </div>
                )}
            </div>
        </div>
    );
}
