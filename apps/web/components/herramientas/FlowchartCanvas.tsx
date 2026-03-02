'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
    Pencil, Eraser, Trash2, Save, RotateCcw,
    Maximize, CheckCircle2, Minimize2, Undo2, Redo2, Hand
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Point { x: number; y: number; }
interface Path { points: Point[]; mode: 'draw' | 'stamp'; color: string; size?: number; }
interface FlowchartCanvasProps {
    imageUrl: string;
    initialData?: Path[];
    onSave: (data: Path[]) => void;
    isSaving?: boolean;
}

export default function FlowchartCanvas({ imageUrl, initialData = [], onSave, isSaving = false }: FlowchartCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // ─── REACT STATE (drives DOM rendering) ───────────────────────────────────
    const [mode, setMode] = useState<'draw' | 'stamp' | 'erase' | 'pan'>('draw');
    const [color, setColor] = useState('#10b981');
    const [brushSize, setBrushSize] = useState(15);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const [isImmersive, setIsImmersive] = useState(false);
    const [stampImg, setStampImg] = useState<HTMLImageElement | null>(null);
    const [paths, setPaths] = useState<Path[]>(initialData);
    const [history, setHistory] = useState<Path[][]>([initialData]);
    const [historyIdx, setHistoryIdx] = useState(0);
    const [currentPath, setCurrentPath] = useState<Point[]>([]);

    // ─── REFS (for use inside non-React event listeners) ──────────────────────
    const scaleRef = useRef(1);
    const offsetRef = useRef({ x: 0, y: 0 });
    const modeRef = useRef<'draw' | 'stamp' | 'erase' | 'pan'>('draw');
    const colorRef = useRef('#10b981');
    const brushSizeRef = useRef(15);
    const pathsRef = useRef<Path[]>(initialData);
    const historyRef = useRef<Path[][]>([initialData]);
    const historyIdxRef = useRef(0);
    const isDrawingRef = useRef(false);
    const isPanningRef = useRef(false);
    const currentPathRef = useRef<Point[]>([]);
    const lastMouseRef = useRef({ x: 0, y: 0 });
    const touchDistRef = useRef<number | null>(null);

    // Keep refs in sync with state
    useEffect(() => { modeRef.current = mode; }, [mode]);
    useEffect(() => { colorRef.current = color; }, [color]);
    useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);
    useEffect(() => { scaleRef.current = scale; }, [scale]);
    useEffect(() => { offsetRef.current = offset; }, [offset]);

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#ffffff', '#000000'];
    const STAMP_SIZE = 600;

    // ─── STAMP IMAGE LOAD ──────────────────────────────────────────────────────
    useEffect(() => {
        const urls = [
            '/cellos/Gemini_Generated_Image_1cxzh91cxzh91cxz.png',
            '/cellos/aprov.svg',
        ];
        (async () => {
            for (const url of urls) {
                try {
                    const img = new Image();
                    img.src = url;
                    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });
                    if (img.naturalWidth > 0) { setStampImg(img); return; }
                } catch { }
            }
        })();
    }, []);

    // ─── HISTORY HELPERS ──────────────────────────────────────────────────────
    const commitHistory = useCallback((newPaths: Path[]) => {
        const newHist = historyRef.current.slice(0, historyIdxRef.current + 1);
        newHist.push([...newPaths]);
        if (newHist.length > 50) newHist.shift();
        historyRef.current = newHist;
        historyIdxRef.current = newHist.length - 1;
        pathsRef.current = newPaths;
        setPaths(newPaths);
        setHistory(newHist);
        setHistoryIdx(newHist.length - 1);
    }, []);

    const undo = () => {
        if (historyIdxRef.current > 0) {
            historyIdxRef.current--;
            const p = [...historyRef.current[historyIdxRef.current]];
            pathsRef.current = p;
            setPaths(p);
            setHistoryIdx(historyIdxRef.current);
        }
    };
    const redo = () => {
        if (historyIdxRef.current < historyRef.current.length - 1) {
            historyIdxRef.current++;
            const p = [...historyRef.current[historyIdxRef.current]];
            pathsRef.current = p;
            setPaths(p);
            setHistoryIdx(historyIdxRef.current);
        }
    };

    // ─── CENTERING ────────────────────────────────────────────────────────────
    const centerView = useCallback(() => {
        const container = containerRef.current;
        if (!container || imageSize.width === 0) return;
        const { clientWidth: cw, clientHeight: ch } = container;
        const fs = Math.min((cw - 40) / imageSize.width, (ch - 40) / imageSize.height, 1);
        const newOffset = {
            x: Math.round((cw - imageSize.width * fs) / 2),
            y: Math.round((ch - imageSize.height * fs) / 2),
        };
        scaleRef.current = fs;
        offsetRef.current = newOffset;
        setScale(fs);
        setOffset(newOffset);
    }, [imageSize]);

    // Load image metadata
    useEffect(() => {
        if (!imageUrl) return;
        const img = new Image();
        img.onload = () => {
            setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
            if (canvasRef.current) {
                canvasRef.current.width = img.naturalWidth;
                canvasRef.current.height = img.naturalHeight;
            }
        };
        img.src = imageUrl;
    }, [imageUrl]);

    // Center once image size known
    useEffect(() => {
        if (imageSize.width > 0) setTimeout(centerView, 80);
    }, [imageSize, centerView]);

    useEffect(() => {
        if (isImmersive && imageSize.width > 0) setTimeout(centerView, 350);
    }, [isImmersive, imageSize, centerView]);

    // ─── CANVAS DRAW ──────────────────────────────────────────────────────────
    const drawStamp = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, c: string) => {
        if (stampImg) {
            const w = STAMP_SIZE;
            const h = w * (stampImg.naturalHeight / stampImg.naturalWidth);
            ctx.drawImage(stampImg, x - w / 2, y - h / 2, w, h);
        } else {
            ctx.save();
            ctx.translate(x, y); ctx.rotate(-0.15);
            ctx.strokeStyle = c; ctx.lineWidth = 4;
            ctx.strokeRect(-65, -22, 130, 44);
            ctx.fillStyle = c;
            ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('APROBADO', 0, 0);
            ctx.restore();
        }
    }, [stampImg]);

    // Render on every relevant state change
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        [...paths, ...(currentPath.length > 0 ? [{
            points: currentPath,
            mode: (modeRef.current === 'erase' ? 'draw' : modeRef.current) as any,
            color, size: brushSize
        }] : [])].forEach(path => {
            if (!path.points.length) return;
            if (path.mode === 'stamp') {
                path.points.forEach(p => drawStamp(ctx, p.x, p.y, path.color));
            } else {
                ctx.beginPath();
                ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.strokeStyle = path.color;
                ctx.lineWidth = path.size ?? brushSize;
                ctx.globalAlpha = 0.85;
                ctx.moveTo(path.points[0].x, path.points[0].y);
                path.points.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        });
    }, [paths, currentPath, color, brushSize, drawStamp]);

    // ─── EVENT LISTENERS (non-passive, DOM-level) ─────────────────────────────
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const toCanvas = (cx: number, cy: number): Point => {
            const r = el.getBoundingClientRect();
            return {
                x: (cx - r.left - offsetRef.current.x) / scaleRef.current,
                y: (cy - r.top - offsetRef.current.y) / scaleRef.current,
            };
        };

        const applyZoom = (delta: number, pivotX: number, pivotY: number) => {
            const s = scaleRef.current;
            const ns = Math.min(Math.max(s * delta, 0.03), 30);
            const r = el.getBoundingClientRect();
            const mx = pivotX - r.left;
            const my = pivotY - r.top;
            const dx = (mx - offsetRef.current.x) / s;
            const dy = (my - offsetRef.current.y) / s;
            const no = { x: mx - dx * ns, y: my - dy * ns };
            scaleRef.current = ns;
            offsetRef.current = no;
            setScale(ns);
            setOffset({ ...no });
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            applyZoom(e.deltaY > 0 ? 0.9 : 1.1, e.clientX, e.clientY);
        };

        const onMouseDown = (e: MouseEvent) => {
            if (!isImmersive) return;
            const pan = modeRef.current === 'pan' || e.button === 1 || e.button === 2;
            if (pan) {
                isPanningRef.current = true;
                lastMouseRef.current = { x: e.clientX, y: e.clientY };
                el.style.cursor = 'grabbing';
                return;
            }
            const p = toCanvas(e.clientX, e.clientY);
            if (modeRef.current === 'erase') {
                const thr = 25 / scaleRef.current;
                const np = pathsRef.current.filter(path =>
                    !path.points.some(pt => Math.hypot(pt.x - p.x, pt.y - p.y) < thr)
                );
                if (np.length !== pathsRef.current.length) commitHistory(np);
            } else if (modeRef.current === 'stamp') {
                commitHistory([...pathsRef.current, { mode: 'stamp', color: colorRef.current, points: [p] }]);
            } else {
                isDrawingRef.current = true;
                currentPathRef.current = [p];
                setCurrentPath([p]);
            }
        };

        const onMouseMove = (e: MouseEvent) => {
            if (isPanningRef.current) {
                const dx = e.clientX - lastMouseRef.current.x;
                const dy = e.clientY - lastMouseRef.current.y;
                lastMouseRef.current = { x: e.clientX, y: e.clientY };
                offsetRef.current = { x: offsetRef.current.x + dx, y: offsetRef.current.y + dy };
                setOffset({ ...offsetRef.current });
                return;
            }
            if (isDrawingRef.current) {
                const p = toCanvas(e.clientX, e.clientY);
                currentPathRef.current = [...currentPathRef.current, p];
                setCurrentPath([...currentPathRef.current]);
            }
        };

        const onMouseUp = () => {
            if (isDrawingRef.current && currentPathRef.current.length > 1) {
                commitHistory([...pathsRef.current, {
                    points: [...currentPathRef.current],
                    mode: 'draw', color: colorRef.current, size: brushSizeRef.current
                }]);
            }
            isDrawingRef.current = false;
            isPanningRef.current = false;
            currentPathRef.current = [];
            setCurrentPath([]);
            el.style.cursor = modeRef.current === 'pan' ? 'grab' : 'crosshair';
        };

        const onTouchStart = (e: TouchEvent) => {
            if (!isImmersive) return;
            if (e.touches.length === 2) {
                touchDistRef.current = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                return;
            }
            const t = e.touches[0];
            onMouseDown(new MouseEvent('mousedown', { clientX: t.clientX, clientY: t.clientY, button: 0 } as any));
        };

        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && touchDistRef.current) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                applyZoom(dist / touchDistRef.current, cx, cy);
                touchDistRef.current = dist;
                return;
            }
            if (e.touches.length === 1) {
                const t = e.touches[0];
                onMouseMove(new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY } as any));
            }
        };

        const onTouchEnd = () => { touchDistRef.current = null; onMouseUp(); };
        const noCtx = (e: Event) => e.preventDefault();

        el.addEventListener('wheel', onWheel, { passive: false });
        el.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        el.addEventListener('touchstart', onTouchStart, { passive: false });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd);
        el.addEventListener('contextmenu', noCtx);

        return () => {
            el.removeEventListener('wheel', onWheel);
            el.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            el.removeEventListener('contextmenu', noCtx);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isImmersive, commitHistory]);

    // ─── UI ──────────────────────────────────────────────────────────────────
    return (
        <div className={cn(
            "relative select-none overflow-hidden transition-all duration-300",
            isImmersive ? "fixed inset-0 z-[9999] bg-black" : "h-full w-full rounded-3xl bg-black/30"
        )}>
            {/* ── Immersive UI ─────────────────────────────────────────────── */}
            <AnimatePresence>
                {isImmersive && (
                    <>
                        {/* Sidebar tools */}
                        <motion.div
                            initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -60, opacity: 0 }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 z-[10000] flex flex-col gap-3 p-3 bg-black/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-y-auto no-scrollbar"
                            style={{ maxHeight: 'calc(100vh - 80px)' }}
                        >
                            {([
                                { m: 'draw', icon: <Pencil className="w-5 h-5" />, label: 'Pincel' },
                                { m: 'stamp', icon: <CheckCircle2 className="w-5 h-5" />, label: 'Sello' },
                                { m: 'pan', icon: <Hand className="w-5 h-5" />, label: 'Mover' },
                                { m: 'erase', icon: <Eraser className="w-5 h-5" />, label: 'Borrar' },
                            ] as const).map(({ m, icon }) => (
                                <Button key={m} variant="ghost" size="icon" onClick={() => setMode(m)}
                                    className={cn("h-12 w-12 rounded-2xl transition-all duration-200", mode === m ? (m === 'pan' ? "bg-blue-500 text-white" : "bg-emerald-500 text-white") : "text-zinc-400 hover:text-white hover:bg-white/10")}
                                >{icon}</Button>
                            ))}

                            <div className="h-px w-8 bg-white/10 mx-auto" />

                            <div className="grid grid-cols-2 gap-1.5">
                                {COLORS.map(c => (
                                    <button key={c} title={c}
                                        className={cn("w-6 h-6 rounded-full border-2 transition-transform", color === c ? "border-white scale-125 shadow-lg" : "border-transparent opacity-50 hover:opacity-80 hover:scale-110")}
                                        style={{ backgroundColor: c }}
                                        onClick={() => setColor(c)}
                                    />
                                ))}
                            </div>

                            <div className="h-px w-8 bg-white/10 mx-auto" />

                            {/* Brush size slider (vertical) */}
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-[8px] text-white/40 font-bold">GROSOR</span>
                                <span className="text-[10px] text-white font-black">{brushSize}</span>
                                <input type="range" min="3" max="80" value={brushSize}
                                    onChange={e => setBrushSize(+e.target.value)}
                                    className="w-20 accent-emerald-400 -rotate-90 my-7"
                                    style={{ height: '6px' }}
                                />
                            </div>

                            <div className="h-px w-8 bg-white/10 mx-auto" />

                            <Button variant="ghost" size="icon" disabled={historyIdx === 0} onClick={undo} className="h-10 w-10 text-zinc-400 disabled:opacity-20 hover:text-white"><Undo2 className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" disabled={historyIdx === history.length - 1} onClick={redo} className="h-10 w-10 text-zinc-400 disabled:opacity-20 hover:text-white"><Redo2 className="w-4 h-4" /></Button>
                        </motion.div>

                        {/* Top bar */}
                        <motion.div
                            initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
                            className="absolute top-4 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-4 px-6 py-2.5 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl"
                        >
                            <div className="text-center min-w-[3rem]">
                                <p className="text-[9px] font-black text-emerald-400 tracking-widest">ZOOM</p>
                                <p className="text-sm font-black text-white leading-none">{Math.round(scale * 100)}%</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-white" onClick={centerView}><Maximize className="w-4 h-4" /></Button>
                            <div className="h-7 w-px bg-white/10" />
                            <Button onClick={() => onSave(paths)} disabled={isSaving} className="h-10 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-black text-white gap-2 active:scale-95 transition-transform">
                                {isSaving ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Guardar
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setIsImmersive(false)} className="h-10 w-10 rounded-xl bg-zinc-800 text-white hover:bg-zinc-700"><Minimize2 className="w-5 h-5" /></Button>
                        </motion.div>

                        {/* Trash button */}
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute bottom-8 right-8 z-[10000]">
                            <Button variant="ghost" size="icon" onClick={() => confirm('¿Borrar todo?') && commitHistory([])} className="h-12 w-12 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-5 h-5" /></Button>
                        </motion.div>

                        {/* Hint */}
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[10000] text-[9px] text-white/30 font-bold tracking-widest uppercase bg-black/40 px-4 py-1 rounded-full whitespace-nowrap">
                            Scroll: Zoom&nbsp;•&nbsp;Botón derecho / Manito: Mover&nbsp;•&nbsp;Pellizco: Zoom móvil
                        </div>
                    </>
                )}
            </AnimatePresence>

            {/* ── Canvas container ─────────────────────────────────────────── */}
            <div
                ref={containerRef}
                className={cn("relative w-full h-full touch-none", !isImmersive ? "cursor-pointer" : (mode === 'pan' ? "cursor-grab" : "cursor-crosshair"))}
                onClick={() => !isImmersive && setIsImmersive(true)}
            >
                {/* Click-to-enter overlay */}
                {!isImmersive && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors">
                        <span className="bg-emerald-500 text-white text-[11px] font-black uppercase tracking-[0.15em] px-6 py-3 rounded-full shadow-2xl shadow-emerald-500/30 animate-pulse">
                            Entrar a Modo Edición
                        </span>
                    </div>
                )}

                {/* Transformed viewport — driven by REACT STATE, so it updates! */}
                {imageSize.width > 0 && (
                    <div
                        className="absolute top-0 left-0 origin-top-left will-change-transform"
                        style={{
                            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                            width: imageSize.width,
                            height: imageSize.height,
                        }}
                    >
                        <img
                            src={imageUrl}
                            alt="Flujograma"
                            className="absolute inset-0 block pointer-events-none"
                            style={{ width: imageSize.width, height: imageSize.height }}
                            draggable={false}
                        />
                        <canvas
                            ref={canvasRef}
                            className="absolute inset-0 pointer-events-none"
                            width={imageSize.width || 1}
                            height={imageSize.height || 1}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
