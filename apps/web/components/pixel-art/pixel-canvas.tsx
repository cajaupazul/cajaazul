'use client';


import { useRef, useEffect, useState, useCallback } from 'react';
import { supabase, getStorageUrl, ShopItem } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { AvatarWithFrame } from '@/components/ui/AvatarWithFrame';
import { Palette, COLOR_PALETTE, COLOR_MAP } from './palette';
import { NavigationControls } from './overlay-controls';
import { ProfileStatsPanel } from './profile-stats-panel';
import { usePixelStats } from './use-pixel-stats';
import { useTemplateSlots, TemplateSlot } from './use-template-slots';
import { TemplateSlotBar } from './template-slot-bar';
import {
    Download,
    Share2,
    Undo,
    Redo,
    ZoomIn,
    ZoomOut,
    Move,
    Grid,
    Maximize,
    MousePointer2,
    Trash2,
    Upload,
    ImageIcon,
    X,
    CheckCircle,
    Copy,
    Save,
    Eye,
    EyeOff,
    History,
    Home,
    Plus,
    Minus,
    Sparkles,
    Eraser,
    Lock,
    Unlock,
    Info,
    Check,
    Pencil
} from 'lucide-react';

// High Contrast Cursor (Black with White Border)
const BLACK_CROSSHAIR_CURSOR = `url('data:image/svg+xml;utf8,<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3V21M3 12H21" stroke="white" stroke-width="3" stroke-linecap="square"/><path d="M12 4V20M4 12H20" stroke="black" stroke-width="1.5" stroke-linecap="square"/></svg>') 12 12, crosshair`;

// Default dimensions (can be overridden by database)
const DEFAULT_gridWidth = 1000;
const DEFAULT_gridHeight = 1000;

// Special index for Eraser (Transparent)
const ERASER_INDEX = 255;

// Pre-compute integer colors for faster 32-bit writes
const computeUint32Colors = (palette: string[]) => {
    // Size 256 to accommodate the eraser index at 255
    const buffer = new Uint32Array(256);
    palette.forEach((hex, i) => {
        // Hex is #RRGGBB
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const a = 255;

        // ABGR for Little Endian
        buffer[i] = (a << 24) | (b << 16) | (g << 8) | r;
    });

    // Set Index 255 to Transparent (0x00000000)
    buffer[ERASER_INDEX] = 0; // Fully transparent

    return buffer;
};

const UINT32_PALETTE = computeUint32Colors(COLOR_PALETTE);

const hexToUint32 = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (255 << 24) | (b << 16) | (g << 8) | r;
};

const rgbToHex = (r: number, g: number, b: number) => {
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
};

// --- Professional Color Math (OKLab & Linear) ---

interface Lab {
    l: number;
    a: number;
    b: number;
}

// sRGB to Linear (Gamma Corection)
const srgbToLinear = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

// Linear RGB to OKLab
const linearToOKLab = (r: number, g: number, b: number): Lab => {
    const l_ = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m_ = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s_ = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

    const l = Math.cbrt(l_);
    const m = Math.cbrt(m_);
    const s = Math.cbrt(s_);

    return {
        l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    };
};

const hexToOKLab = (hex: string): Lab => {
    const r = srgbToLinear(parseInt(hex.slice(1, 3), 16));
    const g = srgbToLinear(parseInt(hex.slice(3, 5), 16));
    const b = srgbToLinear(parseInt(hex.slice(5, 7), 16));
    return linearToOKLab(r, g, b);
};

// --- Pre-processed Palette Data ---
const PALETTE_OKLAB = COLOR_PALETTE.map(hexToOKLab);

interface GuidanceHistoryItem {
    image: string;
    opacity: number;
    gridStep: number;
    state: { x: number, y: number, scale: number };
}

interface PixelCanvasProps {
    eventId: string;
    onClose: () => void;
    userProfile?: any;
    equippedFrame?: ShopItem | null;
}

export default function PixelCanvas({ eventId, onClose, userProfile, equippedFrame }: PixelCanvasProps) {
    const displayCanvasRef = useRef<HTMLCanvasElement>(null);
    const dataCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const guidanceCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const [scale, setScale] = useState(1);
    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);

    const [selectedColor, setSelectedColor] = useState<string | null>('#000000');
    // Helper to track if we are in 'mode' eraser
    const isEraser = selectedColor === 'eraser';

    const [gridWidth, setGridWidth] = useState(DEFAULT_gridWidth);
    const [gridHeight, setGridHeight] = useState(DEFAULT_gridHeight);

    const [isPanning, setIsPanning] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(1);

    // Interaction Refs for Drag vs Click detection
    const dragStartRef = useRef<{ x: number, y: number } | null>(null);
    const isDraggingRef = useRef(false);

    // UI State
    const [isPaintMode, setIsPaintMode] = useState(false);
    const isPaintModeRef = useRef(false);

    // Stats & Profile logic decoupled
    const { pixelsPainted, incrementLocalCount } = usePixelStats(userProfile?.id, eventId);
    const [showProfilePanel, setShowProfilePanel] = useState(false);

    // Cursor Tracking
    const [cursorGridPos, setCursorGridPos] = useState<{ x: number, y: number } | null>(null);
    const cursorGridPosRef = useRef<{ x: number, y: number } | null>(null);

    // Guidance State
    const [guidanceImage, setGuidanceImage] = useState<HTMLImageElement | null>(null);
    const [guidanceOpacity, setGuidanceOpacity] = useState(0.5);
    const [guidanceGridStep, setGuidanceGridStep] = useState(1); // N pixels per block
    const [isEditingGuidance, setIsEditingGuidance] = useState(false);
    const [guidanceState, setGuidanceState] = useState({ x: 0, y: 0, scale: 1 });
    const [showGuidancePanel, setShowGuidancePanel] = useState(false);
    const [isSmartPicking, setIsSmartPicking] = useState(false);

    // WPlace Slot System
    const { slots: guidanceHistory, saveSlot, deleteSlot } = useTemplateSlots(userProfile?.id, eventId);

    const [tooltipData, setTooltipData] = useState<{ x: number, y: number, color: string } | null>(null);

    // Use a Ref for pixel data: Now 32-bit for True Color support
    const pixelDataRef = useRef<Uint32Array>(new Uint32Array(DEFAULT_gridWidth * DEFAULT_gridHeight).fill(0)); // 0 = Transparent/Eraser

    const lastMouseRef = useRef<{ x: number, y: number } | null>(null);

    // Pending Pixels: Coordinate -> HEX string OR Palette Index (number)
    const [pendingPixels, setPendingPixels] = useState<Map<string, string | number>>(new Map());
    const pendingPixelsRef = useRef<Map<string, string | number>>(new Map());

    // --- Analytical Sampling Buffers ---
    const guidanceRawDataRef = useRef<ImageData | null>(null);
    const colorMatchCacheRef = useRef<Map<number, number>>(new Map()); // uint32 RGBA -> palette index

    // Web Audio Context for sound effects
    const audioContextRef = useRef<AudioContext | null>(null);

    const playPaintSound = () => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioContextRef.current;
            if (ctx.state === 'suspended') ctx.resume();

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(600, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);

            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.1);
        } catch (e) {
            // Ignore audio errors
        }
    };

    // Optimization Flags
    const needsRedrawRef = useRef(true);
    const isRunningRef = useRef(true);
    const frameIdRef = useRef<number>(0);
    const [isSaving, setIsSaving] = useState(false);

    // --- Persistence (LocalStorage) ---

    useEffect(() => {
        if (!eventId || !userProfile?.id) return;
        const storageKey = `pixel-art-pending-${eventId}-${userProfile.id}`;

        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.pending) {
                    const pendingMap = new Map<string, string | number>(data.pending);
                    setPendingPixels(pendingMap);
                    pendingPixelsRef.current = pendingMap;
                    needsRedrawRef.current = true;
                }
            } catch (e) {
                console.error("Error loading pending pixel persistence:", e);
            }
        }
    }, [eventId, userProfile?.id]);

    // Guidance image / state sync to slot system
    useEffect(() => {
        if (!guidanceImage || !userProfile?.id) return;

        // Auto-update the active slot meta-data periodically or on change
        saveSlot({
            image: guidanceImage.src,
            opacity: guidanceOpacity,
            gridStep: guidanceGridStep,
            state: guidanceState
        });
    }, [guidanceOpacity, guidanceGridStep, guidanceState, guidanceImage, userProfile?.id]);

    useEffect(() => {
        if (!eventId || !userProfile?.id) return;
        const storageKey = `pixel-art-pending-${eventId}-${userProfile.id}`;

        const dataToSave = {
            pending: Array.from(pendingPixelsRef.current.entries())
        };

        try {
            localStorage.setItem(storageKey, JSON.stringify(dataToSave));
        } catch (err) {
            console.error("[STORAGE] Error saving pending pixels:", err);
        }
    }, [eventId, userProfile?.id, pendingPixels]);

    // --- Data Fetching & Subscription ---

    const fetchGridData = async () => {
        try {
            // ARCHITECTURE CHANGE: Fetch state as a single blob via RPC to maintain performance
            const { data, error } = await supabase.rpc('get_pixel_board_blob', {
                p_event_id: eventId,
                p_width: gridWidth,
                p_height: gridHeight
            });

            if (data) {
                let bytes: Uint8Array;
                if (typeof data === 'string') {
                    const hex = data.startsWith('\\x') ? data.slice(2) : data;
                    const len = hex.length / 2;
                    bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
                    }
                } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
                    bytes = new Uint8Array(data as any);
                } else {
                    bytes = new Uint8Array(data as any);
                }

                const expectedSizeIndex = gridWidth * gridHeight;
                const expectedSizeTrueColor = gridWidth * gridHeight * 4;

                if (bytes.length === expectedSizeTrueColor) {
                    // True Color 32-bit buffer
                    pixelDataRef.current = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
                } else {
                    // Legacy 8-bit index buffer
                    const uint32buf = new Uint32Array(gridWidth * gridHeight);
                    for (let i = 0; i < bytes.length; i++) {
                        const idx = bytes[i];
                        uint32buf[i] = idx === ERASER_INDEX ? 0 : UINT32_PALETTE[idx];
                    }
                    pixelDataRef.current = uint32buf;
                }

                updateDataCanvasFull();
                needsRedrawRef.current = true;
            }
        } catch (e) {
            console.error("Error fetching board:", e);
        }
    };

    const updateLocalPixel = (x: number, y: number, color: number | string) => {
        if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
            const idx = y * gridWidth + x;
            const uint32 = typeof color === 'string' ? hexToUint32(color) : (color === ERASER_INDEX ? 0 : UINT32_PALETTE[color]);
            pixelDataRef.current[idx] = uint32;

            const ctx = dataCanvasRef.current?.getContext('2d');
            if (ctx) {
                if (uint32 === 0) {
                    ctx.clearRect(x, y, 1, 1);
                } else {
                    const r = uint32 & 0xFF;
                    const g = (uint32 >> 8) & 0xFF;
                    const b = (uint32 >> 16) & 0xFF;
                    ctx.fillStyle = `rgb(${r},${g},${b})`;
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            needsRedrawRef.current = true;
        }
    };

    // 1. Initial Fetch and Real-time Board State (Single Source of Truth)
    useEffect(() => {
        let boardChannel: any;

        const setupBoardSync = async () => {
            // Initial load using optimized RPC blob
            await fetchGridData();

            // Realtime subscription to the row-based state
            boardChannel = supabase
                .channel(`board-state-${eventId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*', // Sync any change to the board (INSERT or UPDATE)
                        schema: 'public',
                        table: 'pixel_board_state',
                        filter: `event_id=eq.${eventId}`
                    },
                    (payload) => {
                        const { x, y, color_index, color_hex } = payload.new as any;
                        const drawValue = color_hex || color_index;
                        updateLocalPixel(x, y, drawValue);
                    }
                )
                .subscribe();
        };

        setupBoardSync();

        return () => {
            if (boardChannel) supabase.removeChannel(boardChannel);
        };
    }, [eventId]);

    // 2. Real-time Painting (Presence and Individual Pixels)
    useEffect(() => {
        const paintChannel = supabase.channel(`pixel-art-${eventId}`);

        const initPaint = async () => {
            paintChannel
                .on('presence', { event: 'sync' }, () => {
                    const state = paintChannel.presenceState();
                    setOnlineUsers(Object.keys(state).length || 1);
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        await paintChannel.track({ online_at: new Date().toISOString(), user_id: userProfile?.id });
                    }
                });
        };

        if (eventId) initPaint();

        return () => {
            supabase.removeChannel(paintChannel);
            isRunningRef.current = false;
            cancelAnimationFrame(frameIdRef.current);
        };
    }, [eventId, userProfile]);


    // --- Image Processing (Mathematically Grid-Linked) ---
    const getProcessedGuidanceCanvas = useCallback(() => {
        if (!guidanceImage) return null;

        const step = guidanceGridStep;
        const w = guidanceImage.naturalWidth;
        const h = guidanceImage.naturalHeight;

        if (!guidanceCanvasRef.current) {
            guidanceCanvasRef.current = document.createElement('canvas');
        }
        const canvas = guidanceCanvasRef.current;
        if (!canvas) return null;

        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return null;

        // Visual position and size in world units
        const gWidthWorld = w * guidanceState.scale;
        const gHeightWorld = h * guidanceState.scale;

        // DIMENSION GUARD: Ensure we don't try to create a 0-size canvas
        const bufferWidth = Math.max(1, Math.ceil(gWidthWorld / step));
        const bufferHeight = Math.max(1, Math.ceil(gHeightWorld / step));

        // We use the offscreen canvas as a buffer
        canvas.width = bufferWidth;
        canvas.height = bufferHeight;

        // Visual Smoothing: For the hint, we can keep it as is or disable it
        // The user specifically requested real pixels, so let's disable smoothing for the hint too
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(guidanceImage, 0, 0, bufferWidth, bufferHeight);

        return canvas;
    }, [guidanceImage, guidanceGridStep, guidanceState.scale]);


    // --- Rendering Optimization ---

    const updateDataCanvasFull = useCallback(() => {
        const canvas = dataCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const imageData = ctx.createImageData(gridWidth, gridHeight);
        const data32 = new Uint32Array(imageData.data.buffer);
        const pixels = pixelDataRef.current;
        data32.set(pixels);

        ctx.putImageData(imageData, 0, 0);
    }, [gridWidth, gridHeight]);

    const render = useCallback(() => {
        if (!isRunningRef.current) return;

        const displayCanvas = displayCanvasRef.current;
        const dataCanvas = dataCanvasRef.current;

        if (displayCanvas && dataCanvas) {
            const ctx = displayCanvas.getContext('2d', { alpha: false });
            if (ctx) {
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, displayCanvas.width, displayCanvas.height);

                ctx.save();
                ctx.translate(displayCanvas.width / 2, displayCanvas.height / 2);
                ctx.scale(scale, scale);
                ctx.translate(offsetX, offsetY);

                const pixelStartX = -gridWidth / 2;
                const pixelStartY = -gridHeight / 2;

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(pixelStartX, pixelStartY, gridWidth, gridHeight);

                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(dataCanvas, pixelStartX, pixelStartY);

                const drawableGuidance = getProcessedGuidanceCanvas();
                if (drawableGuidance && guidanceImage) {
                    ctx.save();
                    ctx.globalAlpha = guidanceOpacity;

                    const step = guidanceGridStep;
                    const gWidth = guidanceImage.naturalWidth * guidanceState.scale;
                    const gHeight = guidanceImage.naturalHeight * guidanceState.scale;
                    const startX = guidanceState.x - gWidth / 2;
                    const startY = guidanceState.y - gHeight / 2;

                    // SNAPPING: Find the top-left of the first grid block that covers the image
                    const snappedStartX = Math.floor(startX / step) * step;
                    const snappedStartY = Math.floor(startY / step) * step;

                    // Draw the pre-processed tiny buffer back as huge grid blocks
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(
                        drawableGuidance,
                        snappedStartX,
                        snappedStartY,
                        drawableGuidance.width * step,
                        drawableGuidance.height * step
                    );

                    if (isEditingGuidance) {
                        // Pulsating orange highlight to find the image
                        const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
                        ctx.strokeStyle = `rgba(245, 158, 11, ${0.4 + pulse * 0.6})`;
                        ctx.lineWidth = 4 / scale;
                        ctx.setLineDash([15 / scale, 10 / scale]);
                        ctx.strokeRect(startX, startY, gWidth, gHeight);
                        ctx.setLineDash([]);

                        // Corners for clarity
                        const cornerSize = 30 / scale;
                        ctx.fillStyle = '#f59e0b';
                        // Top Left
                        ctx.fillRect(startX, startY, cornerSize, 4 / scale);
                        ctx.fillRect(startX, startY, 4 / scale, cornerSize);
                        // Bottom Right
                        ctx.fillRect(startX + gWidth - cornerSize, startY + gHeight - 4 / scale, cornerSize, 4 / scale);
                        ctx.fillRect(startX + gWidth - 4 / scale, startY + gHeight - cornerSize, 4 / scale, cornerSize);

                        needsRedrawRef.current = true; // Keep animating the pulse
                    }
                    ctx.restore();
                }

                // Draw Pending Pixels (Visual Feedback)
                const viewPortWorldWidth = displayCanvas.width / scale;
                const viewPortWorldHeight = displayCanvas.height / scale;
                const viewPortWorldCenterX = -offsetX;
                const viewPortWorldCenterY = -offsetY;

                const startX = Math.floor(viewPortWorldCenterX - viewPortWorldWidth / 2 + gridWidth / 2);
                const endX = Math.ceil(viewPortWorldCenterX + viewPortWorldWidth / 2 + gridWidth / 2);
                const startY = Math.floor(viewPortWorldCenterY - viewPortWorldHeight / 2 + gridHeight / 2);
                const endY = Math.ceil(viewPortWorldCenterY + viewPortWorldHeight / 2 + gridHeight / 2);

                pendingPixelsRef.current.forEach((val, key) => {
                    const [x, y] = key.split(',').map(Number);
                    if (x >= startX && x <= endX && y >= startY && y <= endY) {
                        const px = pixelStartX + x;
                        const py = pixelStartY + y;

                        if (val === ERASER_INDEX || val === 0) {
                            ctx.fillStyle = '#ffffff';
                        } else if (typeof val === 'string') {
                            ctx.fillStyle = val;
                        } else {
                            ctx.fillStyle = COLOR_PALETTE[val as number] || 'rgba(0,0,0,0)';
                        }
                        ctx.fillRect(px, py, 1, 1);
                    }
                });

                if (scale > 15) {
                    ctx.beginPath();
                    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                    ctx.lineWidth = 0.5 / scale;

                    for (let i = 0; i <= gridWidth; i++) {
                        ctx.moveTo(pixelStartX + i, pixelStartY);
                        ctx.lineTo(pixelStartX + i, pixelStartY + gridHeight);
                    }
                    for (let i = 0; i <= gridHeight; i++) {
                        ctx.moveTo(pixelStartX, pixelStartY + i);
                        ctx.lineTo(pixelStartX + gridWidth, pixelStartY + i);
                    }
                    ctx.stroke();
                }

                // Draw Pending Pixels Highlights
                if (pendingPixelsRef.current.size > 0) {
                    ctx.save();
                    ctx.lineWidth = 1.5 / scale;
                    ctx.lineCap = 'square';

                    pendingPixelsRef.current.forEach((colorIndex, key) => {
                        const [pxStr, pyStr] = key.split(',');
                        const x = parseInt(pxStr);
                        const y = parseInt(pyStr);

                        const px = pixelStartX + x;
                        const py = pixelStartY + y;

                        ctx.strokeStyle = '#FFFFFF';
                        ctx.shadowColor = 'rgba(0,0,0,0.5)';
                        ctx.shadowBlur = 1;

                        const gap = 0.05;
                        const len = 0.35;

                        ctx.beginPath();
                        ctx.moveTo(px + gap, py + len);
                        ctx.lineTo(px + gap, py + gap);
                        ctx.lineTo(px + len, py + gap);
                        ctx.moveTo(px + 1 - len, py + gap);
                        ctx.lineTo(px + 1 - gap, py + gap);
                        ctx.lineTo(px + 1 - gap, py + len);
                        ctx.moveTo(px + 1 - gap, py + 1 - len);
                        ctx.lineTo(px + 1 - gap, py + 1 - gap);
                        ctx.lineTo(px + 1 - len, py + 1 - gap);
                        ctx.moveTo(px + len, py + 1 - gap);
                        ctx.lineTo(px + gap, py + 1 - gap);
                        ctx.lineTo(px + gap, py + 1 - len);
                        ctx.stroke();
                    });
                    ctx.restore();
                }

                // Draw Cursor Highlight
                const currentCursor = cursorGridPosRef.current;
                if (currentCursor && isPaintModeRef.current) {
                    const { x, y } = currentCursor;
                    if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
                        if (!pendingPixelsRef.current.has(`${x},${y}`)) {
                            ctx.save();
                            const px = pixelStartX + x;
                            const py = pixelStartY + y;

                            ctx.strokeStyle = '#000000';
                            ctx.lineWidth = 1.5 / scale;
                            ctx.shadowColor = 'rgba(255,255,255,0.8)';
                            ctx.shadowBlur = 1;
                            ctx.lineCap = 'square';

                            const gap = 0.1;
                            const len = 0.3;

                            ctx.beginPath();
                            ctx.moveTo(px + gap, py + len);
                            ctx.lineTo(px + gap, py + gap);
                            ctx.lineTo(px + len, py + gap);
                            ctx.moveTo(px + 1 - len, py + gap);
                            ctx.lineTo(px + 1 - gap, py + gap);
                            ctx.lineTo(px + 1 - gap, py + len);
                            ctx.moveTo(px + 1 - gap, py + 1 - len);
                            ctx.lineTo(px + 1 - gap, py + 1 - gap);
                            ctx.lineTo(px + 1 - len, py + 1 - gap);
                            ctx.moveTo(px + len, py + 1 - gap);
                            ctx.lineTo(px + gap, py + 1 - gap);
                            ctx.lineTo(px + gap, py + 1 - len);
                            ctx.stroke();

                            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                            ctx.fillRect(px, py, 1, 1);
                            ctx.restore();
                        }
                    }
                }

                ctx.restore();
            }
        }

        frameIdRef.current = requestAnimationFrame(render);
    }, [scale, offsetX, offsetY, gridWidth, gridHeight, guidanceImage, guidanceOpacity, guidanceState, isEditingGuidance, getProcessedGuidanceCanvas]);

    useEffect(() => {
        isRunningRef.current = true;
        needsRedrawRef.current = true;
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

        const pixelX = Math.floor(worldX + gridWidth / 2);
        const pixelY = Math.floor(worldY + gridHeight / 2);

        return { x: pixelX, y: pixelY, worldX, worldY };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;

        lastMouseRef.current = { x: e.clientX, y: e.clientY };

        if (isEditingGuidance && guidanceImage) {
            return;
        }

        dragStartRef.current = { x: e.clientX, y: e.clientY };
        isDraggingRef.current = false;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const { x, y } = screenToWorld(e.clientX, e.clientY);
        setCursorGridPos({ x, y });
        cursorGridPosRef.current = { x, y };
        needsRedrawRef.current = true;

        if (e.buttons === 1 && dragStartRef.current) {
            const dist = Math.hypot(e.clientX - dragStartRef.current.x, e.clientY - dragStartRef.current.y);
            if (dist > 5) {
                isDraggingRef.current = true;
                setIsPanning(true);
            }
        }

        if (isEditingGuidance && guidanceImage && e.buttons === 1 && lastMouseRef.current) {
            const dx = (e.clientX - lastMouseRef.current.x) / scale;
            const dy = (e.clientY - lastMouseRef.current.y) / scale;
            setGuidanceState(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            lastMouseRef.current = { x: e.clientX, y: e.clientY };
            needsRedrawRef.current = true;
            return;
        }

        if (isDraggingRef.current && lastMouseRef.current) {
            const dx = e.clientX - lastMouseRef.current.x;
            const dy = e.clientY - lastMouseRef.current.y;
            setOffsetX(prev => prev + dx / scale);
            setOffsetY(prev => prev + dy / scale);
            lastMouseRef.current = { x: e.clientX, y: e.clientY };
            return;
        }
        if (tooltipData) setTooltipData(null);
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (e.button !== 0) {
            setIsPanning(false);
            return;
        }
        setIsPanning(false);
        lastMouseRef.current = null;

        if (dragStartRef.current && !isDraggingRef.current && isPaintMode) {
            paintPixel(e.clientX, e.clientY);
        }
        dragStartRef.current = null;
        isDraggingRef.current = false;
    };

    const handleMouseLeave = () => {
        setIsPanning(false);
        lastMouseRef.current = null;
        dragStartRef.current = null;
        isDraggingRef.current = false;
        setCursorGridPos(null);
        cursorGridPosRef.current = null;
    };

    const handleMouseEnter = (e: React.MouseEvent) => {
        if (e.buttons !== 1) {
            dragStartRef.current = null;
            isDraggingRef.current = false;
        }
    };

    const handleWheel = useCallback((e: WheelEvent) => {
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
    }, [isEditingGuidance, guidanceImage]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    const findNearestPaletteColor = (r: number, g: number, b: number) => {
        // Packing as uint32 for cache lookup: ABGR or RGBA doesn't matter as long as consistent
        // We use 0xFF for alpha because we are sampling target opaque pixels
        const key = (r | (g << 8) | (b << 16) | (255 << 24)) >>> 0;

        if (colorMatchCacheRef.current.has(key)) {
            return COLOR_PALETTE[colorMatchCacheRef.current.get(key)!];
        }

        // 1. Convert sample to OKLab (Perceptual Linear)
        const sampleLab = linearToOKLab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
        const sampleChroma = Math.sqrt(sampleLab.a * sampleLab.a + sampleLab.b * sampleLab.b);

        let minDistance = Infinity;
        let closestIndex = 0;

        // 2. Euclidean distance in OKLab space
        // We prioritize Hue and Chroma over Lightness (0.8 vs 2.2)
        // to avoid vibrant colors turning gray when there is a chromatic alternative.
        for (let i = 0; i < PALETTE_OKLAB.length; i++) {
            const pLab = PALETTE_OKLAB[i];
            const paletteChroma = Math.sqrt(pLab.a * pLab.a + pLab.b * pLab.b);

            const dl = sampleLab.l - pLab.l;
            const da = sampleLab.a - pLab.a;
            const db = sampleLab.b - pLab.b;

            // Updated formula: prioritizes chromaticity (2.2) over luminosity (0.8)
            let dist = dl * dl * 0.8 + (da * da + db * db) * 2.2;

            // Penalty: if the source is vibrant (>0.05) but the palette choice is dull (<0.02),
            // we heavily penalize it (1.8x) to force a more chromatic alternative if available.
            if (sampleChroma > 0.05 && paletteChroma < 0.02) {
                dist *= 1.8;
            }

            if (dist < minDistance) {
                minDistance = dist;
                closestIndex = i;
            }
        }

        colorMatchCacheRef.current.set(key, closestIndex);
        return COLOR_PALETTE[closestIndex];
    };

    const paintPixel = (clientX: number, clientY: number) => {
        const { x, y } = screenToWorld(clientX, clientY);
        if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return;

        let drawValue: string | number | undefined;

        if (isSmartPicking && guidanceImage && guidanceRawDataRef.current) {
            const imageData = guidanceRawDataRef.current;
            const imgW = guidanceImage.naturalWidth;
            const imgH = guidanceImage.naturalHeight;

            const gWidthUnsnapped = imgW * guidanceState.scale;
            const gHeightUnsnapped = imgH * guidanceState.scale;
            const startXUnsnapped = guidanceState.x - gWidthUnsnapped / 2;
            const startYUnsnapped = guidanceState.y - gHeightUnsnapped / 2;

            const cellCenterXWorld = x - gridWidth / 2 + 0.5;
            const cellCenterYWorld = y - gridHeight / 2 + 0.5;

            const relX = cellCenterXWorld - startXUnsnapped;
            const relY = cellCenterYWorld - startYUnsnapped;

            if (relX >= 0 && relX < gWidthUnsnapped && relY >= 0 && relY < gHeightUnsnapped) {
                const srcX = Math.floor((relX / gWidthUnsnapped) * imgW);
                const srcY = Math.floor((relY / gHeightUnsnapped) * imgH);

                if (srcX >= 0 && srcX < imgW && srcY >= 0 && srcY < imgH) {
                    const pixels = imageData.data;
                    const baseIdx = (srcY * imgW + srcX) * 4;
                    const r = pixels[baseIdx];
                    const g = pixels[baseIdx + 1];
                    const b = pixels[baseIdx + 2];
                    const a = pixels[baseIdx + 3];

                    if (a > 10) {
                        drawValue = rgbToHex(r, g, b);
                    }
                }
            }
        } else {
            if (!selectedColor && !isEraser) return;
            drawValue = isEraser ? ERASER_INDEX : COLOR_MAP[selectedColor!];
        }

        if (drawValue === undefined) return;

        const newMap = new Map(pendingPixelsRef.current);
        const key = `${x},${y}`;

        if (drawValue === ERASER_INDEX) {
            newMap.set(key, drawValue);
            playPaintSound();
        } else if (newMap.get(key) === drawValue) {
            newMap.delete(key);
        } else {
            newMap.set(key, drawValue);
            playPaintSound();
        }

        pendingPixelsRef.current = newMap;
        setPendingPixels(newMap);
        needsRedrawRef.current = true;
    };

    const confirmPaint = async () => {
        if (pendingPixels.size === 0 || isSaving) return;

        const currentUserId = userProfile?.id;
        if (!currentUserId) return;

        setIsSaving(true);
        const oldMap = new Map(pendingPixelsRef.current);
        const pixelCount = pendingPixels.size;

        // Optimistic Clear
        setPendingPixels(new Map());
        pendingPixelsRef.current = new Map();
        updateDataCanvasFull();
        needsRedrawRef.current = true;

        const pixelsToSave: any[] = [];

        oldMap.forEach((drawValue, key) => {
            const [xStr, yStr] = key.split(',');
            const x = parseInt(xStr);
            const y = parseInt(yStr);

            updateLocalPixel(x, y, drawValue);

            const isHex = typeof drawValue === 'string';
            pixelsToSave.push({
                event_id: eventId,
                x,
                y,
                color_index: isHex ? -1 : (drawValue as number),
                color_hex: isHex ? (drawValue as string) : null,
                user_id: currentUserId
            });
        });

        try {
            const CHUNK_SIZE = 100;
            console.log(`[PIXEL_SAVE] Attempting to save ${pixelsToSave.length} pixels...`);

            for (let i = 0; i < pixelsToSave.length; i += CHUNK_SIZE) {
                const chunk = pixelsToSave.slice(i, i + CHUNK_SIZE);
                const { error, data } = await supabase.from('pixel_history').insert(chunk).select();

                if (error) {
                    console.error("[PIXEL_SAVE] Supabase Insert Error:", error);
                    // Fallback: If color_hex is missing in DB
                    if (error.message?.includes('color_hex')) {
                        console.warn("[PIXEL_SAVE] Missing color_hex column. Saving indices only.");
                        const fallbackChunk = chunk.map(p => ({ ...p, color_hex: null }));
                        const { error: fError } = await supabase.from('pixel_history').insert(fallbackChunk);
                        if (fError) throw fError;
                    } else {
                        throw error;
                    }
                }
            }

            console.log("[PIXEL_SAVE] SUCCESS");
            incrementLocalCount();
        } catch (err) {
            console.error("[PIXEL_SAVE] FAILED:", err);
            // Restore pending pixels so data isn't lost on failure
            setPendingPixels(oldMap);
            pendingPixelsRef.current = oldMap;
        } finally {
            setIsSaving(false);
        }
    };

    const restoreGuidance = (item: TemplateSlot) => {
        const img = new Image();
        img.onload = () => {
            const off = document.createElement('canvas');
            off.width = img.naturalWidth;
            off.height = img.naturalHeight;
            const ctx = off.getContext('2d', { willReadFrequently: true });
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                guidanceRawDataRef.current = ctx.getImageData(0, 0, off.width, off.height);
            }
            colorMatchCacheRef.current.clear();
            setGuidanceImage(img);
            setGuidanceOpacity(item.opacity);
            setGuidanceGridStep(item.gridStep);
            setGuidanceState(item.state);
            setIsEditingGuidance(true);
        };
        img.src = item.image;
    };

    const removeGuidanceFromHistory = (image: string) => {
        deleteSlot(image);
    };

    const handleUploadGuidance = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Capture raw image data for picking
                const off = document.createElement('canvas');
                off.width = img.naturalWidth;
                off.height = img.naturalHeight;
                const ctx = off.getContext('2d', { willReadFrequently: true });
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    guidanceRawDataRef.current = ctx.getImageData(0, 0, off.width, off.height);
                }
                colorMatchCacheRef.current.clear(); // Clear cache for new image

                // Auto-save history when a NEW image is uploaded
                if (guidanceImage) {
                    saveSlot({
                        image: guidanceImage.src,
                        opacity: guidanceOpacity,
                        gridStep: guidanceGridStep,
                        state: guidanceState
                    });
                }

                setGuidanceImage(img);

                // Calculate the exact center of the VISIBLE viewport in world coordinates
                // Formula: P_world_center = -Offset
                const centerX = -offsetX;
                const centerY = -offsetY;

                // Set a visible initial scale (auto-fit to 40% of viewport width)
                const viewportWidth = displayCanvasRef.current?.width || 800;
                const worldViewportWidth = viewportWidth / scale;
                const initialScale = (worldViewportWidth * 0.4) / Math.max(1, img.naturalWidth);

                setGuidanceState({
                    x: centerX,
                    y: centerY,
                    scale: initialScale
                });

                setIsEditingGuidance(true);
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    useEffect(() => {
        const handleResize = () => {
            if (displayCanvasRef.current && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                displayCanvasRef.current.width = rect.width;
                displayCanvasRef.current.height = rect.height;
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        setTimeout(handleResize, 100);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div ref={containerRef} className="relative w-full h-full bg-[#1a1a1a] overflow-hidden font-sans rounded-xl shadow-2xl border border-white/10">
            <canvas ref={dataCanvasRef} width={gridWidth} height={gridHeight} className="hidden" />

            <div
                className="w-full h-full relative"
                style={{
                    cursor: isPaintMode ? BLACK_CROSSHAIR_CURSOR : 'default'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onMouseEnter={handleMouseEnter}
                onContextMenu={(e) => e.preventDefault()}
            >
                <canvas
                    ref={displayCanvasRef}
                    className="block w-full h-full"
                    style={{ touchAction: 'none' }}
                    onContextMenu={(e) => e.preventDefault()}
                />

                {tooltipData && (
                    <div className="fixed z-50 pointer-events-none flex items-center gap-2 bg-black/80 text-white text-xs px-2 py-1 rounded border border-white/20 shadow-xl"
                        style={{ left: tooltipData.x + 15, top: tooltipData.y + 15 }}>
                        <div className="w-4 h-4 rounded border border-white/50" style={{ backgroundColor: tooltipData.color }} />
                        <span className="font-mono">{tooltipData.color}</span>
                    </div>
                )}

                {!isPaintMode ? (
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30">
                        <button
                            onClick={() => {
                                setIsPaintMode(true);
                                isPaintModeRef.current = true;
                            }}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg px-8 py-3 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)] active:scale-95 transition-all flex items-center gap-2 border-2 border-white/20 cursor-pointer"
                        >
                            ✏️ PINTAR
                        </button>
                    </div>
                ) : (
                    <div className="absolute bottom-0 left-0 z-30 w-full pointer-events-none" onContextMenu={(e) => e.preventDefault()}>
                        <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-t-[1.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-4 md:px-8 md:py-5 border-t border-slate-200/60 flex flex-col gap-4 animate-in slide-in-from-bottom-full duration-500" onMouseDown={e => e.stopPropagation()}>

                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-100">
                                        <button className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all"><Maximize className="w-4 h-4" /></button>
                                        <div className="h-4 w-[1px] bg-slate-200 mx-1" />
                                        <span className="text-xs font-bold text-slate-700 px-2 whitespace-nowrap">Pintar píxel ({pendingPixels.size})</span>
                                        <button className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all"><Pencil className="w-4 h-4" /></button>
                                        <button className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all" onClick={() => setShowGuidancePanel(!showGuidancePanel)}><Grid className="w-4 h-4" /></button>
                                        <button className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all"><Undo className="w-4 h-4" /></button>
                                        <button className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all"><Redo className="w-4 h-4" /></button>
                                    </div>

                                    <TemplateSlotBar
                                        slots={guidanceHistory}
                                        onRestore={restoreGuidance}
                                        onDelete={removeGuidanceFromHistory}
                                        onUploadClick={() => document.getElementById('guidance-upload')?.click()}
                                        className="hidden sm:flex"
                                    />

                                    {userProfile && (
                                        <div className="hidden lg:flex items-center gap-2 pr-4 border-r border-slate-100">
                                            <AvatarWithFrame
                                                size={32}
                                                avatarUrl={getStorageUrl(userProfile.avatar_url)}
                                                frameUrl={equippedFrame?.image_url}
                                                frameScale={equippedFrame?.frame_settings?.navbar?.scale || 1}
                                                offsetX={equippedFrame?.frame_settings?.navbar?.x || 0}
                                                offsetY={equippedFrame?.frame_settings?.navbar?.y || 0}
                                                name={userProfile.nombre}
                                            />
                                            <span className="text-xs font-bold text-slate-800">{userProfile.nombre?.split(' ')[0]}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setIsPaintMode(false);
                                            isPaintModeRef.current = false;
                                        }}
                                        className="p-2.5 rounded-full hover:bg-slate-100 text-slate-400 transition-all"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="px-2">
                                <Palette
                                    selectedColor={isPanning || isEditingGuidance || isEraser || isSmartPicking ? null : selectedColor}
                                    onSelectColor={(c) => {
                                        if (isEditingGuidance) setIsEditingGuidance(false);
                                        setSelectedColor(c);
                                        setIsPanning(false);
                                        setIsSmartPicking(false);
                                    }}
                                    className="border-none bg-transparent shadow-none p-0"
                                />
                            </div>

                            <div className="flex justify-center -mt-1 pb-1">
                                <button
                                    onClick={confirmPaint}
                                    disabled={pendingPixels.size === 0 || isSaving}
                                    className={cn(
                                        "px-10 py-3 rounded-2xl font-black transition-all flex items-center gap-3 shadow-xl transform active:scale-95 group relative overflow-hidden",
                                        pendingPixels.size > 0 && !isSaving
                                            ? "bg-blue-600 text-white hover:bg-blue-500 hover:scale-[1.02] shadow-blue-200"
                                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    )}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                                    <Sparkles className={cn("w-5 h-5", pendingPixels.size > 0 && !isSaving ? "animate-pulse" : "")} />
                                    <span className="tracking-tight text-lg">
                                        {isSaving ? "Guardando..." : `Pintar ${pendingPixels.size > 0 ? pendingPixels.size : ''}`}
                                    </span>
                                    {!isSaving && (
                                        <>
                                            <div className="h-5 w-[1px] bg-white/20 mx-1" />
                                            <span className="text-sm opacity-80">{userProfile?.monedas || 0}</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="absolute right-6 bottom-24 flex flex-col gap-2 pointer-events-auto" onMouseDown={e => e.stopPropagation()}>
                                <button
                                    onClick={() => setSelectedColor('eraser')}
                                    className={cn(
                                        "p-4 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95 border border-slate-100",
                                        isEraser ? "bg-rose-500 text-white" : "bg-white text-slate-400"
                                    )}
                                    title="Borrador"
                                >
                                    <Eraser className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => {
                                        if (isEditingGuidance) setIsEditingGuidance(false);
                                        setIsSmartPicking(!isSmartPicking);
                                    }}
                                    className={cn(
                                        "p-4 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95 border border-slate-100",
                                        isSmartPicking ? "bg-amber-500 text-white" : "bg-white text-slate-400"
                                    )}
                                    title="Selector Mágico"
                                >
                                    <Sparkles className="w-5 h-5" />
                                </button>
                            </div>

                            {showGuidancePanel && (
                                <div className="absolute bottom-full left-4 mb-6 bg-white rounded-3xl shadow-2xl p-5 border border-slate-100 w-80 animate-in slide-in-from-bottom-4 z-50 pointer-events-auto" onMouseDown={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                                        <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Configurar Guía</h4>
                                        <button onClick={() => setShowGuidancePanel(false)} className="bg-slate-50 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {!guidanceImage ? (
                                        <button
                                            onClick={() => document.getElementById('guidance-upload')?.click()}
                                            className="w-full h-36 flex flex-col items-center justify-center gap-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-200 transition-all group"
                                        >
                                            <div className="bg-white p-3 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                                <Upload className="w-6 h-6 text-blue-500" />
                                            </div>
                                            <span className="text-[11px] font-bold text-slate-500 uppercase">Subir Imagen Guía</span>
                                        </button>
                                    ) : (
                                        <div className="space-y-5">
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase"><span>Opacidad</span><span className="text-blue-600">{Math.round(guidanceOpacity * 100)}%</span></div>
                                                <input
                                                    type="range" min="0" max="1" step="0.05"
                                                    value={guidanceOpacity}
                                                    onChange={(e) => setGuidanceOpacity(parseFloat(e.target.value))}
                                                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase"><span>Escala</span><span className="text-amber-500">{Math.round(guidanceState.scale * 100)}%</span></div>
                                                <input
                                                    type="range" min="0.01" max="10" step="0.01"
                                                    value={guidanceState.scale}
                                                    onChange={(e) => {
                                                        setGuidanceState(prev => ({ ...prev, scale: parseFloat(e.target.value) }));
                                                        needsRedrawRef.current = true;
                                                    }}
                                                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase"><span>Grid Step</span><span className="text-purple-600">{guidanceGridStep}x{guidanceGridStep}</span></div>
                                                <input
                                                    type="range" min="1" max="50" step="1"
                                                    value={guidanceGridStep}
                                                    onChange={(e) => {
                                                        setGuidanceGridStep(parseInt(e.target.value));
                                                        needsRedrawRef.current = true;
                                                    }}
                                                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                                />
                                                <p className="text-[10px] text-slate-400 italic">1 píxel guía = {guidanceGridStep} píxeles del grid</p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 pt-2">
                                                <button
                                                    onClick={() => {
                                                        setIsEditingGuidance(!isEditingGuidance);
                                                        if (isEditingGuidance) setShowGuidancePanel(false);
                                                    }}
                                                    className={cn(
                                                        "py-3 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all flex items-center justify-center gap-2",
                                                        isEditingGuidance
                                                            ? "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-200"
                                                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                                    )}
                                                >
                                                    {isEditingGuidance ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                                    {isEditingGuidance ? "Moviendo" : "Mover"}
                                                </button>
                                                <button
                                                    onClick={() => { setGuidanceImage(null); setIsEditingGuidance(false); }}
                                                    className="py-3 rounded-xl text-[11px] font-black uppercase tracking-wider border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    Limpiar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <input id="guidance-upload" type="file" accept="image/*" className="hidden" onChange={(e) => {
                                        if (e.target.files?.[0]) handleUploadGuidance(e.target.files[0]);
                                    }} />
                                </div>
                            )}

                        </div>
                    </div>
                )}

                <div className="absolute top-4 left-4 z-40 flex flex-col gap-2 pointer-events-auto" onMouseDown={e => e.stopPropagation()}>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 bg-white rounded-full shadow-xl border border-slate-100 flex items-center justify-center text-red-500 hover:scale-110 active:scale-95 transition-all mb-2"
                        title="Salir"
                    >
                        <Home className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setScale(s => Math.min(50, s * 1.2))}
                        className="w-10 h-10 bg-white rounded-full shadow-xl border border-slate-100 flex items-center justify-center text-blue-600 hover:scale-110 active:scale-95 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setScale(s => Math.max(0.1, s * 0.8))}
                        className="w-10 h-10 bg-white rounded-full shadow-xl border border-slate-100 flex items-center justify-center text-blue-600 hover:scale-110 active:scale-95 transition-all"
                    >
                        <Minus className="w-5 h-5" />
                    </button>
                </div>

                <div className="absolute top-4 left-16 z-10 pointer-events-none fade-in slide-in-from-top-4 duration-300">
                    <div className="bg-white/80 backdrop-blur-md text-slate-900 px-3 py-1.5 rounded-full shadow-lg border border-white/20 flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span className="font-bold text-[10px] text-slate-700 uppercase tracking-tight">{onlineUsers} ONLINE</span>
                    </div>
                </div>

                {/* Profile Stats Panel - Top Right */}
                <div className="absolute top-4 right-4 z-40 pointer-events-auto" onMouseDown={e => e.stopPropagation()}>
                    <ProfileStatsPanel
                        show={showProfilePanel}
                        onToggle={setShowProfilePanel}
                        userProfile={userProfile}
                        equippedFrame={equippedFrame}
                        pixelsPainted={pixelsPainted}
                    />
                </div>

                {isEditingGuidance && (
                    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-6 py-3 rounded-full shadow-2xl border-2 border-white pointer-events-none animate-bounce z-40 font-bold text-sm flex items-center gap-2 transform -translate-y-1/2">
                        <Move className="w-5 h-5" />
                        <span>Mueve y escala la imagen guía</span>
                    </div>
                )}
            </div>
        </div>
    );
}
