'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Cell, Workbook, Worksheet } from 'exceljs';
import * as XLSX from 'xlsx';
import { AlertCircle, FileSpreadsheet, Loader2, Search, X } from 'lucide-react';
import {
    columnIndexToName,
    columnWidthToPixels,
    excelBorderToCss,
    excelColorToCss,
    extractFormulaReferences,
    pointsToPixels,
    referenceContainsCell,
    type FormulaReference,
} from '@/lib/excel-viewer-utils';

interface CellStyle {
    bgColor?: string;
    fontColor?: string;
    fontFamily?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    doubleUnderline?: boolean;
    strike?: boolean;
    align?: 'left' | 'center' | 'right' | 'justify';
    verticalAlign?: 'top' | 'middle' | 'bottom';
    wrapText?: boolean;
    indent?: number;
    rotation?: number;
    borderTop?: string;
    borderBottom?: string;
    borderLeft?: string;
    borderRight?: string;
}

interface ParsedCell {
    addr: string;
    row: number;
    col: number;
    text: string;
    formula?: string;
    isNum: boolean;
    style?: CellStyle;
    colSpan?: number;
    rowSpan?: number;
    skip?: boolean;
}

interface SheetImage {
    id: string;
    src: string;
    left: number;
    top: number;
    width: number;
    height: number;
}

interface SheetData {
    sheetName: string;
    colLetters: string[];
    colWidths: number[];
    hiddenCols: boolean[];
    rowHeights: number[];
    hiddenRows: boolean[];
    rows: ParsedCell[][];
    images: SheetImage[];
    totalRows: number;
    totalCols: number;
    showGridLines: boolean;
}

interface FormulaTrace {
    sourceAddr: string;
    sourceSheet: string;
    references: FormulaReference[];
}

interface PendingFocus {
    sheetName: string;
    row: number;
    col: number;
}

interface SecureExcelViewerProps {
    blob: Blob | null;
    fileName: string;
    zoomLevel?: number;
    onZoomChange?: (zoom: number) => void;
    userWatermark?: string;
}

const ROW_NUMBER_WIDTH = 46;
const MAX_RENDER_ROWS = 10000;
const MAX_RENDER_COLS = 256;
const MIN_EXCEL_ZOOM = 0.1;
const MAX_EXCEL_ZOOM = 20;
const EMU_PER_CSS_PIXEL = 9525;

function horizontalAlignment(value?: string): CellStyle['align'] {
    if (value === 'center' || value === 'centerContinuous' || value === 'distributed') return 'center';
    if (value === 'right') return 'right';
    if (value === 'justify') return 'justify';
    if (value === 'left' || value === 'fill') return 'left';
    return undefined;
}

function verticalAlignment(value?: string): CellStyle['verticalAlign'] {
    if (value === 'top') return 'top';
    if (value === 'center' || value === 'distributed' || value === 'justify') return 'middle';
    if (value === 'bottom') return 'bottom';
    return undefined;
}

function numberFormatColor(format: string | undefined, value: unknown): string | undefined {
    if (!format || typeof value !== 'number') return undefined;
    const sections = format.split(';');
    const section = value < 0
        ? (sections[1] || sections[0])
        : value === 0
            ? (sections[2] || sections[0])
            : sections[0];
    const colorName = section.match(/\[(Black|Blue|Cyan|Green|Magenta|Red|White|Yellow)\]/i)?.[1];
    if (!colorName) return undefined;
    const colors: Record<string, string> = {
        black: '#000000',
        blue: '#0000ff',
        cyan: '#00ffff',
        green: '#008000',
        magenta: '#ff00ff',
        red: '#ff0000',
        white: '#ffffff',
        yellow: '#ffff00',
    };
    return colors[colorName.toLowerCase()];
}

function parseCellStyle(cell: Cell): CellStyle | undefined {
    const font = cell.font;
    const alignment = cell.alignment;
    const borders = cell.border;
    const fill = cell.fill as any;
    const style: CellStyle = {};
    let hasStyle = false;

    if (font) {
        if (font.name) {
            style.fontFamily = font.name;
            hasStyle = true;
        }
        if (font.size) {
            style.fontSize = font.size;
            hasStyle = true;
        }
        if (font.color) {
            const color = excelColorToCss(font.color);
            if (color) {
                style.fontColor = color;
                hasStyle = true;
            }
        }
        if (font.bold) {
            style.bold = true;
            hasStyle = true;
        }
        if (font.italic) {
            style.italic = true;
            hasStyle = true;
        }
        if (font.underline) {
            style.underline = true;
            style.doubleUnderline = String(font.underline).toLowerCase().includes('double');
            hasStyle = true;
        }
        if (font.strike) {
            style.strike = true;
            hasStyle = true;
        }
    }

    if (!style.fontColor) {
        const formatColor = numberFormatColor(cell.numFmt, rawValueForCell(cell));
        if (formatColor) {
            style.fontColor = formatColor;
            hasStyle = true;
        }
    }

    if (fill?.type === 'pattern' && fill.pattern && fill.pattern !== 'none') {
        const color = excelColorToCss(fill.fgColor || fill.bgColor);
        if (color) {
            style.bgColor = color;
            hasStyle = true;
        }
    } else if (fill?.type === 'gradient' && fill.stops?.length) {
        const color = excelColorToCss(fill.stops[0]?.color);
        if (color) {
            style.bgColor = color;
            hasStyle = true;
        }
    }

    if (alignment) {
        const align = horizontalAlignment(alignment.horizontal);
        const vertical = verticalAlignment(alignment.vertical);
        if (align) {
            style.align = align;
            hasStyle = true;
        }
        if (vertical) {
            style.verticalAlign = vertical;
            hasStyle = true;
        }
        if (alignment.wrapText) {
            style.wrapText = true;
            hasStyle = true;
        }
        if (alignment.indent) {
            style.indent = alignment.indent;
            hasStyle = true;
        }
        if (typeof alignment.textRotation === 'number') {
            style.rotation = alignment.textRotation;
            hasStyle = true;
        }
    }

    if (borders) {
        const top = excelBorderToCss(borders.top);
        const bottom = excelBorderToCss(borders.bottom);
        const left = excelBorderToCss(borders.left);
        const right = excelBorderToCss(borders.right);
        if (top) {
            style.borderTop = top;
            hasStyle = true;
        }
        if (bottom) {
            style.borderBottom = bottom;
            hasStyle = true;
        }
        if (left) {
            style.borderLeft = left;
            hasStyle = true;
        }
        if (right) {
            style.borderRight = right;
            hasStyle = true;
        }
    }

    return hasStyle ? style : undefined;
}

function serialFromDate(date: Date, date1904: boolean): number {
    const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
    return (date.getTime() - epoch) / 86400000;
}

function formulaForCell(cell: Cell): string | undefined {
    const formula = cell.formula;
    return formula ? '=' + formula : undefined;
}

function rawValueForCell(cell: Cell): unknown {
    if (cell.formula) return cell.result;
    return cell.value;
}

function displayTextForCell(cell: Cell, date1904: boolean): string {
    const rawValue = rawValueForCell(cell);
    if (rawValue === null || rawValue === undefined) return '';

    if (typeof rawValue === 'number') {
        try {
            return XLSX.SSF.format(cell.numFmt || 'General', rawValue, { date1904 });
        } catch {
            return String(rawValue);
        }
    }

    if (rawValue instanceof Date) {
        try {
            return XLSX.SSF.format(cell.numFmt || 'm/d/yy', serialFromDate(rawValue, date1904), { date1904 });
        } catch {
            return rawValue.toLocaleDateString();
        }
    }

    if (typeof rawValue === 'boolean') return rawValue ? 'TRUE' : 'FALSE';
    if (typeof rawValue === 'string') return rawValue;

    if (typeof rawValue === 'object') {
        const richText = (rawValue as any).richText;
        if (Array.isArray(richText)) return richText.map(part => part.text || '').join('');
        const hyperlinkText = (rawValue as any).text;
        if (typeof hyperlinkText === 'string') return hyperlinkText;
        const error = (rawValue as any).error;
        if (typeof error === 'string') return error;
    }

    return cell.text || String(rawValue);
}

function traceShadow(reference: FormulaReference, row: number, col: number): string | undefined {
    const shadows: string[] = [];
    if (row === reference.startRow) shadows.push('inset 0 2px 0 ' + reference.color);
    if (row === reference.endRow) shadows.push('inset 0 -2px 0 ' + reference.color);
    if (col === reference.startCol) shadows.push('inset 2px 0 0 ' + reference.color);
    if (col === reference.endCol) shadows.push('inset -2px 0 0 ' + reference.color);
    return shadows.length ? shadows.join(', ') : undefined;
}

function firstVisibleCell(rows: ParsedCell[][]): ParsedCell | null {
    for (const row of rows) {
        const cell = row.find(candidate => !candidate.skip && candidate.text);
        if (cell) return cell;
    }
    return rows[0]?.find(candidate => !candidate.skip) || null;
}

function anchorOffset(
    anchor: any,
    sizes: number[],
    axis: 'col' | 'row',
): number {
    const nativeIndexKey = axis === 'col' ? 'nativeCol' : 'nativeRow';
    const nativeOffsetKey = axis === 'col' ? 'nativeColOff' : 'nativeRowOff';
    const fallbackPosition = Number(anchor?.[axis]) || 0;
    const nativeIndex = Number(anchor?.[nativeIndexKey]);
    const whole = Math.max(
        0,
        Number.isFinite(nativeIndex) ? Math.floor(nativeIndex) : Math.floor(fallbackPosition),
    );
    let offset = 0;
    for (let index = 0; index < Math.min(whole, sizes.length); index++) offset += sizes[index];

    const nativeOffset = Number(anchor?.[nativeOffsetKey]);
    if (Number.isFinite(nativeOffset) && nativeOffset >= 0) {
        offset += nativeOffset / EMU_PER_CSS_PIXEL;
    } else if (whole < sizes.length) {
        offset += sizes[whole] * Math.max(0, fallbackPosition - whole);
    }
    return offset;
}

function touchDistance(first: Touch, second: Touch): number {
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function clampExcelZoom(value: number): number {
    return Math.min(MAX_EXCEL_ZOOM, Math.max(MIN_EXCEL_ZOOM, value));
}

export default function SecureExcelViewer({
    blob,
    fileName,
    zoomLevel = 1,
    onZoomChange,
    userWatermark = 'CampusLink',
}: SecureExcelViewerProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [workbook, setWorkbook] = useState<Workbook | null>(null);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [activeIdx, setActiveIdx] = useState(0);
    const [sheetData, setSheetData] = useState<SheetData | null>(null);
    const [selectedCell, setSelectedCell] = useState<ParsedCell | null>(null);
    const [formulaTrace, setFormulaTrace] = useState<FormulaTrace | null>(null);
    const [pendingFocus, setPendingFocus] = useState<PendingFocus | null>(null);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQ, setSearchQ] = useState('');
    const [viewerZoom, setViewerZoom] = useState(() => clampExcelZoom(zoomLevel));
    const viewerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [viewHeight, setViewHeight] = useState(600);
    const rafRef = useRef<number | null>(null);
    const zoomFrameRef = useRef<number | null>(null);
    const pendingZoomRef = useRef(viewerZoom);
    const zoomRef = useRef(viewerZoom);
    const imageUrlsRef = useRef<string[]>([]);
    const zoomAnchorRef = useRef<{
        viewportX: number;
        viewportY: number;
        contentX: number;
        contentY: number;
    } | null>(null);
    const pinchRef = useRef<{
        startDistance: number;
        startZoom: number;
        contentX: number;
        contentY: number;
    } | null>(null);

    const requestZoom = useCallback((nextZoom: number) => {
        pendingZoomRef.current = clampExcelZoom(nextZoom);
        zoomRef.current = pendingZoomRef.current;
        if (zoomFrameRef.current !== null) return;
        zoomFrameRef.current = requestAnimationFrame(() => {
            zoomFrameRef.current = null;
            const zoom = pendingZoomRef.current;
            setViewerZoom(zoom);
            onZoomChange?.(zoom);
        });
    }, [onZoomChange]);

    useEffect(() => {
        const nextZoom = clampExcelZoom(zoomLevel);
        zoomRef.current = nextZoom;
        pendingZoomRef.current = nextZoom;
        setViewerZoom(nextZoom);
    }, [zoomLevel]);

    useEffect(() => () => {
        if (zoomFrameRef.current !== null) cancelAnimationFrame(zoomFrameRef.current);
        for (const url of imageUrlsRef.current) URL.revokeObjectURL(url);
        imageUrlsRef.current = [];
    }, []);

    useEffect(() => {
        if (!blob) {
            setLoading(false);
            return;
        }

        let cancelled = false;
        for (const url of imageUrlsRef.current) URL.revokeObjectURL(url);
        imageUrlsRef.current = [];
        setLoading(true);
        setError(null);
        setSheetData(null);
        setFormulaTrace(null);

        blob.arrayBuffer()
            .then(async buffer => {
                const excelJs = await import('exceljs');
                const book = new excelJs.Workbook();
                try {
                    await book.xlsx.load(buffer as any);
                } catch (xlsxError) {
                    // ExcelJS offers the best style fidelity for XLSX. Keep legacy
                    // XLS and CSV files working by normalizing them through SheetJS.
                    const legacyBook = XLSX.read(buffer, {
                        type: 'array',
                        cellDates: true,
                        cellStyles: true,
                        cellNF: true,
                    });
                    const normalized = XLSX.write(legacyBook, {
                        type: 'array',
                        bookType: 'xlsx',
                        cellStyles: true,
                    });
                    try {
                        await book.xlsx.load(normalized as any);
                    } catch {
                        throw xlsxError;
                    }
                }
                if (cancelled) return;
                if (!book.worksheets.length) throw new Error('El archivo no contiene hojas legibles.');
                setWorkbook(book);
                setSheetNames(book.worksheets.map(sheet => sheet.name));
                setActiveIdx(0);
            })
            .catch((reason: any) => {
                if (!cancelled) {
                    setError(reason?.message || 'Error al leer el archivo Excel.');
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [blob]);

    useEffect(() => {
        if (!workbook || !sheetNames.length) return;
        const sheetName = sheetNames[activeIdx];
        const worksheet = workbook.getWorksheet(sheetName) as Worksheet | undefined;
        if (!worksheet) {
            setSheetData(null);
            return;
        }

        try {
            for (const url of imageUrlsRef.current) URL.revokeObjectURL(url);
            imageUrlsRef.current = [];
            const worksheetImages = worksheet.getImages?.() || [];
            const imageEndRow = worksheetImages.reduce(
                (max, image) => {
                    const range = image.range as any;
                    return Math.max(max, Math.ceil(range?.br?.row ?? ((range?.tl?.row || 0) + 1)));
                },
                0,
            );
            const imageEndCol = worksheetImages.reduce(
                (max, image) => {
                    const range = image.range as any;
                    return Math.max(max, Math.ceil(range?.br?.col ?? ((range?.tl?.col || 0) + 1)));
                },
                0,
            );
            const totalRows = Math.min(MAX_RENDER_ROWS, Math.max(1, worksheet.rowCount, imageEndRow));
            const totalCols = Math.min(MAX_RENDER_COLS, Math.max(1, worksheet.columnCount, imageEndCol));
            const mergeOrigins = new Map<string, { colSpan: number; rowSpan: number }>();
            const mergeCovered = new Set<string>();
            const mergeRanges = ((worksheet.model as any).merges || []) as string[];

            for (const mergeAddress of mergeRanges) {
                const range = XLSX.utils.decode_range(mergeAddress);
                const origin = XLSX.utils.encode_cell(range.s);
                mergeOrigins.set(origin, {
                    colSpan: range.e.c - range.s.c + 1,
                    rowSpan: range.e.r - range.s.r + 1,
                });
                for (let row = range.s.r; row <= range.e.r; row++) {
                    for (let col = range.s.c; col <= range.e.c; col++) {
                        if (row !== range.s.r || col !== range.s.c) {
                            mergeCovered.add(XLSX.utils.encode_cell({ r: row, c: col }));
                        }
                    }
                }
            }

            const colLetters = Array.from({ length: totalCols }, (_, col) => columnIndexToName(col));
            const hiddenCols = Array.from(
                { length: totalCols },
                (_, col) => Boolean(worksheet.getColumn(col + 1).hidden),
            );
            const colWidths = Array.from({ length: totalCols }, (_, col) => (
                hiddenCols[col] ? 0 : columnWidthToPixels(worksheet.getColumn(col + 1).width)
            ));
            const hiddenRows = Array.from(
                { length: totalRows },
                (_, row) => Boolean(worksheet.getRow(row + 1).hidden),
            );
            const defaultRowHeight = worksheet.properties.defaultRowHeight || 15;
            const rowHeights = Array.from({ length: totalRows }, (_, row) => (
                hiddenRows[row]
                    ? 0
                    : pointsToPixels(worksheet.getRow(row + 1).height, defaultRowHeight)
            ));
            const images: SheetImage[] = [];
            for (const imagePlacement of worksheetImages) {
                const range = imagePlacement.range as any;
                const image = workbook.getImage(Number(imagePlacement.imageId));
                const extension = image?.extension || 'png';
                let src = image?.base64 || '';
                if (src && !src.startsWith('data:')) {
                    src = 'data:image/' + extension + ';base64,' + src;
                } else if (!src && image?.buffer) {
                    const bytes = new Uint8Array(image.buffer as any);
                    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/' + extension }));
                    imageUrlsRef.current.push(url);
                    src = url;
                }
                if (!src || !range?.tl) continue;

                // DrawingML stores offsets in EMU. Reading those native values avoids
                // the drift caused by treating them as a percentage of each cell.
                const left = anchorOffset(range.tl, colWidths, 'col');
                const top = anchorOffset(range.tl, rowHeights, 'row');
                const right = range.br
                    ? anchorOffset(range.br, colWidths, 'col')
                    : left + Math.max(1, Number(range.ext?.width) || 1);
                const bottom = range.br
                    ? anchorOffset(range.br, rowHeights, 'row')
                    : top + Math.max(1, Number(range.ext?.height) || 1);
                images.push({
                    id: String(imagePlacement.imageId) + '-' + images.length,
                    src,
                    left,
                    top,
                    width: Math.max(1, right - left),
                    height: Math.max(1, bottom - top),
                });
            }
            const date1904 = Boolean(workbook.properties.date1904);
            const rows: ParsedCell[][] = [];

            for (let row = 0; row < totalRows; row++) {
                const parsedRow: ParsedCell[] = [];
                for (let col = 0; col < totalCols; col++) {
                    const addr = XLSX.utils.encode_cell({ r: row, c: col });
                    if (mergeCovered.has(addr)) {
                        parsedRow.push({
                            addr,
                            row,
                            col,
                            text: '',
                            isNum: false,
                            skip: true,
                        });
                        continue;
                    }

                    const cell = worksheet.getCell(row + 1, col + 1);
                    const rawValue = rawValueForCell(cell);
                    const merge = mergeOrigins.get(addr);
                    parsedRow.push({
                        addr,
                        row,
                        col,
                        text: displayTextForCell(cell, date1904),
                        formula: formulaForCell(cell),
                        isNum: typeof rawValue === 'number',
                        style: parseCellStyle(cell),
                        colSpan: merge?.colSpan,
                        rowSpan: merge?.rowSpan,
                    });
                }
                rows.push(parsedRow);
            }

            const view = worksheet.views?.[0] as any;
            const nextSheetData: SheetData = {
                sheetName,
                colLetters,
                colWidths,
                hiddenCols,
                rowHeights,
                hiddenRows,
                rows,
                images,
                totalRows,
                totalCols,
                showGridLines: view?.showGridLines !== false,
            };

            setSheetData(nextSheetData);
            setSelectedCell(firstVisibleCell(rows));
            setSearchQ('');
            setScrollTop(0);
            if (scrollRef.current) scrollRef.current.scrollTo({ top: 0, left: 0 });
        } catch (reason) {
            console.error('[SecureExcelViewer] Error parsing sheet:', reason);
            setError('Error al procesar la estructura y los estilos de la hoja.');
        }
    }, [workbook, activeIdx, sheetNames]);

    useEffect(() => {
        const element = scrollRef.current;
        if (!element) return;
        const observer = new ResizeObserver(entries => {
            if (entries[0]) setViewHeight(entries[0].contentRect.height);
        });
        observer.observe(element);
        setViewHeight(element.clientHeight || 600);
        return () => observer.disconnect();
    }, [loading, sheetData?.sheetName]);

    useEffect(() => {
        const element = scrollRef.current;
        const viewer = viewerRef.current;
        if (!element || !viewer) return;

        const viewportPoint = (first: Touch, second: Touch) => {
            const rect = element.getBoundingClientRect();
            return {
                x: (first.clientX + second.clientX) / 2 - rect.left,
                y: (first.clientY + second.clientY) / 2 - rect.top,
            };
        };

        const handleTouchStart = (event: TouchEvent) => {
            if (event.touches.length !== 2) return;
            event.preventDefault();
            const point = viewportPoint(event.touches[0], event.touches[1]);
            const zoom = zoomRef.current;
            pinchRef.current = {
                startDistance: Math.max(1, touchDistance(event.touches[0], event.touches[1])),
                startZoom: zoom,
                contentX: (element.scrollLeft + point.x) / zoom,
                contentY: (element.scrollTop + point.y) / zoom,
            };
        };

        const handleTouchMove = (event: TouchEvent) => {
            const pinch = pinchRef.current;
            if (!pinch || event.touches.length !== 2) return;
            event.preventDefault();
            const point = viewportPoint(event.touches[0], event.touches[1]);
            zoomAnchorRef.current = {
                viewportX: point.x,
                viewportY: point.y,
                contentX: pinch.contentX,
                contentY: pinch.contentY,
            };
            requestZoom(
                pinch.startZoom
                * (touchDistance(event.touches[0], event.touches[1]) / pinch.startDistance),
            );
        };

        const handleTouchEnd = (event: TouchEvent) => {
            if (event.touches.length < 2) pinchRef.current = null;
        };

        const handleWheelZoom = (event: WheelEvent) => {
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
            event.stopPropagation();
            const rect = element.getBoundingClientRect();
            const viewportX = Math.max(0, Math.min(element.clientWidth, event.clientX - rect.left));
            const viewportY = Math.max(0, Math.min(element.clientHeight, event.clientY - rect.top));
            const zoom = zoomRef.current;
            const normalizedDelta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
                ? event.deltaY * 16
                : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
                    ? event.deltaY * Math.max(1, element.clientHeight)
                    : event.deltaY;
            const limitedDelta = Math.max(-240, Math.min(240, normalizedDelta));
            zoomAnchorRef.current = {
                viewportX,
                viewportY,
                contentX: (element.scrollLeft + viewportX) / zoom,
                contentY: (element.scrollTop + viewportY) / zoom,
            };
            requestZoom(zoom * Math.exp(-limitedDelta * 0.003));
        };

        element.addEventListener('touchstart', handleTouchStart, { passive: false });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd, { passive: true });
        element.addEventListener('touchcancel', handleTouchEnd, { passive: true });
        viewer.addEventListener('wheel', handleWheelZoom, { passive: false, capture: true });
        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
            element.removeEventListener('touchcancel', handleTouchEnd);
            viewer.removeEventListener('wheel', handleWheelZoom, true);
        };
    }, [loading, requestZoom, sheetData?.sheetName]);

    useEffect(() => {
        zoomRef.current = viewerZoom;
        const anchor = zoomAnchorRef.current;
        const element = scrollRef.current;
        if (!anchor || !element) return;
        element.scrollLeft = Math.max(0, anchor.contentX * viewerZoom - anchor.viewportX);
        element.scrollTop = Math.max(0, anchor.contentY * viewerZoom - anchor.viewportY);
        zoomAnchorRef.current = null;
    }, [viewerZoom]);

    useEffect(() => {
        if (!pendingFocus || !sheetData) return;
        if (pendingFocus.sheetName.toLowerCase() !== sheetData.sheetName.toLowerCase()) return;
        const cell = sheetData.rows[pendingFocus.row]?.[pendingFocus.col];
        if (!cell) {
            setPendingFocus(null);
            return;
        }

        setSelectedCell(cell);
        const top = sheetData.rowHeights
            .slice(0, pendingFocus.row)
            .reduce((sum, height, index) => sum + (sheetData.hiddenRows[index] ? 0 : height * viewerZoom), 0);
        const left = sheetData.colWidths
            .slice(0, pendingFocus.col)
            .reduce((sum, width) => sum + width * viewerZoom, ROW_NUMBER_WIDTH);
        scrollRef.current?.scrollTo({
            top: Math.max(0, top - 60),
            left: Math.max(0, left - 80),
            behavior: 'smooth',
        });
        setPendingFocus(null);
    }, [pendingFocus, sheetData, viewerZoom]);

    const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
        const top = event.currentTarget.scrollTop;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => setScrollTop(top));
    }, []);

    const scaledRowHeights = useMemo(() => (
        sheetData?.rowHeights.map((height, index) => (
            sheetData.hiddenRows[index] ? 0 : Math.max(0.5, height * viewerZoom)
        )) || []
    ), [sheetData, viewerZoom]);

    const rowOffsets = useMemo(() => {
        const offsets = [0];
        for (const height of scaledRowHeights) {
            offsets.push(offsets[offsets.length - 1] + height);
        }
        return offsets;
    }, [scaledRowHeights]);

    const isLargeSheet = (sheetData?.totalRows || 0) > 150;
    const visibleWindow = useMemo(() => {
        if (!sheetData || !isLargeSheet) {
            return {
                visStart: 0,
                visEnd: sheetData?.totalRows || 0,
                topPad: 0,
                bottomPad: 0,
            };
        }

        const findRow = (offset: number) => {
            let low = 0;
            let high = rowOffsets.length - 1;
            while (low < high) {
                const mid = Math.floor((low + high) / 2);
                if (rowOffsets[mid] < offset) low = mid + 1;
                else high = mid;
            }
            return Math.max(0, low - 1);
        };

        const buffer = 12;
        const visStart = Math.max(0, findRow(scrollTop) - buffer);
        const visEnd = Math.min(sheetData.totalRows, findRow(scrollTop + viewHeight) + buffer);
        return {
            visStart,
            visEnd,
            topPad: rowOffsets[visStart],
            bottomPad: rowOffsets[rowOffsets.length - 1] - rowOffsets[visEnd],
        };
    }, [sheetData, isLargeSheet, rowOffsets, scrollTop, viewHeight]);

    const matchCount = useMemo(() => {
        if (!sheetData || !searchQ.trim()) return 0;
        const query = searchQ.toLocaleLowerCase();
        return sheetData.rows.reduce(
            (total, row) => total + row.filter(
                cell => !cell.skip && cell.text.toLocaleLowerCase().includes(query),
            ).length,
            0,
        );
    }, [sheetData, searchQ]);

    const handleCellClick = useCallback((cell: ParsedCell) => {
        setSelectedCell(cell);
        if (
            formulaTrace
            && (formulaTrace.sourceAddr !== cell.addr || formulaTrace.sourceSheet !== sheetData?.sheetName)
        ) {
            setFormulaTrace(null);
        }
    }, [formulaTrace, sheetData?.sheetName]);

    const handleCellDoubleClick = useCallback((cell: ParsedCell) => {
        setSelectedCell(cell);
        if (!cell.formula || !sheetData) {
            setFormulaTrace(null);
            return;
        }
        const references = extractFormulaReferences(cell.formula, sheetData.sheetName);
        setFormulaTrace(references.length ? {
            sourceAddr: cell.addr,
            sourceSheet: sheetData.sheetName,
            references,
        } : null);
    }, [sheetData]);

    const focusReference = useCallback((reference: FormulaReference) => {
        const sheetIndex = sheetNames.findIndex(
            name => name.toLowerCase() === reference.sheetName.toLowerCase(),
        );
        if (sheetIndex < 0) return;
        setPendingFocus({
            sheetName: sheetNames[sheetIndex],
            row: reference.startRow,
            col: reference.startCol,
        });
        if (sheetIndex !== activeIdx) setActiveIdx(sheetIndex);
    }, [activeIdx, sheetNames]);

    if (loading) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4 shadow-sm">
                    <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                </div>
                <p className="text-sm font-bold text-slate-800">Cargando libro de cálculo...</p>
                <p className="text-xs text-slate-400 mt-1">Leyendo tipografías, bordes y fórmulas</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
                <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
                <h3 className="text-base font-bold text-slate-800 mb-1">No se pudo visualizar la hoja</h3>
                <p className="text-xs text-slate-500 max-w-sm">{error}</p>
            </div>
        );
    }

    if (!sheetData) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                <FileSpreadsheet className="w-12 h-12 mb-2 opacity-30" />
                <p className="text-sm font-medium">Hoja de cálculo vacía</p>
            </div>
        );
    }

    const {
        colLetters,
        colWidths,
        hiddenCols,
        hiddenRows,
        rows,
        images,
        totalRows,
        totalCols,
        showGridLines,
    } = sheetData;
    const { visStart, visEnd, topPad, bottomPad } = visibleWindow;
    const visibleRows = rows.slice(visStart, visEnd);
    const headerHeight = Math.max(20, Math.round(24 * viewerZoom));
    const query = searchQ.trim().toLocaleLowerCase();
    const gridBorder = showGridLines ? '1px solid #d9d9d9' : 'none';

    return (
        <div
            ref={viewerRef}
            className="w-full h-full flex flex-col bg-white overflow-hidden select-none text-black"
            aria-label={'Visor de Excel: ' + fileName}
            tabIndex={0}
            onKeyDown={event => {
                if (event.key === 'Escape') setFormulaTrace(null);
            }}
            onContextMenu={event => event.preventDefault()}
        >
            <div className="h-10 bg-[#f3f6f9] border-b border-slate-300 flex items-center px-2 gap-2 shrink-0 z-30">
                <div className="min-w-[64px] h-7 flex items-center justify-center bg-white border border-slate-300 rounded-sm px-2 shrink-0">
                    <span className="text-[11px] font-semibold text-[#107c41]">
                        {selectedCell?.addr || 'A1'}
                    </span>
                </div>

                <div className="flex-1 h-7 flex items-center bg-white border border-slate-300 rounded-sm px-2 gap-2 overflow-hidden min-w-0">
                    <span className="text-sm font-serif italic text-slate-500 shrink-0 select-none">fx</span>
                    <span className="text-xs text-black truncate font-mono">
                        {selectedCell ? (selectedCell.formula || selectedCell.text) : ''}
                    </span>
                </div>

                {showSearch ? (
                    <div className="flex h-7 items-center bg-white border border-[#107c41] rounded px-2 gap-1.5 shrink-0">
                        <Search className="w-3.5 h-3.5 text-[#107c41] shrink-0" />
                        <input
                            type="text"
                            autoFocus
                            value={searchQ}
                            onChange={event => setSearchQ(event.target.value)}
                            placeholder="Buscar..."
                            className="w-28 sm:w-40 text-xs focus:outline-none bg-transparent text-black"
                        />
                        {searchQ && (
                            <span className="text-[10px] font-bold text-[#107c41] bg-emerald-50 rounded px-1">
                                {matchCount}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQ('');
                                setShowSearch(false);
                            }}
                            className="p-0.5 text-slate-500 hover:text-black"
                            aria-label="Cerrar búsqueda"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowSearch(true)}
                        className="p-1.5 text-slate-600 hover:bg-slate-200 rounded"
                        title="Buscar en la hoja"
                    >
                        <Search className="w-4 h-4" />
                    </button>
                )}
            </div>

            {formulaTrace && (
                <div className="min-h-8 bg-white border-b border-slate-200 px-3 py-1 flex items-center gap-2 shrink-0 overflow-x-auto z-20">
                    <span className="text-[11px] text-slate-600 whitespace-nowrap">
                        Origen de {formulaTrace.sourceAddr}:
                    </span>
                    {formulaTrace.references.map(reference => (
                        <button
                            key={reference.id}
                            type="button"
                            onClick={() => focusReference(reference)}
                            className="h-6 px-2 rounded border bg-white text-[11px] font-semibold whitespace-nowrap hover:bg-slate-50"
                            style={{ color: reference.color, borderColor: reference.color }}
                            title={'Ir a ' + reference.label}
                        >
                            {reference.label}
                        </button>
                    ))}
                    <span className="text-[10px] text-slate-400 whitespace-nowrap ml-auto">
                        Esc para ocultar
                    </span>
                </div>
            )}

            <div
                id="secure-excel-scroll-container"
                ref={scrollRef}
                className="flex-1 overflow-auto relative bg-white"
                onScroll={handleScroll}
                style={{
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehavior: 'contain',
                    touchAction: 'pan-x pan-y',
                }}
            >
                <div
                    className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none"
                    aria-hidden="true"
                    style={{ opacity: 0.025 }}
                >
                    {Array.from({ length: 32 }).map((_, index) => (
                        <div
                            key={index}
                            className="inline-block font-black text-slate-900 text-sm tracking-widest whitespace-nowrap m-12"
                            style={{ transform: 'rotate(-25deg)' }}
                        >
                            {userWatermark} • CajaAzul Excel
                        </div>
                    ))}
                </div>

                <div className="inline-block min-w-fit align-top relative z-10">
                    <table
                        className="border-collapse table-fixed bg-white"
                        style={{ fontFamily: 'Calibri, Aptos, Segoe UI, sans-serif' }}
                    >
                        <colgroup>
                            <col style={{ width: ROW_NUMBER_WIDTH, minWidth: ROW_NUMBER_WIDTH }} />
                            {colWidths.map((width, index) => (
                                <col
                                    key={colLetters[index]}
                                    style={{
                                        width: hiddenCols[index] ? 0 : Math.max(0.5, width * viewerZoom),
                                        minWidth: hiddenCols[index] ? 0 : Math.max(0.5, width * viewerZoom),
                                        display: hiddenCols[index] ? 'none' : undefined,
                                    }}
                                />
                            ))}
                        </colgroup>

                        <thead className="sticky top-0 z-20">
                            <tr style={{ height: headerHeight }}>
                                <th
                                    className="sticky left-0 z-30 bg-[#f3f3f3] border-r border-b border-[#c8c8c8] select-none"
                                    style={{ width: ROW_NUMBER_WIDTH, minWidth: ROW_NUMBER_WIDTH }}
                                >
                                    <span className="block w-0 h-0 border-l-[7px] border-l-transparent border-t-[7px] border-t-slate-400 m-1" />
                                </th>
                                {colLetters.map((letter, col) => {
                                    const selected = selectedCell?.col === col;
                                    return (
                                        <th
                                            key={letter}
                                            className="border-r border-b border-[#c8c8c8] text-center text-[12px] font-normal select-none"
                                            style={{
                                                display: hiddenCols[col] ? 'none' : undefined,
                                                height: headerHeight,
                                                backgroundColor: selected ? '#e2f0e8' : '#f3f3f3',
                                                color: selected ? '#107c41' : '#333333',
                                                borderBottomColor: selected ? '#107c41' : '#c8c8c8',
                                            }}
                                        >
                                            {letter}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>

                        <tbody>
                            {topPad > 0 && (
                                <tr style={{ height: topPad }}>
                                    <td colSpan={totalCols + 1} className="p-0 border-0" />
                                </tr>
                            )}

                            {visibleRows.map((rowCells, rowOffset) => {
                                const row = visStart + rowOffset;
                                const rowNumber = row + 1;
                                const selectedRow = selectedCell?.row === row;
                                const rowHeight = scaledRowHeights[row] || 0;

                                return (
                                    <tr
                                        key={rowNumber}
                                        style={{
                                            height: rowHeight,
                                            display: hiddenRows[row] ? 'none' : undefined,
                                        }}
                                    >
                                        <td
                                            className="sticky left-0 z-10 border-r border-b border-[#c8c8c8] text-center text-[11px] font-normal select-none"
                                            style={{
                                                width: ROW_NUMBER_WIDTH,
                                                minWidth: ROW_NUMBER_WIDTH,
                                                backgroundColor: selectedRow ? '#e2f0e8' : '#f3f3f3',
                                                color: selectedRow ? '#107c41' : '#444444',
                                                borderRightColor: selectedRow ? '#107c41' : '#c8c8c8',
                                            }}
                                        >
                                            {rowNumber}
                                        </td>

                                        {rowCells.map((cell, col) => {
                                            if (cell.skip) return null;
                                            const style = cell.style;
                                            const isSelected = selectedCell?.addr === cell.addr;
                                            const isMatch = Boolean(query && cell.text.toLocaleLowerCase().includes(query));
                                            const tracedReference = formulaTrace?.references.find(reference => (
                                                referenceContainsCell(reference, sheetData.sheetName, cell.row, cell.col)
                                            ));
                                            const baseBackground = style?.bgColor || '#ffffff';
                                            const textDecoration = [
                                                style?.underline ? 'underline' : '',
                                                style?.strike ? 'line-through' : '',
                                            ].filter(Boolean).join(' ') || undefined;
                                            const boxShadow = isSelected
                                                ? 'inset 0 0 0 2px #107c41'
                                                : tracedReference
                                                    ? traceShadow(tracedReference, cell.row, cell.col)
                                                    : undefined;
                                            const backgroundImage = tracedReference
                                                ? 'linear-gradient(' + tracedReference.tint + ', ' + tracedReference.tint + ')'
                                                : undefined;
                                            const cellStyle: React.CSSProperties = {
                                                display: hiddenCols[col] ? 'none' : undefined,
                                                height: rowHeight,
                                                minWidth: cell.colSpan ? undefined : Math.max(0.5, colWidths[col] * viewerZoom),
                                                paddingTop: 0,
                                                paddingBottom: 0,
                                                paddingLeft: Math.max(0.5, (3 + (style?.indent || 0) * 8) * viewerZoom),
                                                paddingRight: Math.max(0.5, 3 * viewerZoom),
                                                textAlign: style?.align || (cell.isNum ? 'right' : 'left'),
                                                verticalAlign: style?.verticalAlign || 'middle',
                                                fontFamily: style?.fontFamily
                                                    ? style.fontFamily + ', Calibri, Aptos, sans-serif'
                                                    : 'Calibri, Aptos, Segoe UI, sans-serif',
                                                fontSize: Math.max(1, (style?.fontSize || 11) * (96 / 72) * viewerZoom),
                                                fontWeight: style?.bold ? 700 : 400,
                                                fontStyle: style?.italic ? 'italic' : 'normal',
                                                textDecorationLine: textDecoration,
                                                textDecorationStyle: style?.doubleUnderline ? 'double' : 'solid',
                                                color: style?.fontColor || '#000000',
                                                backgroundColor: isMatch ? '#fff2a8' : baseBackground,
                                                backgroundImage,
                                                borderTop: style?.borderTop || gridBorder,
                                                borderBottom: style?.borderBottom || gridBorder,
                                                borderLeft: style?.borderLeft || gridBorder,
                                                borderRight: style?.borderRight || gridBorder,
                                                whiteSpace: style?.wrapText ? 'pre-wrap' : 'nowrap',
                                                overflow: style?.wrapText ? 'hidden' : 'visible',
                                                wordBreak: style?.wrapText ? 'break-word' : undefined,
                                                cursor: cell.formula ? 'crosshair' : 'cell',
                                                boxShadow,
                                                position: 'relative',
                                                transform: style?.rotation
                                                    ? 'rotate(' + (style.rotation > 90 ? 90 - style.rotation : -style.rotation) + 'deg)'
                                                    : undefined,
                                            };

                                            return (
                                                <td
                                                    key={cell.addr}
                                                    colSpan={cell.colSpan}
                                                    rowSpan={cell.rowSpan}
                                                    style={cellStyle}
                                                    onClick={() => handleCellClick(cell)}
                                                    onDoubleClick={() => handleCellDoubleClick(cell)}
                                                    title={
                                                        cell.formula
                                                            ? cell.addr + ': ' + cell.formula + ' · Doble clic para rastrear'
                                                            : cell.addr + ': ' + (cell.text || '(vacía)')
                                                    }
                                                >
                                                    <span
                                                        className="relative block pointer-events-none"
                                                        style={{
                                                            zIndex: cell.text ? 1 : undefined,
                                                            width: style?.wrapText ? 'auto' : 'max-content',
                                                            marginLeft: (style?.align || (cell.isNum ? 'right' : 'left')) === 'right'
                                                                ? 'auto'
                                                                : undefined,
                                                        }}
                                                    >
                                                        {cell.text || '\u00A0'}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}

                            {bottomPad > 0 && (
                                <tr style={{ height: bottomPad }}>
                                    <td colSpan={totalCols + 1} className="p-0 border-0" />
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {images.map(image => (
                        <img
                            key={image.id}
                            src={image.src}
                            alt="Imagen incrustada en la hoja"
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                            className="absolute z-[15] pointer-events-none select-none object-fill"
                            style={{
                                left: ROW_NUMBER_WIDTH + image.left * viewerZoom,
                                top: headerHeight + image.top * viewerZoom,
                                width: image.width * viewerZoom,
                                height: image.height * viewerZoom,
                            }}
                        />
                    ))}
                </div>
            </div>

            <div className="h-10 bg-[#eef3f6] border-t border-[#c8c8c8] flex items-center shrink-0 overflow-hidden">
                <div className="px-3 shrink-0 flex items-center gap-1.5 text-slate-600">
                    <FileSpreadsheet className="w-4 h-4 text-[#107c41]" />
                    <span className="text-[10px] uppercase font-bold tracking-wider hidden sm:inline">Hojas</span>
                </div>

                <div className="flex items-end overflow-x-auto scrollbar-none flex-1 h-full gap-0">
                    {sheetNames.map((name, index) => {
                        const active = index === activeIdx;
                        return (
                            <button
                                key={name}
                                type="button"
                                onClick={() => {
                                    setFormulaTrace(null);
                                    setPendingFocus(null);
                                    setActiveIdx(index);
                                }}
                                className={
                                    'h-full px-4 text-xs whitespace-nowrap shrink-0 border-r border-[#d5dadd] border-b-2 transition-colors ' +
                                    (active
                                        ? 'bg-white text-black font-semibold border-b-[#107c41]'
                                        : 'bg-[#eef3f6] text-slate-700 font-normal border-b-transparent hover:bg-white')
                                }
                            >
                                {name}
                            </button>
                        );
                    })}
                </div>

                <div className="px-3 shrink-0 text-slate-500 text-[11px] font-mono gap-2 hidden sm:flex border-l border-[#d5dadd]">
                    <span>{totalRows} filas</span>
                    <span>•</span>
                    <span>{totalCols} columnas</span>
                </div>
            </div>
        </div>
    );
}
