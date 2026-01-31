'use client';


import { useRef, useEffect, useState, useCallback } from 'react';
import { supabase, getStorageUrl, ShopItem } from '@/lib/supabase';
import { Palette, COLOR_PALETTE, COLOR_MAP } from './palette';
import { NavigationControls } from './overlay-controls';
import { Upload, X, Grid as GridIcon, Lock, Unlock, Image as ImageIcon, Trash2, Move, Eraser, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvatarWithFrame } from '@/components/ui/AvatarWithFrame';

// High Contrast Cursor (Black with White Border)
const BLACK_CROSSHAIR_CURSOR = `url('data:image/svg+xml;utf8,<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3V9M12 15V21M3 12H9M15 12H21" stroke="white" stroke-width="4" stroke-linecap="square"/><path d="M12 4V9M12 15V20M4 12H9M15 12H20" stroke="black" stroke-width="2" stroke-linecap="square"/><rect x="11" y="11" width="2" height="2" fill="transparent" stroke="white" stroke-width="1"/></svg>') 12 12, crosshair`;


const GRID_WIDTH = 1000;
const GRID_HEIGHT = 1000;

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

    const [isPanning, setIsPanning] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(1);

    // Interaction Refs for Drag vs Click detection
    const dragStartRef = useRef<{ x: number, y: number } | null>(null);
    const isDraggingRef = useRef(false);

    // Cursor Tracking for Highlight
    const [cursorGridPos, setCursorGridPos] = useState<{ x: number, y: number } | null>(null);

    // Guidance State
    const [guidanceImage, setGuidanceImage] = useState<HTMLImageElement | null>(null);
    const [guidanceOpacity, setGuidanceOpacity] = useState(0.5);
    const [guidancePixelation, setGuidancePixelation] = useState(1);
    const [isEditingGuidance, setIsEditingGuidance] = useState(false);
    const [guidanceState, setGuidanceState] = useState({ x: 0, y: 0, scale: 1 });
    const [showGuidancePanel, setShowGuidancePanel] = useState(false);
    const [isSmartPicking, setIsSmartPicking] = useState(false);

    // UI State
    const [isPaintMode, setIsPaintMode] = useState(false);

    const [tooltipData, setTooltipData] = useState<{ x: number, y: number, color: string } | null>(null);

    // Use a Ref for pixel data to avoid re-renders on every pixel change
    const pixelDataRef = useRef<Uint8Array>(new Uint8Array(GRID_WIDTH * GRID_HEIGHT).fill(ERASER_INDEX));

    const lastMouseRef = useRef<{ x: number, y: number } | null>(null);

    // Pending Pixels (Draft Mode)
    // storing as a Map for easy add/remove/check: key="x,y", val=colorIndex
    const [pendingPixels, setPendingPixels] = useState<Map<string, number>>(new Map());

    // Optimization Flags
    const needsRedrawRef = useRef(true);
    const isRunningRef = useRef(true);
    const frameIdRef = useRef<number>(0);

    // --- Persistence (LocalStorage) ---

    useEffect(() => {
        if (!eventId || !userProfile?.id) return;
        const storageKey = `pixel-art-guidance-${eventId}-${userProfile.id}`;

        // 1. Load from storage on mount
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                setGuidanceOpacity(data.opacity ?? 0.5);
                setGuidancePixelation(data.pixelation ?? 1);
                setGuidanceState(data.state ?? { x: 0, y: 0, scale: 1 });

                if (data.image) {
                    const img = new Image();
                    img.onload = () => setGuidanceImage(img);
                    img.src = data.image;
                }
            } catch (e) {
                console.error("Error loading guidance persistence:", e);
            }
        }
    }, [eventId, userProfile?.id]);

    useEffect(() => {
        if (!eventId || !userProfile?.id) return;
        const storageKey = `pixel-art-guidance-${eventId}-${userProfile.id}`;

        const dataToSave = {
            opacity: guidanceOpacity,
            pixelation: guidancePixelation,
            state: guidanceState,
            image: guidanceImage?.src || null
        };

        // Saving high-res base64 can be slow, but it's acceptable for this UX
        localStorage.setItem(storageKey, JSON.stringify(dataToSave));
    }, [eventId, userProfile?.id, guidanceOpacity, guidancePixelation, guidanceState, guidanceImage]);

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
                        await channel.track({ online_at: new Date().toISOString(), user_id: userProfile?.id });
                    }
                });
        };

        if (eventId) init();

        return () => {
            supabase.removeChannel(channel);
            isRunningRef.current = false;
            cancelAnimationFrame(frameIdRef.current);
        };
    }, [eventId, userProfile]);

    const fetchGridData = async () => {
        try {
            const { data, error } = await supabase
                .from('pixel_board_state')
                .select('pixels')
                .eq('event_id', eventId)
                .maybeSingle();

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

            const ctx = dataCanvasRef.current?.getContext('2d');
            if (ctx) {
                if (colorIndex === ERASER_INDEX) {
                    ctx.clearRect(x, y, 1, 1);
                } else {
                    ctx.fillStyle = COLOR_PALETTE[colorIndex];
                    ctx.fillRect(x, y, 1, 1);
                }
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

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return guidanceImage;

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, w, h);

        if (guidancePixelation <= 1) {
            ctx.drawImage(guidanceImage, 0, 0);
            return canvas;
        }

        const tinyW = Math.max(1, Math.floor(w / guidancePixelation));
        const tinyH = Math.max(1, Math.floor(h / guidancePixelation));

        const tinyCanvas = document.createElement('canvas');
        tinyCanvas.width = tinyW;
        tinyCanvas.height = tinyH;
        const tinyCtx = tinyCanvas.getContext('2d');
        if (!tinyCtx) return canvas;

        tinyCtx.imageSmoothingEnabled = false;
        tinyCtx.drawImage(guidanceImage, 0, 0, tinyW, tinyH);

        ctx.drawImage(tinyCanvas, 0, 0, tinyW, tinyH, 0, 0, w, h);

        return canvas;
    }, [guidanceImage, guidancePixelation]);


    // --- Rendering Optimization ---

    const updateDataCanvasFull = useCallback(() => {
        const canvas = dataCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const imageData = ctx.createImageData(GRID_WIDTH, GRID_HEIGHT);
        const data32 = new Uint32Array(imageData.data.buffer);
        const pixels = pixelDataRef.current;
        const len = pixels.length;

        for (let i = 0; i < len; i++) {
            const colorIdx = pixels[i];
            data32[i] = UINT32_PALETTE[colorIdx !== undefined ? colorIdx : 0];
        }

        ctx.putImageData(imageData, 0, 0);
    }, []);

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

                const pixelStartX = -GRID_WIDTH / 2;
                const pixelStartY = -GRID_HEIGHT / 2;

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(pixelStartX, pixelStartY, GRID_WIDTH, GRID_HEIGHT);

                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(dataCanvas, pixelStartX, pixelStartY);

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

                // Draw Pending Pixels (Real Content Preview)
                // We need to draw the actual COLORED pixel here so the user sees what they are drafting
                if (pendingPixels.size > 0) {
                    pendingPixels.forEach((colorIndex, key) => {
                        const [pxStr, pyStr] = key.split(',');
                        const x = parseInt(pxStr);
                        const y = parseInt(pyStr);

                        const px = pixelStartX + x;
                        const py = pixelStartY + y;

                        ctx.fillStyle = colorIndex === ERASER_INDEX ? '#1a1a1a' : COLOR_PALETTE[colorIndex];
                        ctx.fillRect(px, pxStr ? py : py, 1, 1);
                    });
                }

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

                // Draw Pending Pixels Highlights (The "Contour" User Requested)
                if (pendingPixels.size > 0) {
                    ctx.save();
                    ctx.lineWidth = 1.5 / scale;
                    ctx.lineCap = 'square';

                    pendingPixels.forEach((colorIndex, key) => {
                        const [pxStr, pyStr] = key.split(',');
                        const x = parseInt(pxStr);
                        const y = parseInt(pyStr);

                        const px = pixelStartX + x;
                        const py = pixelStartY + y;

                        // Draw the specific corner brackets for EACH pending pixel
                        ctx.strokeStyle = '#000000'; // Black borders
                        const gap = 0.1;
                        const len = 0.3;

                        ctx.beginPath();
                        // Top Left
                        ctx.moveTo(px + gap, py + len);
                        ctx.lineTo(px + gap, py + gap);
                        ctx.lineTo(px + len, py + gap);
                        // Top Right
                        ctx.moveTo(px + 1 - len, py + gap);
                        ctx.lineTo(px + 1 - gap, py + gap);
                        ctx.lineTo(px + 1 - gap, py + len);
                        // Bottom Right
                        ctx.moveTo(px + 1 - gap, py + 1 - len);
                        ctx.lineTo(px + 1 - gap, py + 1 - gap);
                        ctx.lineTo(px + 1 - len, py + 1 - gap);
                        // Bottom Left
                        ctx.moveTo(px + len, py + 1 - gap);
                        ctx.lineTo(px + 1 - len, py + 1 - gap); // fix bottom line
                        ctx.lineTo(px + gap, py + 1 - gap);
                        ctx.lineTo(px + gap, py + 1 - len);
                        ctx.stroke();

                        // White inner contrast
                        ctx.fillStyle = 'rgba(255,255,255,0.3)';
                        ctx.fillRect(px, py, 1, 1);
                    });
                    ctx.restore();
                }

                // Draw Cursor Highlight (Quadrant) - Only if not hovering a pending pixel?
                if (cursorGridPos && isPaintMode) {
                    // ... existing cursor code ...
                    const { x, y } = cursorGridPos;
                    if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
                        // Don't draw cursor reticle if we already have a pending pixel there (optional, but cleaner)
                        if (!pendingPixels.has(`${x},${y}`)) {
                            ctx.save();
                            // ... existing reticle code ...
                            // Reticle Style (Corner Brackets)
                            const px = pixelStartX + x;
                            const py = pixelStartY + y;

                            ctx.strokeStyle = 'rgba(0,0,0,0.5)'; // Lighter for cursor, darker for confirmed drafts
                            ctx.lineWidth = 1.5 / scale;
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
                            ctx.restore();
                        }
                    }
                }

                ctx.restore();
            }
        }

        frameIdRef.current = requestAnimationFrame(render);
    }, [scale, offsetX, offsetY, guidanceImage, guidanceOpacity, guidanceState, isEditingGuidance, getProcessedGuidanceCanvas]);

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

        const pixelX = Math.floor(worldX + GRID_WIDTH / 2);
        const pixelY = Math.floor(worldY + GRID_HEIGHT / 2);

        return { x: pixelX, y: pixelY, worldX, worldY };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isEditingGuidance && guidanceImage) {
            lastMouseRef.current = { x: e.clientX, y: e.clientY };
            return;
        }

        // Start Drag Tracking
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        isDraggingRef.current = false;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };

        // Don't paint immediately on mouse down anymore
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const { x, y, worldX, worldY } = screenToWorld(e.clientX, e.clientY);
        setCursorGridPos({ x, y });

        // Determine if dragging
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
            return;
        }

        // Pan Logic (Active whenever dragging, regardless of mode)
        if (isDraggingRef.current && lastMouseRef.current) {
            const dx = e.clientX - lastMouseRef.current.x;
            const dy = e.clientY - lastMouseRef.current.y;
            setOffsetX(prev => prev + dx / scale);
            setOffsetY(prev => prev + dy / scale);
            lastMouseRef.current = { x: e.clientX, y: e.clientY };
            return;
        }

        // Just update tooltipData for colors if needed
        if (tooltipData) setTooltipData(null);
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        setIsPanning(false);
        lastMouseRef.current = null;

        // If it was a CLICK (not a drag) AND we are in paint mode, then PAINT
        if (!isDraggingRef.current && isPaintMode) {
            paintPixel(e.clientX, e.clientY);
        }

        dragStartRef.current = null;
        isDraggingRef.current = false;
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

        // Add non-passive wheel listener manually
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            container.removeEventListener('wheel', handleWheel);
        };
    }, [handleWheel]);

    const findNearestPaletteColor = (r: number, g: number, b: number) => {
        let minDistance = Infinity;
        let closestColor = COLOR_PALETTE[0];

        for (const hex of COLOR_PALETTE) {
            const pr = parseInt(hex.slice(1, 3), 16);
            const pg = parseInt(hex.slice(3, 5), 16);
            const pb = parseInt(hex.slice(5, 7), 16);

            const distance = Math.pow(r - pr, 2) + Math.pow(g - pg, 2) + Math.pow(b - pb, 2);
            if (distance < minDistance) {
                minDistance = distance;
                closestColor = hex;
            }
        }

        return closestColor;
    };

    const paintPixel = async (clientX: number, clientY: number) => {
        const { x, y, worldX, worldY } = screenToWorld(clientX, clientY);
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return;

        let colorIndex: number | undefined;

        // ... color selection logic ...
        if (isSmartPicking && guidanceImage) {
            // ... (keep existing smart pick logic)
            const gWidth = guidanceImage.naturalWidth * guidanceState.scale;
            const gHeight = guidanceImage.naturalHeight * guidanceState.scale;
            const gLeft = guidanceState.x - gWidth / 2;
            const gTop = guidanceState.y - gHeight / 2;
            const relX = worldX - gLeft;
            const relY = worldY - gTop;

            if (relX >= 0 && relX <= gWidth && relY >= 0 && relY <= gHeight) {
                const srcCanvas = getProcessedGuidanceCanvas();
                if (srcCanvas instanceof HTMLCanvasElement) {
                    const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
                    if (ctx) {
                        const imgX = Math.floor(relX / guidanceState.scale);
                        const imgY = Math.floor(relY / guidanceState.scale);
                        const pixel = ctx.getImageData(imgX, imgY, 1, 1).data;
                        if (pixel[3] > 10) {
                            const hex = findNearestPaletteColor(pixel[0], pixel[1], pixel[2]);
                            colorIndex = COLOR_MAP[hex];
                        }
                    }
                }
            }
            if (colorIndex === undefined) return;
        } else {
            if (!selectedColor && !isEraser) return;
            colorIndex = isEraser ? ERASER_INDEX : COLOR_MAP[selectedColor!];
        }

        if (colorIndex === undefined) return;

        // Draft Logic: Update Pending Pixels Map
        // Toggle: if same color exists, remove it? Or just overwrite.
        // Let's overwrite for now, or toggle if clicking exactly same pixel/color? 
        // User wants to click to "mark" it.

        setPendingPixels(prev => {
            const newMap = new Map(prev);
            const key = `${x},${y}`;

            // If clicking the same pixel with same color, remove it (undo)
            // If clicking with different color, update it
            if (newMap.get(key) === colorIndex) {
                newMap.delete(key);
                // Also revert visual change in local canvas? 
                // We actually need to re-render the underlying board pixel.
                // For simplicity, we will just update the visual canvas 
                // BUT wait, we need to know what the OLD pixel was to revert visually.
                // The `render` loop draws `dataCanvas` then `pending pixels`. 
                // So removing from `pendingPixels` automatically "reverts" visual to `dataCanvas`.
            } else {
                newMap.set(key, colorIndex);
            }
            return newMap;
        });

        // We DON'T call updateLocalPixel yet. That happens on confirm.
        // But we DO want to see the color.
        // The render loop needs to draw the pending pixels ON TOP.
        // Actually `updateLocalPixel` writes to `dataCanvas`. 
        // If we want to see it, we should add drawing of pending pixels in `render`.
        // I Added that in the previous chunk.
    };

    const confirmPaint = async () => {
        if (pendingPixels.size === 0) return;

        const pixelsToSave: { event_id: string, x: number, y: number, color_index: number }[] = [];

        pendingPixels.forEach((colorIndex, key) => {
            const [xStr, yStr] = key.split(',');
            const x = parseInt(xStr);
            const y = parseInt(yStr);

            // Update local visually immediately (permanent)
            updateLocalPixel(x, y, colorIndex);

            pixelsToSave.push({
                event_id: eventId,
                x,
                y,
                color_index: colorIndex
            });
        });

        // Clear pending immediately for responsiveness
        setPendingPixels(new Map());

        try {
            const { error } = await supabase.from('pixel_history').insert(pixelsToSave);
            if (error) throw error;
        } catch (err) {
            console.error("Error saving batch pixels:", err);
            // Ideally rollback local pixels here if failed, but for now keep it simple.
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
                // Resize to container size instead of window
                const rect = containerRef.current.getBoundingClientRect();
                displayCanvasRef.current.width = rect.width;
                displayCanvasRef.current.height = rect.height;
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Initial size
        // Add a small delay to ensure container is rendered
        setTimeout(handleResize, 100);

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div ref={containerRef} className="relative w-full h-full bg-[#1a1a1a] overflow-hidden font-sans rounded-xl shadow-2xl border border-white/10">
            <canvas ref={dataCanvasRef} width={GRID_WIDTH} height={GRID_HEIGHT} className="hidden" />

            <div
                className={cn(
                    "w-full h-full relative",
                    isPaintMode ? "cursor-crosshair" : "cursor-default"
                )}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onContextMenu={(e) => e.preventDefault()}
            >
                <canvas ref={displayCanvasRef} className="block w-full h-full" style={{ touchAction: 'none' }} />

                <div className="absolute top-2 md:top-4 left-2 md:left-4 z-10 pointer-events-none fade-in slide-in-from-top-4 duration-300">
                    <div className="bg-white/90 backdrop-blur-md text-slate-900 px-3 md:px-4 py-1.5 md:py-2 rounded-xl md:rounded-2xl shadow-xl border border-white/20 flex items-center gap-2 md:gap-3">
                        <div className="flex items-center gap-1.5 md:gap-2">
                            <span className="relative flex h-2 md:h-3 w-2 md:w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 md:h-3 w-2 md:w-3 bg-green-500"></span>
                            </span>
                            <span className="font-bold text-[10px] md:text-sm text-slate-700">{onlineUsers} creando</span>
                        </div>
                    </div>
                </div>

                {/* Top Right User Panel */}
                <div className="absolute top-2 md:top-4 right-2 md:right-4 z-10 pointer-events-auto flex flex-col items-end gap-2">
                    {userProfile && (
                        <>
                            <div className="hidden md:flex bg-white/90 backdrop-blur-md px-1.5 py-1.5 md:pl-2 md:pr-4 rounded-full shadow-xl border border-white/20 items-center gap-3">
                                <div className="relative">
                                    <AvatarWithFrame
                                        size={36}
                                        avatarUrl={getStorageUrl(userProfile.avatar_url)}
                                        frameUrl={equippedFrame?.image_url}
                                        frameScale={equippedFrame?.frame_settings?.navbar?.scale || 1}
                                        offsetX={equippedFrame?.frame_settings?.navbar?.x || 0}
                                        offsetY={equippedFrame?.frame_settings?.navbar?.y || 0}
                                        name={userProfile.nombre}
                                    />
                                </div>
                                <span className="text-sm font-semibold text-slate-800">{userProfile.nombre?.split(' ')[0]}</span>
                            </div>

                            {/* Extra Buttons: Tienda, Alianza, Clasificación */}
                            <div className="flex flex-col gap-2 items-end animate-in fade-in slide-in-from-right-4 duration-500 delay-100">
                                <button className="flex items-center gap-2 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/10 transition-all hover:scale-105">
                                    <span>🏪</span> Tienda
                                </button>
                                <button className="flex items-center gap-2 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/10 transition-all hover:scale-105">
                                    <span>🛡️</span> Alianza
                                </button>
                                <button className="flex items-center gap-2 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/10 transition-all hover:scale-105">
                                    <span>🏆</span> Clasificación
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Internal Avatar/Close Removed - Handled by Parent Page */}

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
                            onClick={() => setIsPaintMode(true)}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg px-8 py-3 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)] active:scale-95 transition-all flex items-center gap-2 border-2 border-white/20 cursor-pointer"
                        >
                            ✏️ PINTAR
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3 md:gap-4 w-full px-2 md:px-4 pointer-events-none">
                            <div className="pointer-events-auto flex items-center gap-2">
                                {showGuidancePanel && (
                                    <div className="mb-2 md:mb-4 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl md:rounded-2xl shadow-2xl p-3 md:p-4 text-gray-200 flex flex-col gap-3 md:gap-4 animate-in slide-in-from-bottom-5 fade-in duration-300 w-[calc(100vw-2rem)] md:w-72">
                                        <div className="flex items-center justify-between text-xs font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">
                                            <span>Guía / Plantilla</span>
                                            <div className="flex items-center gap-1">
                                                {guidanceImage && (
                                                    <button onClick={() => { setGuidanceImage(null); setIsEditingGuidance(false); setIsSmartPicking(false); }} title="Eliminar imagen" className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                <button onClick={() => setShowGuidancePanel(false)} title="Cerrar panel" className="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded transition-colors">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {!guidanceImage ? (
                                            <button
                                                onClick={() => document.getElementById('guidance-upload')?.click()}
                                                className="flex items-center justify-center gap-2 p-4 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition-all border border-white/10 border-dashed group"
                                            >
                                                <Upload className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                                                <span className="font-medium">Subir Imagen de Referencia</span>
                                            </button>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[10px] text-gray-400 font-medium">
                                                        <span>Opacidad</span>
                                                        <span>{Math.round(guidanceOpacity * 100)}%</span>
                                                    </div>
                                                    <input
                                                        type="range" min="0" max="1" step="0.05"
                                                        value={guidanceOpacity}
                                                        onChange={(e) => setGuidanceOpacity(parseFloat(e.target.value))}
                                                        className="w-full h-1.5 bg-gray-700/50 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[10px] text-gray-400 font-medium">
                                                        <span>Pixelado (Ayuda Visual)</span>
                                                        <span>{guidancePixelation}x</span>
                                                    </div>
                                                    <div className="flex gap-3 items-center">
                                                        <GridIcon className="w-4 h-4 text-gray-500" />
                                                        <input
                                                            type="range" min="1" max="20" step="1"
                                                            value={guidancePixelation}
                                                            onChange={(e) => setGuidancePixelation(parseInt(e.target.value))}
                                                            className="w-full h-1.5 bg-gray-700/50 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                                        />
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        setIsEditingGuidance(!isEditingGuidance);
                                                        if (isEditingGuidance) setShowGuidancePanel(false);
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center justify-center gap-2 p-2.5 rounded-lg text-xs font-bold transition-all border shadow-sm",
                                                        isEditingGuidance
                                                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                                                            : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                                                    )}
                                                >
                                                    {isEditingGuidance ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                                    {isEditingGuidance ? "Finalizar y Fijar" : "Posición Fija"}
                                                </button>
                                            </div>
                                        )}
                                        <input id="guidance-upload" type="file" accept="image/*" className="hidden" onChange={(e) => {
                                            if (e.target.files?.[0]) handleUploadGuidance(e.target.files[0]);
                                        }} />
                                    </div>
                                )}
                            </div>

                            <div className="flex items-end gap-3 pointer-events-auto max-w-full">
                                <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-2 border border-white/20 flex flex-col items-center gap-2">
                                    <button
                                        onClick={() => {
                                            if (isEditingGuidance) setIsEditingGuidance(false);
                                            setSelectedColor('eraser');
                                            setIsPanning(false);
                                            setIsSmartPicking(false);
                                        }}
                                        className={cn(
                                            "p-2 md:p-3 rounded-lg md:rounded-xl transition-all shadow-sm flex flex-col items-center gap-0.5 md:gap-1 min-w-[3rem] md:min-w-[3.5rem]",
                                            isEraser
                                                ? "bg-rose-100 text-rose-600 ring-2 ring-rose-500 ring-offset-2"
                                                : "hover:bg-slate-100 text-slate-500"
                                        )}
                                        title="Borrador"
                                    >
                                        <Eraser className="w-5 h-5 md:w-6 md:h-6" />
                                        <span className="text-[8px] md:text-[9px] font-bold uppercase">Borrar</span>
                                    </button>

                                    {guidanceImage && (
                                        <button
                                            onClick={() => {
                                                if (isEditingGuidance) setIsEditingGuidance(false);
                                                setIsSmartPicking(!isSmartPicking);
                                                if (!isSmartPicking) {
                                                    setSelectedColor(null);
                                                    setIsPanning(false);
                                                }
                                            }}
                                            className={cn(
                                                "p-2 md:p-3 rounded-lg md:rounded-xl transition-all shadow-sm flex flex-col items-center gap-0.5 md:gap-1 min-w-[3rem] md:min-w-[3.5rem]",
                                                isSmartPicking
                                                    ? "bg-amber-100 text-amber-600 ring-2 ring-amber-500 ring-offset-2"
                                                    : "hover:bg-slate-100 text-slate-500"
                                            )}
                                            title="Pintado Inteligente (Mágico)"
                                        >
                                            <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
                                            <span className="text-[8px] md:text-[9px] font-bold uppercase">Magia</span>
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setShowGuidancePanel(!showGuidancePanel)}
                                        className={cn(
                                            "p-2 md:p-3 rounded-lg md:rounded-xl transition-all shadow-sm flex flex-col items-center gap-0.5 md:gap-1 min-w-[3rem] md:min-w-[3.5rem]",
                                            showGuidancePanel
                                                ? "bg-blue-100 text-blue-600 ring-2 ring-blue-500 ring-offset-2"
                                                : "hover:bg-slate-100 text-slate-500"
                                        )}
                                        title="Imagen de Guía"
                                    >
                                        <ImageIcon className="w-5 h-5 md:w-6 md:h-6" />
                                        <span className="text-[8px] md:text-[9px] font-bold uppercase">Guía</span>
                                    </button>
                                </div>

                                <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden border border-white/20 p-2">
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

                                {/* Confirm Button (Only if pending pixels exist) */}
                                {pendingPixels.size > 0 && (
                                    <div className="absolute -top-16 left-1/2 -translate-x-1/2 animate-in zoom-in slide-in-from-bottom-4 duration-300">
                                        <button
                                            onClick={confirmPaint}
                                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg px-6 py-2 rounded-full shadow-xl flex items-center gap-2 border-2 border-white/20 active:scale-95 transition-all"
                                        >
                                            ✏️ Pintar {pendingPixels.size}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                <div className="absolute bottom-20 md:bottom-8 right-3 md:right-6 z-20 pointer-events-auto scale-75 md:scale-100 origin-bottom-right">
                    <NavigationControls
                        scale={scale}
                        onZoomIn={() => setScale(s => Math.min(50, s * 1.2))}
                        onZoomOut={() => setScale(s => Math.max(0.1, s * 0.8))}
                        onReset={() => { setScale(1); setOffsetX(0); setOffsetY(0); }}
                        isPanning={isPanning}
                        onTogglePan={() => { setIsPanning(!isPanning); if (!isPanning) { setSelectedColor(null); setIsSmartPicking(false); } }}
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
