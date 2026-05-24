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
    Pencil,
    Star
} from 'lucide-react';

// High Contrast Cursor (Black with White Border)
const BLACK_CROSSHAIR_CURSOR = `url('data:image/svg+xml;utf8,<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3V21M3 12H21" stroke="white" stroke-width="3" stroke-linecap="square"/><path d="M12 4V20M4 12H20" stroke="black" stroke-width="1.5" stroke-linecap="square"/></svg>') 12 12, crosshair`;

// Default dimensions (can be overridden by database)
const DEFAULT_gridWidth = 1000;
const DEFAULT_gridHeight = 1000;

// Special index for Eraser (Transparent)
const ERASER_INDEX = 255;

// Pre-compute integer colors for faster 32-bit writes (ABGR for canvas)
// Final architecture uses color_hex, so palette is just for brush selection.
const computeUint32Colors = (palette: string[]) => {
    const buffer = new Uint32Array(palette.length);
    palette.forEach((hex, i) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const a = 255;
        // ABGR for Little Endian canvas.putImageData
        buffer[i] = (a << 24) | (b << 16) | (g << 8) | r;
    });
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
    const isTouchRef = useRef(false);

    const [scale, setScale] = useState(1);
    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);

    // --- Pixel Selection & Info Panel ---
    const [selectedPixel, setSelectedPixel] = useState<{
        x: number;
        y: number;
        color: string;
        owner?: {
            id: string;
            nombre: string;
            avatar_url: string | null;
            active_frame_key?: string | null;
            es_vip?: boolean;
            role?: string;
            frame_url?: string | null; // Joined from shop_items
            frame_settings?: any;
        } | null;
    } | null>(null);
    const [isLoadingPixel, setIsLoadingPixel] = useState(false);

    const fetchPixelDetails = async (x: number, y: number) => {
        // Step 3: Strict Type Safety - Ensure integers, no decimals, no undefined, no NaN
        const px = Math.floor(Number(x));
        const py = Math.floor(Number(y));

        if (!Number.isFinite(px) || !Number.isFinite(py)) {
            console.error("[PIXEL_INFO] Invalid coordinates:", { x, y, px, py });
            return;
        }

        // Step 4: Defensive Logging
        console.log("[PIXEL_INFO] Fetching pixel info:", {
            event_id: eventId,
            x: px,
            y: py
        });

        setIsLoadingPixel(true);
        try {
            // Step 1: Query pixel_board_state with simplified join
            const { data, error } = await supabase
                .from('pixel_board_state')
                .select(`
                    user_id,
                    color_hex,
                    profiles (
                        id,
                        nombre,
                        avatar_url,
                        active_frame_key,
                        es_vip,
                        role
                    )
                `)
                .eq('event_id', eventId)
                .eq('x', px)
                .eq('y', py)
                .maybeSingle();

            // Step 4: Log errors
            if (error) {
                console.error("[PIXEL_INFO] Pixel lookup failed:", error);
                setSelectedPixel({
                    x: px,
                    y: py,
                    color: '#FFFFFF',
                    owner: null
                });
                return;
            }

            if (!data) {
                console.log("[PIXEL_INFO] Empty pixel at", px, py);
                setSelectedPixel({
                    x: px,
                    y: py,
                    color: '#FFFFFF',
                    owner: null
                });
                return;
            }

            let ownerInfo = null;
            const dbColor = data.color_hex || '#FFFFFF';

            // data.profiles will be an object because of maybeSingle() and the relationship
            if (data.profiles) {
                const profile = data.profiles as any;
                let frameUrl = null;
                let frameSettings = null;

                if (profile.active_frame_key) {
                    const { data: frameData } = await supabase
                        .from('shop_items')
                        .select('image_url, frame_settings')
                        .eq('frame_key', profile.active_frame_key)
                        .maybeSingle();
                    if (frameData) {
                        frameUrl = frameData.image_url;
                        frameSettings = frameData.frame_settings;
                    }
                }

                ownerInfo = {
                    ...profile,
                    frame_url: frameUrl,
                    frame_settings: frameSettings
                };
            }

            console.log("[PIXEL_INFO] Successfully fetched pixel:", { px, py, owner: ownerInfo?.nombre || 'None' });
            setSelectedPixel({
                x: px,
                y: py,
                color: dbColor,
                owner: ownerInfo
            });

        } catch (err) {
            console.error("[PIXEL_INFO] Unexpected error:", err);
            setSelectedPixel({
                x: px,
                y: py,
                color: '#FFFFFF',
                owner: null
            });
        } finally {
            setIsLoadingPixel(false);
        }
    };

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
    
    // Touch Gestures Refs
    const initialPinchDistRef = useRef<number | null>(null);
    const initialPinchScaleRef = useRef<number | null>(null);

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
    const [activeSlotIndex, setActiveSlotIndex] = useState<number | undefined>(undefined);
    const pendingUploadSlotRef = useRef<number | null>(null);

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

    useEffect(() => {
        if (!guidanceImage || !userProfile?.id) return;

        // Auto-update the active slot meta-data periodically or on change
        saveSlot({
            image: guidanceImage.src,
            opacity: guidanceOpacity,
            gridStep: guidanceGridStep,
            state: guidanceState,
            slot_index: activeSlotIndex
        });
    }, [guidanceOpacity, guidanceGridStep, guidanceState, guidanceImage, activeSlotIndex, userProfile?.id]);

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
            // MURAL ENGINE: Fetch 4-byte RGBA buffer
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
                } else {
                    bytes = new Uint8Array(data as any);
                }

                const expectedSizeRGBA = gridWidth * gridHeight * 4;
                if (bytes.length !== expectedSizeRGBA) {
                    console.error(`[MURAL_ENGINE] RGBA Buffer size mismatch! Expected ${expectedSizeRGBA}, received ${bytes.length}.`);
                    return; // Stop to prevent corrupted memory state
                }

                // Direct merge into the Single Source of Truth
                // Each pixel is 4 bytes, so Uint32Array length is bytes.length / 4 = gridWidth * gridHeight
                pixelDataRef.current = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
                updateDataCanvasFull();
                needsRedrawRef.current = true;
            }
        } catch (e) {
            console.error("Error fetching mural board:", e);
        }
    };

    const updateLocalPixel = (x: number, y: number, colorValue: number | string) => {
        if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
            const idx = y * gridWidth + x;

            // Single source of truth calculation
            let uint32 = 0;
            if (colorValue === ERASER_INDEX || colorValue === 0) {
                uint32 = 0;
            } else if (typeof colorValue === 'string') {
                uint32 = hexToUint32(colorValue);
            } else {
                uint32 = UINT32_PALETTE[colorValue] || 0;
            }

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

    // 0. Dynamic Dimensions from Metadata
    useEffect(() => {
        const fetchDimensions = async () => {
            const { data, error } = await supabase
                .from('events')
                .select('metadata')
                .eq('id', eventId)
                .single();

            if (data?.metadata) {
                // Type safety for metadata
                const meta = data.metadata as any;
                if (meta.width && meta.height) {
                    setGridWidth(Number(meta.width));
                    setGridHeight(Number(meta.height));

                    // Resize pixelDataRef buffer if needed
                    const newSize = Number(meta.width) * Number(meta.height);
                    if (pixelDataRef.current.length !== newSize) {
                        pixelDataRef.current = new Uint32Array(newSize).fill(0);
                    }
                }
            }
        };
        fetchDimensions();
    }, [eventId]);

    // 1. Initial Fetch and Real-time Board State (Single Source of Truth)
    useEffect(() => {
        let boardChannel: any;

        const setupBoardSync = async () => {
            await fetchGridData();

            boardChannel = supabase
                .channel(`pixel-art-${eventId}`)
                .on('presence', { event: 'sync' }, () => {
                    const state = boardChannel.presenceState();
                    setOnlineUsers(Object.keys(state).length || 1);
                })
                .on('broadcast', { event: 'pixel_batch' }, (payload) => {
                    const pixels = payload.payload.pixels;
                    if (pixels && Array.isArray(pixels)) {
                        pixels.forEach((p: any) => updateLocalPixel(p.x, p.y, p.color_hex));
                    }
                })
                .subscribe(async (status: string) => {
                    if (status === 'SUBSCRIBED') {
                        await boardChannel.track({ online_at: new Date().toISOString(), user_id: userProfile?.id });
                    }
                });
        };

        if (eventId) setupBoardSync();

        return () => {
            if (boardChannel) supabase.removeChannel(boardChannel);
            isRunningRef.current = false;
            cancelAnimationFrame(frameIdRef.current);
        };
    }, [eventId, gridWidth, gridHeight, userProfile?.id]);


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

                // Draw Pending Pixels Highlights & Colors
                if (pendingPixelsRef.current.size > 0) {
                    ctx.save();
                    ctx.imageSmoothingEnabled = false;

                    pendingPixelsRef.current.forEach((val, key) => {
                        const [pxStr, pyStr] = key.split(',');
                        const x = parseInt(pxStr);
                        const y = parseInt(pyStr);

                        const px = pixelStartX + x;
                        const py = pixelStartY + y;

                        // FILL COLOR
                        let uint32 = 0;
                        if (val === ERASER_INDEX || val === 0) {
                            uint32 = 0; // Transparent
                        } else if (typeof val === 'string') {
                            uint32 = hexToUint32(val);
                        } else {
                            uint32 = UINT32_PALETTE[val as number] || 0;
                        }

                        if (uint32 !== 0) {
                            const r = uint32 & 0xFF;
                            const g = (uint32 >> 8) & 0xFF;
                            const b = (uint32 >> 16) & 0xFF;
                            ctx.fillStyle = `rgb(${r},${g},${b})`;
                            ctx.fillRect(px, py, 1, 1);
                        } else {
                            // Eraser preview
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillRect(px, py, 1, 1);
                        }

                        // BORDER INDICATOR
                        ctx.lineWidth = 1.5 / scale;
                        ctx.lineCap = 'square';
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
        if (isTouchRef.current) return;
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
        if (isTouchRef.current) return;
        if (e.button !== 0) {
            setIsPanning(false);
            return;
        }
        setIsPanning(false);
        lastMouseRef.current = null;

        if (dragStartRef.current && !isDraggingRef.current) {
            if (isPaintMode) {
                paintPixel(e.clientX, e.clientY);
            } else {
                // SELECT PIXEL
                const { x, y } = screenToWorld(e.clientX, e.clientY);
                if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
                    fetchPixelDetails(x, y);
                }
            }
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

    // --- Touch Event Handlers ---
    const handleTouchStart = (e: React.TouchEvent) => {
        isTouchRef.current = true;
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            lastMouseRef.current = { x: touch.clientX, y: touch.clientY };

            if (!isEditingGuidance || !guidanceImage) {
                dragStartRef.current = { x: touch.clientX, y: touch.clientY };
                isDraggingRef.current = false;
            }
        } else if (e.touches.length === 2) {
            // Pinch to zoom
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            initialPinchDistRef.current = Math.hypot(dx, dy);
            initialPinchScaleRef.current = isEditingGuidance && guidanceImage ? guidanceState.scale : scale;
            dragStartRef.current = null;
            isDraggingRef.current = false;
            setIsPanning(true);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const { x, y } = screenToWorld(touch.clientX, touch.clientY);
            setCursorGridPos({ x, y });
            cursorGridPosRef.current = { x, y };
            needsRedrawRef.current = true;

            if (dragStartRef.current) {
                const dist = Math.hypot(touch.clientX - dragStartRef.current.x, touch.clientY - dragStartRef.current.y);
                if (dist > 5) {
                    isDraggingRef.current = true;
                    setIsPanning(true);
                }
            }

            if (isEditingGuidance && guidanceImage && lastMouseRef.current) {
                const dx = (touch.clientX - lastMouseRef.current.x) / scale;
                const dy = (touch.clientY - lastMouseRef.current.y) / scale;
                setGuidanceState(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
                lastMouseRef.current = { x: touch.clientX, y: touch.clientY };
                needsRedrawRef.current = true;
                return;
            }

            if (isDraggingRef.current && lastMouseRef.current) {
                const dx = touch.clientX - lastMouseRef.current.x;
                const dy = touch.clientY - lastMouseRef.current.y;
                setOffsetX(prev => prev + dx / scale);
                setOffsetY(prev => prev + dy / scale);
                lastMouseRef.current = { x: touch.clientX, y: touch.clientY };
            }
        } else if (e.touches.length === 2 && initialPinchDistRef.current !== null && initialPinchScaleRef.current !== null) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            const factor = dist / initialPinchDistRef.current;

            if (isEditingGuidance && guidanceImage) {
                setGuidanceState(prev => ({
                    ...prev,
                    scale: Math.max(0.001, Math.min(1000, initialPinchScaleRef.current! * factor))
                }));
            } else {
                setScale(Math.max(0.05, Math.min(100, initialPinchScaleRef.current! * factor)));
            }
            needsRedrawRef.current = true;
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (e.touches.length < 2) {
            setIsPanning(false);
        }
        if (e.touches.length === 0) {
            setIsPanning(false);
            initialPinchDistRef.current = null;
            initialPinchScaleRef.current = null;

            if (dragStartRef.current && !isDraggingRef.current && lastMouseRef.current) {
                if (isPaintMode) {
                    paintPixel(lastMouseRef.current.x, lastMouseRef.current.y);
                } else {
                    const { x, y } = screenToWorld(lastMouseRef.current.x, lastMouseRef.current.y);
                    if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
                        fetchPixelDetails(x, y);
                    }
                }
            }

            dragStartRef.current = null;
            isDraggingRef.current = false;
            lastMouseRef.current = null;
            setCursorGridPos(null);
            cursorGridPosRef.current = null;
            setTimeout(() => { isTouchRef.current = false; }, 500);
        } else if (e.touches.length === 1) {
            // After pinch, reset single touch drag ref to avoid sudden jumps
            const touch = e.touches[0];
            lastMouseRef.current = { x: touch.clientX, y: touch.clientY };
            dragStartRef.current = null; // Do not treat as a click
            isDraggingRef.current = true;
            setIsPanning(true);
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
        const transactionMap = new Map(pendingPixelsRef.current);

        // MURAL ENGINE: Transactional Flow
        // 1. SNAPSHOT for potential rollback
        const snapshot = new Map<string, number>();
        transactionMap.forEach((_, key) => {
            const [x, y] = key.split(',').map(Number);
            const idx = y * gridWidth + x;
            snapshot.set(key, pixelDataRef.current[idx]);
        });

        // 2. OPTIMISTIC MERGE into Single Source of Truth
        transactionMap.forEach((val, key) => {
            const [x, y] = key.split(',').map(Number);
            updateLocalPixel(x, y, val);
        });

        // Clear reactive pending state (SSOT buffer now owns them for the view)
        setPendingPixels(new Map());
        pendingPixelsRef.current = new Map();
        needsRedrawRef.current = true;

        const pixelsToSave: any[] = [];
        transactionMap.forEach((drawValue, key) => {
            const [xStr, yStr] = key.split(',');
            const x = parseInt(xStr);
            const y = parseInt(yStr);

            // Authoritative hex sampling for DB
            let colorHex: string;
            if (typeof drawValue === 'string') {
                colorHex = drawValue;
            } else if (drawValue === ERASER_INDEX || drawValue === 0) {
                colorHex = '#FFFFFF'; // Treat eraser as white for now in state table
            } else {
                colorHex = COLOR_PALETTE[drawValue as number];
            }

            pixelsToSave.push({
                event_id: eventId,
                x,
                y,
                color_hex: colorHex,
                user_id: currentUserId
            });
        });

        try {
            const CHUNK_SIZE = 100;
            console.log(`[PIXEL_SAVE] Transaction Started: ${pixelsToSave.length} pixels.`);

            for (let i = 0; i < pixelsToSave.length; i += CHUNK_SIZE) {
                const chunk = pixelsToSave.slice(i, i + CHUNK_SIZE);
                // UPSERT Batch using PRIMARY KEY (event_id, x, y)
                const { error } = await supabase.from('pixel_board_state').upsert(chunk, {
                    onConflict: 'event_id,x,y'
                });

                if (error) throw error;
            }

            console.log("[PIXEL_SAVE] Transaction Committed.");
            
            // BATCH BROADCAST: Send all pixels in one realtime message instead of relying on postgres_changes per row
            supabase.channel(`pixel-art-${eventId}`).send({
                type: 'broadcast',
                event: 'pixel_batch',
                payload: { pixels: pixelsToSave }
            });

            incrementLocalCount();
        } catch (err) {
            console.error("[PIXEL_SAVE] Transaction FAILED. Rolling back buffer.", err);

            // ROLLBACK: Restore original buffer values
            snapshot.forEach((oldUint32, key) => {
                const [x, y] = key.split(',').map(Number);
                const idx = y * gridWidth + x;
                pixelDataRef.current[idx] = oldUint32;
            });
            updateDataCanvasFull();
            needsRedrawRef.current = true;

            // Restore pending UI state
            setPendingPixels(transactionMap);
            pendingPixelsRef.current = transactionMap;
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
            setActiveSlotIndex(item.slot_index);
            setIsEditingGuidance(false); // FIXED BY DEFAULT when restoring
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
                // Compress image to max 1000px width/height to avoid DB/LocalStorage quota limits
                const MAX_DIM = 1000;
                let w = img.naturalWidth;
                let h = img.naturalHeight;
                if (w > MAX_DIM || h > MAX_DIM) {
                    if (w > h) { h = (MAX_DIM / w) * h; w = MAX_DIM; }
                    else { w = (MAX_DIM / h) * w; h = MAX_DIM; }
                }

                // Capture raw image data for picking
                const off = document.createElement('canvas');
                off.width = w;
                off.height = h;
                const ctx = off.getContext('2d', { willReadFrequently: true });
                if (ctx) {
                    ctx.drawImage(img, 0, 0, w, h);
                    guidanceRawDataRef.current = ctx.getImageData(0, 0, w, h);
                    
                    const compressedImage = new Image();
                    compressedImage.onload = () => {
                        colorMatchCacheRef.current.clear(); // Clear cache for new image
                        setGuidanceImage(compressedImage);

                        // Calculate the exact center of the VISIBLE viewport in world coordinates
                        // Formula: P_world_center = -Offset
                        const centerX = -offsetX;
                        const centerY = -offsetY;

                        // Set a visible initial scale (auto-fit to 40% of viewport width)
                        const viewportWidth = displayCanvasRef.current?.width || 800;
                        const worldViewportWidth = viewportWidth / scale;
                        const initialScale = (worldViewportWidth * 0.4) / Math.max(1, w);

                        setActiveSlotIndex(pendingUploadSlotRef.current || undefined);
                        pendingUploadSlotRef.current = null;

                        setGuidanceState({
                            x: centerX,
                            y: centerY,
                            scale: initialScale
                        });

                        setIsEditingGuidance(true);
                    };
                    compressedImage.src = off.toDataURL('image/jpeg', 0.85);
                }
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
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
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

                {/* --- 1. VIEW MODE: PIXEL SELECTION PANEL --- */}
                {!isPaintMode && selectedPixel && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-md animate-in slide-in-from-bottom-10 duration-300 pointer-events-auto" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>
                        <div className="bg-white rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] p-5 border border-slate-100/50 backdrop-blur-sm relative">
                            {/* Close Button */}
                            <button
                                onClick={() => setSelectedPixel(null)}
                                className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {/* Header: User Info */}
                            <div className="flex items-center gap-4 mb-5">
                                <AvatarWithFrame
                                    size={56}
                                    avatarUrl={getStorageUrl(selectedPixel.owner?.avatar_url)}
                                    frameUrl={selectedPixel.owner?.frame_url}
                                    frameScale={selectedPixel.owner?.frame_settings?.profile?.scale || 1}
                                    offsetX={selectedPixel.owner?.frame_settings?.profile?.x || 0}
                                    offsetY={selectedPixel.owner?.frame_settings?.profile?.y || 0}
                                    name={selectedPixel.owner?.nombre || '?'}
                                />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-black text-slate-800 text-lg">
                                            {selectedPixel.owner?.nombre || 'Pixel Vacío'}
                                        </h3>
                                        {!selectedPixel.owner && (
                                            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Libre</span>
                                        )}
                                        {selectedPixel.owner?.es_vip && (
                                            <img src="/vip-icon.png" alt="VIP" className="w-5 h-5 object-contain" />
                                        )}
                                    </div>
                                    <p className="text-slate-400 text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 mt-1">
                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">#{eventId.slice(0, 4)}</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                                        <span>{selectedPixel.color}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Location Bar */}
                            <div className="bg-slate-50/80 rounded-2xl p-3 flex items-center justify-between border border-slate-100 mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-blue-500">
                                        <Move className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Coordenadas</p>
                                        <p className="text-sm font-bold text-slate-700 font-mono">
                                            {selectedPixel.x}, {selectedPixel.y}
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                    <span className="text-xs font-bold text-slate-600">En vivo</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        setIsPaintMode(true);
                                        isPaintModeRef.current = true;
                                        setSelectedPixel(null);
                                    }}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wide group"
                                >
                                    <Pencil className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                                    Pintar
                                </button>
                                <button className="w-12 h-12 bg-white hover:bg-slate-50 text-slate-400 hover:text-amber-400 border border-slate-200 rounded-xl flex items-center justify-center transition-all active:scale-95">
                                    <Star className="w-5 h-5" />
                                </button>
                                <button className="w-12 h-12 bg-white hover:bg-slate-50 text-slate-400 hover:text-blue-400 border border-slate-200 rounded-xl flex items-center justify-center transition-all active:scale-95">
                                    <Share2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
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
                        
                        {/* Floating Action Buttons removed - now integrated into the main toolbar */}

                        <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-t-[2rem] md:rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.15)] p-3 md:px-6 md:py-4 border-t border-slate-200/60 flex flex-col gap-3 md:gap-4 animate-in slide-in-from-bottom-full duration-500 pb-safe" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>

                            {/* Header / Tools - Scrollable on mobile */}
                            <div className="flex items-center justify-between px-1 gap-2">
                                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 flex-1">
                                    {/* Main Tool Group */}
                                    <div className="flex items-center gap-1 bg-slate-100/80 p-1 md:p-1.5 rounded-2xl border border-slate-200 shrink-0 shadow-inner">
                                        <button 
                                            onClick={() => {
                                                if(isEraser) setSelectedColor(COLOR_PALETTE[0]);
                                                setIsSmartPicking(false);
                                            }}
                                            className={cn("p-2 md:p-2.5 rounded-xl transition-all", !isEraser && !isSmartPicking ? "bg-white text-blue-600 shadow-sm" : "hover:bg-white/50 text-slate-400 hover:text-slate-600")}
                                            title="Lápiz"
                                        >
                                            <Pencil className="w-4 h-4 md:w-5 md:h-5" />
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setSelectedColor('eraser');
                                                setIsSmartPicking(false);
                                            }}
                                            className={cn("p-2 md:p-2.5 rounded-xl transition-all", isEraser ? "bg-white text-rose-500 shadow-sm" : "hover:bg-white/50 text-slate-400 hover:text-slate-600")}
                                            title="Borrador"
                                        >
                                            <Eraser className="w-4 h-4 md:w-5 md:h-5" />
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if (isEditingGuidance) setIsEditingGuidance(false);
                                                setIsSmartPicking(!isSmartPicking);
                                            }}
                                            className={cn("p-2 md:p-2.5 rounded-xl transition-all", isSmartPicking ? "bg-white text-amber-500 shadow-sm" : "hover:bg-white/50 text-slate-400 hover:text-slate-600")}
                                            title="Selector Mágico"
                                        >
                                            <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
                                        </button>
                                        
                                        <div className="h-6 w-[1px] bg-slate-200 mx-1" />
                                        
                                        <button 
                                            onClick={() => setShowGuidancePanel(!showGuidancePanel)}
                                            className={cn("p-2 md:p-2.5 rounded-xl transition-all", showGuidancePanel ? "bg-white text-purple-600 shadow-sm" : "hover:bg-white/50 text-slate-400 hover:text-purple-600")}
                                            title="Configurar Guía"
                                        >
                                            <Grid className="w-4 h-4 md:w-5 md:h-5" />
                                        </button>
                                    </div>

                                    <TemplateSlotBar
                                        slots={guidanceHistory}
                                        onRestore={restoreGuidance}
                                        onDelete={removeGuidanceFromHistory}
                                        onUploadClick={(idx) => {
                                            pendingUploadSlotRef.current = idx;
                                            document.getElementById('guidance-upload')?.click();
                                        }}
                                        className="shrink-0 shadow-inner bg-slate-100/80"
                                    />
                                </div>

                                <div className="flex items-center shrink-0">
                                    <button
                                        onClick={() => {
                                            setIsPaintMode(false);
                                            isPaintModeRef.current = false;
                                        }}
                                        className="p-2 md:p-3 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all bg-slate-50 border border-slate-100"
                                    >
                                        <X className="w-5 h-5 md:w-6 md:h-6" />
                                    </button>
                                </div>
                            </div>

                            {/* Bottom Row: Palette + Confirm Button */}
                            <div className="flex items-center gap-2 md:gap-4 px-1 pb-1">
                                <div className="flex-1 overflow-x-auto scrollbar-hide -ml-2 pl-2">
                                    <Palette
                                        selectedColor={isPanning || isEditingGuidance || isEraser || isSmartPicking ? null : selectedColor}
                                        onSelectColor={(c) => {
                                            if (isEditingGuidance) setIsEditingGuidance(false);
                                            setSelectedColor(c);
                                            setIsPanning(false);
                                            setIsSmartPicking(false);
                                        }}
                                        className="border-none bg-transparent shadow-none p-0 flex-nowrap"
                                    />
                                </div>

                                {/* Confirm Button */}
                                <button
                                    onClick={confirmPaint}
                                    disabled={pendingPixels.size === 0 || isSaving}
                                    className={cn(
                                        "shrink-0 h-12 md:h-14 px-4 md:px-8 rounded-2xl md:rounded-[1.25rem] font-black transition-all flex items-center justify-center gap-2 transform active:scale-95 group relative overflow-hidden",
                                        pendingPixels.size > 0 && !isSaving
                                            ? "bg-blue-600 text-white hover:bg-blue-500 shadow-[0_5px_15px_-3px_rgba(37,99,235,0.4)]"
                                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    )}
                                >
                                    {pendingPixels.size > 0 && !isSaving && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                    )}
                                    <Sparkles className={cn("w-5 h-5", pendingPixels.size > 0 && !isSaving ? "animate-pulse" : "")} />
                                    <span className="tracking-tight text-xs md:text-lg italic uppercase">
                                        {isSaving ? "..." : "Confirmar"}
                                    </span>
                                    
                                    {/* Mobile/Desktop badge for pending count */}
                                    {pendingPixels.size > 0 && (
                                        <div className={cn(
                                            "flex items-center justify-center font-bold",
                                            "md:bg-white/20 md:text-white md:rounded-lg md:px-2 md:py-0.5 md:ml-1 md:text-sm md:static md:w-auto md:h-auto", // Desktop
                                            "absolute -top-1 -right-1 bg-rose-500 text-white rounded-full w-5 h-5 text-[10px] md:hidden shadow-sm border-2 border-blue-600" // Mobile
                                        )}>
                                            {pendingPixels.size}
                                        </div>
                                    )}
                                </button>
                            </div>

                            {showGuidancePanel && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 md:left-4 md:translate-x-0 mb-6 bg-white rounded-3xl shadow-2xl p-5 border border-slate-100 w-[92vw] md:w-80 animate-in slide-in-from-bottom-4 z-50 pointer-events-auto" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>
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
                    <div className="absolute top-20 md:top-1/4 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-full shadow-2xl border-2 border-white pointer-events-none animate-bounce z-40 font-bold text-[10px] md:text-sm flex items-center gap-2 transform -translate-y-1/2 whitespace-nowrap">
                        <Move className="w-4 h-4 md:w-5 md:h-5" />
                        <span>Mueve y escala la imagen guía</span>
                    </div>
                )}
                
                {/* Global Hidden Inputs */}
                <input id="guidance-upload" type="file" accept="image/*" className="hidden" onChange={(e) => {
                    if (e.target.files?.[0]) handleUploadGuidance(e.target.files[0]);
                    e.target.value = '';
                }} />
            </div>
        </div>
    );
}
