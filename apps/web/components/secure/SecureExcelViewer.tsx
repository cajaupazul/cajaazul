'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Cell, Workbook, Worksheet } from 'exceljs';
import * as XLSX from 'xlsx';
import { AlertCircle, ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, Search, X } from 'lucide-react';
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
    right: number;
    top: number;
    width: number;
    height: number;
    editAs: 'absolute' | 'oneCell' | 'twoCell';
}

interface MergedRowRange {
    startRow: number;
    endRow: number;
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
    mergedRowRanges: MergedRowRange[];
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

interface ColumnResizeSession {
    col: number;
    pointerId: number;
    pointerType: string;
    startClientX: number;
    startWidth: number;
    currentWidth: number;
    moved: boolean;
    previousCursor: string;
    previousUserSelect: string;
}

interface TextSpillMetrics {
    width: number;
    offset: number;
    align: 'left' | 'right';
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
const MAX_AUTOFIT_COLUMN_WIDTH = 900;
const MAX_AUTOFIT_CANDIDATES = 32;
const MIN_MANUAL_COLUMN_WIDTH = 24;
const MAX_MANUAL_COLUMN_WIDTH = 1600;

function textSpillMetrics(
    cell: ParsedCell,
    row: ParsedCell[],
    widths: number[],
    hiddenCols: boolean[],
): TextSpillMetrics | null {
    const align = cell.style?.align || (cell.isNum ? 'right' : 'left');
    if (
        !cell.text
        || cell.isNum
        || cell.style?.wrapText
        || cell.style?.rotation
        || (cell.colSpan || 1) > 1
        || (cell.rowSpan || 1) > 1
        || (align !== 'left' && align !== 'right')
    ) return null;

    const isEmpty = (candidate: ParsedCell | undefined) => Boolean(
        candidate
        && !candidate.skip
        && !candidate.text
        && !candidate.formula
        && (candidate.colSpan || 1) === 1
        && (candidate.rowSpan || 1) === 1,
    );

    let start = cell.col;
    let end = cell.col;
    if (align === 'right') {
        for (let col = cell.col - 1; col >= 0; col--) {
            if (hiddenCols[col]) continue;
            if (!isEmpty(row[col])) break;
            start = col;
        }
    } else {
        for (let col = cell.col + 1; col < row.length; col++) {
            if (hiddenCols[col]) continue;
            if (!isEmpty(row[col])) break;
            end = col;
        }
    }

    if (start === end) return null;
    let width = 0;
    for (let col = start; col <= end; col++) width += widths[col] || 0;
    let offset = 0;
    for (let col = start; col < cell.col; col++) offset += widths[col] || 0;
    return { width, offset, align };
}

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

function remapAxisOffset(position: number, originalSizes: number[], nextSizes: number[]): number {
    let originalOffset = 0;
    let nextOffset = 0;
    for (let index = 0; index < originalSizes.length; index++) {
        const originalSize = originalSizes[index] || 0;
        if (position < originalOffset + originalSize || index === originalSizes.length - 1) {
            return nextOffset + Math.max(0, position - originalOffset);
        }
        originalOffset += originalSize;
        nextOffset += nextSizes[index] || 0;
    }
    return nextOffset;
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
    const [columnWidthOverrides, setColumnWidthOverrides] = useState<Record<number, number>>({});
    const [resizingColumn, setResizingColumn] = useState<number | null>(null);
    const viewerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const sheetTabsRef = useRef<HTMLDivElement>(null);
    const sheetTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const measurementCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const lastDoubleActionRef = useRef<{ addr: string; at: number } | null>(null);
    const lastTouchTapRef = useRef<{ addr: string; at: number } | null>(null);
    const touchStartRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
    const columnResizeRef = useRef<ColumnResizeSession | null>(null);
    const lastColumnTouchTapRef = useRef<{ col: number; at: number } | null>(null);
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
        const resize = columnResizeRef.current;
        if (resize) {
            document.body.style.cursor = resize.previousCursor;
            document.body.style.userSelect = resize.previousUserSelect;
        }
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
            const mergeAddresses = ((worksheet.model as any).merges || []) as string[];
            const decodedMergeRanges = mergeAddresses.map(address => XLSX.utils.decode_range(address));
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
            const mergeEndRow = decodedMergeRanges.reduce(
                (max, range) => Math.max(max, range.e.r + 1),
                0,
            );
            const mergeEndCol = decodedMergeRanges.reduce(
                (max, range) => Math.max(max, range.e.c + 1),
                0,
            );
            const totalRows = Math.min(
                MAX_RENDER_ROWS,
                Math.max(1, worksheet.rowCount, imageEndRow, mergeEndRow),
            );
            const totalCols = Math.min(
                MAX_RENDER_COLS,
                Math.max(1, worksheet.columnCount, imageEndCol, mergeEndCol),
            );
            const mergeOrigins = new Map<string, { colSpan: number; rowSpan: number }>();
            const mergeCovered = new Set<string>();
            const mergedRowRanges: MergedRowRange[] = [];

            for (const range of decodedMergeRanges) {
                if (range.s.r >= totalRows || range.s.c >= totalCols) continue;
                const endRow = Math.min(range.e.r, totalRows - 1);
                const endCol = Math.min(range.e.c, totalCols - 1);
                const origin = XLSX.utils.encode_cell(range.s);
                mergeOrigins.set(origin, {
                    colSpan: endCol - range.s.c + 1,
                    rowSpan: endRow - range.s.r + 1,
                });
                if (endRow > range.s.r) {
                    mergedRowRanges.push({ startRow: range.s.r, endRow });
                }
                for (let row = range.s.r; row <= endRow; row++) {
                    for (let col = range.s.c; col <= endCol; col++) {
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
                    right,
                    top,
                    width: Math.max(1, right - left),
                    height: Math.max(1, bottom - top),
                    editAs: range.editAs === 'absolute' || range.editAs === 'twoCell'
                        ? range.editAs
                        : 'oneCell',
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
                mergedRowRanges,
                totalRows,
                totalCols,
                showGridLines: view?.showGridLines !== false,
            };

            setSheetData(nextSheetData);
            setColumnWidthOverrides({});
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
        const strip = sheetTabsRef.current;
        const tab = sheetTabRefs.current[activeIdx];
        if (!strip || !tab) return;

        const stripRect = strip.getBoundingClientRect();
        const tabRect = tab.getBoundingClientRect();
        if (tabRect.left < stripRect.left) {
            strip.scrollBy({ left: tabRect.left - stripRect.left, behavior: 'smooth' });
        } else if (tabRect.right > stripRect.right) {
            strip.scrollBy({ left: tabRect.right - stripRect.right, behavior: 'smooth' });
        }
    }, [activeIdx, sheetNames]);

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
            .reduce((sum, width) => sum + width * viewerZoom, Math.max(18, ROW_NUMBER_WIDTH * viewerZoom));
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

    const effectiveColWidths = useMemo(() => (
        sheetData?.colWidths.map((width, index) => (
            sheetData.hiddenCols[index] ? 0 : (columnWidthOverrides[index] ?? width)
        )) || []
    ), [columnWidthOverrides, sheetData]);

    const scaledColWidths = useMemo(() => (
        effectiveColWidths.map((width, index) => (
            sheetData?.hiddenCols[index] ? 0 : Math.max(0.5, width * viewerZoom)
        ))
    ), [effectiveColWidths, sheetData, viewerZoom]);

    const effectiveImages = useMemo(() => {
        if (!sheetData) return [];
        return sheetData.images.map(image => {
            if (image.editAs === 'absolute') return image;
            const left = remapAxisOffset(image.left, sheetData.colWidths, effectiveColWidths);
            if (image.editAs !== 'twoCell') return { ...image, left };
            const right = remapAxisOffset(image.right, sheetData.colWidths, effectiveColWidths);
            return {
                ...image,
                left,
                right,
                width: Math.max(1, right - left),
            };
        });
    }, [effectiveColWidths, sheetData]);

    const rowHeaderWidth = Math.max(18, ROW_NUMBER_WIDTH * viewerZoom);
    const tableWidth = useMemo(
        () => rowHeaderWidth + scaledColWidths.reduce((sum, width) => sum + width, 0),
        [rowHeaderWidth, scaledColWidths],
    );

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
        let visStart = Math.max(0, findRow(scrollTop) - buffer);
        let visEnd = Math.min(sheetData.totalRows, findRow(scrollTop + viewHeight) + buffer);

        // A merged cell must keep its origin and every row covered by its rowspan
        // mounted together. Otherwise the browser recalculates the table when its
        // origin leaves the virtual window, producing width jumps while scrolling.
        let changed = true;
        let passes = 0;
        while (changed && passes <= sheetData.mergedRowRanges.length) {
            changed = false;
            passes += 1;
            for (const merge of sheetData.mergedRowRanges) {
                if (merge.startRow < visStart && merge.endRow >= visStart) {
                    visStart = merge.startRow;
                    changed = true;
                }
                if (merge.startRow < visEnd && merge.endRow + 1 > visEnd) {
                    visEnd = Math.min(sheetData.totalRows, merge.endRow + 1);
                    changed = true;
                }
            }
        }

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

    const autoFitColumn = useCallback((col: number) => {
        if (!sheetData || sheetData.hiddenCols[col]) return;

        const candidates: Array<{ cell: ParsedCell; score: number }> = [];
        for (const row of sheetData.rows) {
            const cell = row[col];
            if (!cell || cell.skip || !cell.text || (cell.colSpan || 1) > 1 || cell.style?.wrapText) continue;
            const score = Array.from(cell.text).length
                * (cell.style?.fontSize || 11)
                * (cell.style?.bold ? 1.12 : 1);
            if (candidates.length < MAX_AUTOFIT_CANDIDATES) {
                candidates.push({ cell, score });
                continue;
            }
            let smallestIndex = 0;
            for (let index = 1; index < candidates.length; index++) {
                if (candidates[index].score < candidates[smallestIndex].score) smallestIndex = index;
            }
            if (score > candidates[smallestIndex].score) candidates[smallestIndex] = { cell, score };
        }

        if (!candidates.length) return;
        if (!measurementCanvasRef.current) measurementCanvasRef.current = document.createElement('canvas');
        const context = measurementCanvasRef.current.getContext('2d');
        let requiredWidth = MIN_MANUAL_COLUMN_WIDTH;

        for (const { cell } of candidates) {
            const style = cell.style;
            const fontSize = (style?.fontSize || 11) * (96 / 72);
            let textWidth = Array.from(cell.text).length * fontSize * 0.55;
            if (context) {
                context.font = [
                    style?.italic ? 'italic' : '',
                    style?.bold ? '700' : '400',
                    fontSize + 'px',
                    style?.fontFamily || 'Calibri, Aptos, Segoe UI, sans-serif',
                ].filter(Boolean).join(' ');
                textWidth = context.measureText(cell.text.replace(/\r?\n/g, ' ')).width;
            }
            const horizontalPadding = 10 + (style?.indent || 0) * 8;
            requiredWidth = Math.max(requiredWidth, textWidth + horizontalPadding);
        }

        const nextWidth = Math.min(MAX_AUTOFIT_COLUMN_WIDTH, Math.ceil(requiredWidth));
        setColumnWidthOverrides(current => (
            current[col] === nextWidth ? current : { ...current, [col]: nextWidth }
        ));
    }, [sheetData]);

    const clearColumnResizePreview = useCallback((col: number) => {
        const table = tableRef.current;
        if (!table) return;
        table.style.removeProperty(`--excel-col-${col}-width`);
        table.style.removeProperty('--excel-table-width');
    }, []);

    const handleColumnResizeStart = useCallback((event: React.PointerEvent<HTMLButtonElement>, col: number) => {
        if (!sheetData || sheetData.hiddenCols[col]) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);

        const startWidth = effectiveColWidths[col] || sheetData.colWidths[col] || MIN_MANUAL_COLUMN_WIDTH;
        columnResizeRef.current = {
            col,
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            startClientX: event.clientX,
            startWidth,
            currentWidth: startWidth,
            moved: false,
            previousCursor: document.body.style.cursor,
            previousUserSelect: document.body.style.userSelect,
        };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        setResizingColumn(col);
    }, [effectiveColWidths, sheetData]);

    const handleColumnResizeMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
        const resize = columnResizeRef.current;
        if (!resize || resize.pointerId !== event.pointerId) return;
        event.preventDefault();

        const delta = (event.clientX - resize.startClientX) / Math.max(viewerZoom, 0.01);
        const nextWidth = Math.min(
            MAX_MANUAL_COLUMN_WIDTH,
            Math.max(MIN_MANUAL_COLUMN_WIDTH, resize.startWidth + delta),
        );
        resize.currentWidth = Math.round(nextWidth);
        resize.moved = resize.moved || Math.abs(event.clientX - resize.startClientX) > 2;

        const table = tableRef.current;
        if (!table) return;
        table.style.setProperty(`--excel-col-${resize.col}-width`, `${resize.currentWidth * viewerZoom}px`);
        const currentWidth = effectiveColWidths[resize.col] || resize.startWidth;
        const previewTableWidth = tableWidth + (resize.currentWidth - currentWidth) * viewerZoom;
        table.style.setProperty('--excel-table-width', `${Math.max(rowHeaderWidth, previewTableWidth)}px`);
    }, [effectiveColWidths, rowHeaderWidth, tableWidth, viewerZoom]);

    const finishColumnResize = useCallback((event: React.PointerEvent<HTMLButtonElement>, commit: boolean) => {
        const resize = columnResizeRef.current;
        if (!resize || resize.pointerId !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();

        document.body.style.cursor = resize.previousCursor;
        document.body.style.userSelect = resize.previousUserSelect;
        columnResizeRef.current = null;
        setResizingColumn(null);

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        let shouldAutoFit = false;
        if (commit && resize.pointerType === 'touch' && !resize.moved) {
            const now = performance.now();
            const previous = lastColumnTouchTapRef.current;
            shouldAutoFit = previous?.col === resize.col && now - previous.at <= 360;
            lastColumnTouchTapRef.current = shouldAutoFit ? null : { col: resize.col, at: now };
        }

        if (shouldAutoFit) {
            autoFitColumn(resize.col);
        } else if (commit && resize.moved) {
            setColumnWidthOverrides(current => ({ ...current, [resize.col]: resize.currentWidth }));
        }

        if (commit && (resize.moved || shouldAutoFit)) {
            requestAnimationFrame(() => clearColumnResizePreview(resize.col));
        } else {
            clearColumnResizePreview(resize.col);
        }
    }, [autoFitColumn, clearColumnResizePreview]);

    const handleColumnResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, col: number) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        event.stopPropagation();
        const currentWidth = effectiveColWidths[col] || MIN_MANUAL_COLUMN_WIDTH;
        const screenStep = event.shiftKey ? 24 : 8;
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const nextWidth = Math.min(
            MAX_MANUAL_COLUMN_WIDTH,
            Math.max(MIN_MANUAL_COLUMN_WIDTH, currentWidth + direction * screenStep / Math.max(viewerZoom, 0.01)),
        );
        setColumnWidthOverrides(current => ({ ...current, [col]: Math.round(nextWidth) }));
    }, [effectiveColWidths, viewerZoom]);

    const handleCellDoubleClick = useCallback((cell: ParsedCell) => {
        const now = performance.now();
        const previous = lastDoubleActionRef.current;
        if (previous?.addr === cell.addr && now - previous.at < 250) return;
        lastDoubleActionRef.current = { addr: cell.addr, at: now };
        setSelectedCell(cell);
        if (!cell.formula || !sheetData) {
            setFormulaTrace(null);
            autoFitColumn(cell.col);
            return;
        }
        const references = extractFormulaReferences(cell.formula, sheetData.sheetName);
        setFormulaTrace(references.length ? {
            sourceAddr: cell.addr,
            sourceSheet: sheetData.sheetName,
            references,
        } : null);
    }, [autoFitColumn, sheetData]);

    const handleCellPointerDown = useCallback((event: React.PointerEvent) => {
        if (event.pointerType !== 'touch') return;
        touchStartRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
        };
    }, []);

    const handleCellPointerCancel = useCallback(() => {
        touchStartRef.current = null;
        lastTouchTapRef.current = null;
    }, []);

    const handleCellPointerUp = useCallback((event: React.PointerEvent, cell: ParsedCell) => {
        if (event.pointerType !== 'touch') return;
        const start = touchStartRef.current;
        touchStartRef.current = null;
        if (
            !start
            || start.pointerId !== event.pointerId
            || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10
        ) {
            lastTouchTapRef.current = null;
            return;
        }
        const now = performance.now();
        const previous = lastTouchTapRef.current;
        if (previous?.addr === cell.addr && now - previous.at <= 360) {
            event.preventDefault();
            lastTouchTapRef.current = null;
            handleCellDoubleClick(cell);
            return;
        }
        lastTouchTapRef.current = { addr: cell.addr, at: now };
    }, [handleCellDoubleClick]);

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

    const selectSheet = useCallback((index: number) => {
        if (index < 0 || index >= sheetNames.length) return;
        setFormulaTrace(null);
        setPendingFocus(null);
        setActiveIdx(index);
    }, [sheetNames.length]);

    const scrollSheetTabs = useCallback((direction: -1 | 1) => {
        const strip = sheetTabsRef.current;
        if (!strip) return;
        strip.scrollBy({
            left: direction * Math.max(160, strip.clientWidth * 0.7),
            behavior: 'smooth',
        });
    }, []);

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
    const headerHeight = Math.max(12, 24 * viewerZoom);
    const headerFontSize = Math.max(7, 12 * viewerZoom);
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
                        ref={tableRef}
                        className="border-collapse table-fixed bg-white"
                        style={{
                            fontFamily: 'Calibri, Aptos, Segoe UI, sans-serif',
                            tableLayout: 'fixed',
                            width: `var(--excel-table-width, ${tableWidth}px)`,
                            minWidth: `var(--excel-table-width, ${tableWidth}px)`,
                        }}
                    >
                        <colgroup>
                            <col style={{ width: rowHeaderWidth, minWidth: rowHeaderWidth }} />
                            {colWidths.map((_, index) => (
                                <col
                                    key={colLetters[index]}
                                    style={{
                                        width: `var(--excel-col-${index}-width, ${scaledColWidths[index]}px)`,
                                        minWidth: `var(--excel-col-${index}-width, ${scaledColWidths[index]}px)`,
                                        display: hiddenCols[index] ? 'none' : undefined,
                                    }}
                                />
                            ))}
                        </colgroup>

                        <thead className="sticky top-0 z-20">
                            <tr style={{ height: headerHeight }}>
                                <th
                                    className="sticky left-0 z-30 bg-[#f3f3f3] border-r border-b border-[#c8c8c8] select-none"
                                    style={{ width: rowHeaderWidth, minWidth: rowHeaderWidth }}
                                >
                                    <span
                                        className="block w-0 h-0 border-l-transparent border-t-slate-400"
                                        style={{
                                            borderLeftWidth: Math.max(3, 7 * viewerZoom),
                                            borderTopWidth: Math.max(3, 7 * viewerZoom),
                                            margin: Math.max(1, 4 * viewerZoom),
                                        }}
                                    />
                                </th>
                                {colLetters.map((letter, col) => {
                                    const selected = selectedCell?.col === col;
                                    return (
                                        <th
                                            key={letter}
                                            className="relative border-r border-b border-[#c8c8c8] text-center text-[12px] font-normal select-none"
                                            style={{
                                                display: hiddenCols[col] ? 'none' : undefined,
                                                height: headerHeight,
                                                fontSize: headerFontSize,
                                                backgroundColor: selected ? '#e2f0e8' : '#f3f3f3',
                                                color: selected ? '#107c41' : '#333333',
                                                borderBottomColor: selected ? '#107c41' : '#c8c8c8',
                                            }}
                                            onDoubleClick={() => autoFitColumn(col)}
                                            title={letter + ' · Doble clic para autoajustar la columna'}
                                        >
                                            {letter}
                                            <button
                                                type="button"
                                                className="group absolute -right-2 top-0 z-30 h-full w-4 cursor-col-resize touch-none focus-visible:outline-none"
                                                style={{ touchAction: 'none' }}
                                                aria-label={`Cambiar ancho de la columna ${letter}`}
                                                title={`Arrastra para cambiar el ancho de ${letter}. Doble clic o doble toque para autoajustar.`}
                                                onPointerDown={event => handleColumnResizeStart(event, col)}
                                                onPointerMove={handleColumnResizeMove}
                                                onPointerUp={event => finishColumnResize(event, true)}
                                                onPointerCancel={event => finishColumnResize(event, false)}
                                                onLostPointerCapture={event => finishColumnResize(event, false)}
                                                onDoubleClick={event => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    autoFitColumn(col);
                                                }}
                                                onKeyDown={event => handleColumnResizeKeyDown(event, col)}
                                            >
                                                <span
                                                    className={`absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 transition-colors ${
                                                        resizingColumn === col
                                                            ? 'bg-[#107c41]'
                                                            : 'bg-transparent group-hover:bg-[#107c41] group-focus-visible:bg-[#107c41]'
                                                    }`}
                                                />
                                            </button>
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
                                                width: rowHeaderWidth,
                                                minWidth: rowHeaderWidth,
                                                fontSize: Math.max(6, 11 * viewerZoom),
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
                                            const spill = textSpillMetrics(
                                                cell,
                                                rowCells,
                                                scaledColWidths,
                                                hiddenCols,
                                            );
                                            const cellStyle: React.CSSProperties = {
                                                display: hiddenCols[col] ? 'none' : undefined,
                                                height: rowHeight,
                                                width: cell.colSpan ? undefined : `var(--excel-col-${col}-width, ${scaledColWidths[col]}px)`,
                                                minWidth: cell.colSpan ? undefined : `var(--excel-col-${col}-width, ${scaledColWidths[col]}px)`,
                                                maxWidth: cell.colSpan ? undefined : `var(--excel-col-${col}-width, ${scaledColWidths[col]}px)`,
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
                                                overflow: spill ? 'visible' : 'hidden',
                                                wordBreak: style?.wrapText ? 'break-word' : undefined,
                                                cursor: cell.formula ? 'crosshair' : 'cell',
                                                boxShadow,
                                                position: 'relative',
                                                zIndex: isSelected ? 4 : spill ? 2 : undefined,
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
                                                    onPointerDown={handleCellPointerDown}
                                                    onPointerUp={event => handleCellPointerUp(event, cell)}
                                                    onPointerCancel={handleCellPointerCancel}
                                                    title={
                                                        cell.formula
                                                            ? cell.addr + ': ' + cell.formula + ' · Doble clic para rastrear'
                                                            : cell.addr + ': ' + (cell.text || '(vacía)') + ' · Doble clic o doble toque para autoajustar la columna'
                                                    }
                                                >
                                                    <span
                                                        className="relative block pointer-events-none"
                                                        style={{
                                                            zIndex: cell.text ? 1 : undefined,
                                                            width: spill
                                                                ? Math.max(1, spill.width - 6 * viewerZoom)
                                                                : style?.wrapText ? 'auto' : 'max-content',
                                                            maxWidth: spill
                                                                ? Math.max(1, spill.width - 6 * viewerZoom)
                                                                : undefined,
                                                            marginLeft: spill?.align === 'right'
                                                                ? -spill.offset
                                                                : (style?.align || (cell.isNum ? 'right' : 'left')) === 'right'
                                                                    ? 'auto'
                                                                    : undefined,
                                                            overflow: spill ? 'hidden' : undefined,
                                                            textAlign: spill?.align,
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

                    {effectiveImages.map(image => (
                        <img
                            key={image.id}
                            src={image.src}
                            alt="Imagen incrustada en la hoja"
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                            className="absolute z-[15] pointer-events-none select-none object-fill"
                            style={{
                                left: rowHeaderWidth + image.left * viewerZoom,
                                top: headerHeight + image.top * viewerZoom,
                                width: image.width * viewerZoom,
                                height: image.height * viewerZoom,
                            }}
                        />
                    ))}
                </div>
            </div>

            <div className="h-10 bg-[#eef3f6] border-t border-[#c8c8c8] flex items-center shrink-0 overflow-hidden">
                <div className="pl-2 pr-1 shrink-0 flex items-center gap-1 text-slate-600">
                    <FileSpreadsheet className="w-4 h-4 text-[#107c41]" />
                    <span className="text-[10px] uppercase font-bold tracking-wider hidden sm:inline">Hojas</span>
                </div>

                <button
                    type="button"
                    onClick={() => scrollSheetTabs(-1)}
                    disabled={sheetNames.length <= 1}
                    className="grid h-8 w-7 shrink-0 place-items-center text-slate-600 hover:bg-white disabled:opacity-30"
                    aria-label="Desplazar hojas hacia la izquierda"
                    title="Hojas anteriores"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => scrollSheetTabs(1)}
                    disabled={sheetNames.length <= 1}
                    className="grid h-8 w-7 shrink-0 place-items-center text-slate-600 hover:bg-white disabled:opacity-30"
                    aria-label="Desplazar hojas hacia la derecha"
                    title="Hojas siguientes"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>

                <label className="relative mr-1 shrink-0" title="Mostrar todas las hojas">
                    <span className="sr-only">Ir a una hoja</span>
                    <select
                        value={activeIdx}
                        onChange={event => selectSheet(Number(event.target.value))}
                        className="h-7 max-w-[112px] rounded border border-[#c8c8c8] bg-white px-1 text-[11px] text-slate-700 outline-none focus:border-[#107c41] sm:max-w-[150px]"
                        aria-label="Seleccionar cualquier hoja del libro"
                    >
                        {sheetNames.map((name, index) => (
                            <option key={name} value={index}>{index + 1}. {name}</option>
                        ))}
                    </select>
                </label>

                <div
                    ref={sheetTabsRef}
                    className="flex items-end overflow-x-auto scrollbar-none flex-1 h-full min-w-0 gap-0"
                >
                    {sheetNames.map((name, index) => {
                        const active = index === activeIdx;
                        return (
                            <button
                                key={name}
                                ref={element => { sheetTabRefs.current[index] = element; }}
                                type="button"
                                onClick={() => selectSheet(index)}
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

                <div className="px-3 shrink-0 text-slate-500 text-[11px] font-mono gap-2 hidden 2xl:flex border-l border-[#d5dadd]">
                    <span className="hidden lg:inline">Arrastra el borde de una columna para ajustar</span>
                    <span className="hidden lg:inline">•</span>
                    <span>{totalRows} filas</span>
                    <span>•</span>
                    <span>{totalCols} columnas</span>
                </div>
            </div>
        </div>
    );
}
