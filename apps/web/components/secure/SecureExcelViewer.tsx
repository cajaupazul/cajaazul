'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Search, FileSpreadsheet, Loader2, AlertCircle, X, ZoomIn, ZoomOut } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface CellStyle {
    bgColor?: string;
    fontColor?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: 'left' | 'center' | 'right';
    borderTop?: string;
    borderBottom?: string;
    borderLeft?: string;
    borderRight?: string;
}

interface ParsedCell {
    addr: string;
    text: string;
    formula?: string;
    isNum: boolean;
    isNegative: boolean;
    isTotalRow: boolean;
    style?: CellStyle;
    colSpan?: number;
    rowSpan?: number;
    skip?: boolean;
}

interface SheetData {
    colLetters: string[];
    colWidths: number[];
    rows: ParsedCell[][];
    totalRows: number;
    totalCols: number;
}

interface SecureExcelViewerProps {
    blob: Blob | null;
    fileName: string;
    zoomLevel?: number;
    userWatermark?: string;
}

// ── Helper: Convert RGB/ARGB hex to CSS ─────────────────────────────────────────
function parseColor(argb?: string): string | undefined {
    if (!argb || typeof argb !== 'string') return undefined;
    const clean = argb.trim();
    const hex = clean.length === 8 ? clean.slice(2) : clean;
    if (hex.length !== 6) return undefined;
    const upper = hex.toUpperCase();
    if (upper === 'FFFFFF' || upper === '000000') return undefined;
    return `#${hex}`;
}

export default function SecureExcelViewer({
    blob,
    fileName,
    zoomLevel = 1,
    userWatermark = 'CampusLink',
}: SecureExcelViewerProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [wb, setWb] = useState<XLSX.WorkBook | null>(null);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [activeIdx, setActiveIdx] = useState(0);
    const [sheetData, setSheetData] = useState<SheetData | null>(null);

    // Selected cell for formula bar
    const [selectedCell, setSelectedCell] = useState<ParsedCell | null>(null);

    // In-sheet search
    const [showSearch, setShowSearch] = useState(false);
    const [searchQ, setSearchQ] = useState('');

    // Virtual scroll for large sheets (> 200 rows)
    const scrollRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [viewHeight, setViewHeight] = useState(600);
    const rafRef = useRef<number | null>(null);

    // ── 1. Parse workbook from blob ──────────────────────────────────────────
    useEffect(() => {
        if (!blob) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        setSheetData(null);

        blob.arrayBuffer()
            .then(buf => {
                if (cancelled) return;
                try {
                    const book = XLSX.read(buf, {
                        type: 'array',
                        cellDates: true,
                        cellStyles: true,
                        cellNF: true,
                    });
                    if (!book.SheetNames || book.SheetNames.length === 0) {
                        throw new Error('El archivo no contiene hojas legibles.');
                    }
                    setWb(book);
                    setSheetNames(book.SheetNames);
                    setActiveIdx(0);
                } catch (e: any) {
                    if (!cancelled) setError(e.message || 'Error al leer el archivo Excel.');
                } finally {
                    if (!cancelled) setLoading(false);
                }
            })
            .catch(e => {
                if (!cancelled) {
                    setError(e.message || 'Error al procesar el archivo.');
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [blob]);

    // ── 2. Parse active sheet data ───────────────────────────────────────────
    useEffect(() => {
        if (!wb || !sheetNames.length) return;

        const sheetName = sheetNames[activeIdx];
        const ws = wb.Sheets[sheetName];
        if (!ws || !ws['!ref']) {
            setSheetData(null);
            return;
        }

        try {
            const range = XLSX.utils.decode_range(ws['!ref']);
            const rStart = range.s.r;
            const rEnd = range.e.r;
            const cStart = range.s.c;
            const cEnd = range.e.c;
            const totalRows = rEnd - rStart + 1;
            const totalCols = cEnd - cStart + 1;

            // Merged cells mapping
            const mergeOrigin = new Map<string, { cs: number; rs: number }>();
            const mergeCovered = new Set<string>();

            const rawMerges = (ws['!merges'] as XLSX.Range[]) || [];
            for (const m of rawMerges) {
                const origin = XLSX.utils.encode_cell(m.s);
                mergeOrigin.set(origin, {
                    cs: m.e.c - m.s.c + 1,
                    rs: m.e.r - m.s.r + 1,
                });
                for (let r = m.s.r; r <= m.e.r; r++) {
                    for (let c = m.s.c; c <= m.e.c; c++) {
                        if (r !== m.s.r || c !== m.s.c) {
                            mergeCovered.add(XLSX.utils.encode_cell({ r, c }));
                        }
                    }
                }
            }

            // Column letters
            const colLetters: string[] = [];
            for (let c = cStart; c <= cEnd; c++) {
                colLetters.push(XLSX.utils.encode_col(c));
            }

            // Parse cells row by row
            const rows: ParsedCell[][] = [];
            const colMaxChars = new Array(totalCols).fill(6);

            for (let r = rStart; r <= rEnd; r++) {
                const rowCells: ParsedCell[] = [];
                let rowIsTotal = false;

                // First pass check if row contains "Total"
                for (let c = cStart; c <= cEnd; c++) {
                    const addr = XLSX.utils.encode_cell({ r, c });
                    const cell = ws[addr];
                    const valStr = cell?.w || (cell?.v !== undefined && cell?.v !== null ? String(cell.v) : '');
                    if (valStr.toLowerCase().trim().startsWith('total')) {
                        rowIsTotal = true;
                        break;
                    }
                }

                for (let c = cStart; c <= cEnd; c++) {
                    const colIndex = c - cStart;
                    const addr = XLSX.utils.encode_cell({ r, c });

                    if (mergeCovered.has(addr)) {
                        rowCells.push({
                            addr,
                            text: '',
                            isNum: false,
                            isNegative: false,
                            isTotalRow: rowIsTotal,
                            skip: true,
                        });
                        continue;
                    }

                    const cell = ws[addr];
                    let text = '';
                    let formula: string | undefined;
                    let isNum = false;
                    let isNegative = false;
                    let style: CellStyle | undefined;

                    if (cell) {
                        if (typeof cell.w === 'string' && cell.w.trim() !== '') {
                            text = cell.w.trim();
                        } else if (cell.v !== undefined && cell.v !== null) {
                            text = cell.v instanceof Date
                                ? cell.v.toLocaleDateString()
                                : String(cell.v).trim();
                        }

                        if (cell.f) formula = `=${cell.f}`;

                        if (typeof cell.v === 'number') {
                            isNum = true;
                            isNegative = cell.v < 0;
                        } else if (text.startsWith('-') && !isNaN(Number(text.replace(/[$, ]/g, '')))) {
                            isNegative = true;
                        }

                        // Style extraction
                        const s = cell.s;
                        if (s) {
                            style = {};
                            const bg = parseColor(s.fgColor?.rgb || s.bgColor?.rgb);
                            if (bg) style.bgColor = bg;

                            const fc = parseColor(s.font?.color?.rgb);
                            if (fc) style.fontColor = fc;

                            if (s.font?.bold) style.bold = true;
                            if (s.font?.italic) style.italic = true;
                            if (s.font?.underline) style.underline = true;

                            if (s.alignment?.horizontal) {
                                style.align = s.alignment.horizontal as any;
                            }
                        }
                    }

                    // Auto bold for section titles / Totales
                    const lowerText = text.toLowerCase();
                    const isTitle = lowerText.startsWith('activo') ||
                                    lowerText.startsWith('pasivo') ||
                                    lowerText.startsWith('patrimonio') ||
                                    lowerText.startsWith('estado') ||
                                    lowerText.startsWith('total') ||
                                    lowerText.startsWith('ingreso') ||
                                    lowerText.startsWith('gasto');

                    if (isTitle || rowIsTotal) {
                        if (!style) style = {};
                        style.bold = true;
                    }

                    // Track maximum character length for column width
                    if (text.length > 0 && !mergeOrigin.has(addr)) {
                        colMaxChars[colIndex] = Math.max(colMaxChars[colIndex], text.length);
                    }

                    const merge = mergeOrigin.get(addr);
                    rowCells.push({
                        addr,
                        text,
                        formula,
                        isNum,
                        isNegative,
                        isTotalRow: rowIsTotal,
                        style,
                        colSpan: merge?.cs,
                        rowSpan: merge?.rs,
                    });
                }

                rows.push(rowCells);
            }

            // Calculate comfortable column widths based on content
            const wsCols = (ws['!cols'] as any[]) || [];
            const colWidths: number[] = [];

            for (let c = 0; c < totalCols; c++) {
                const sheetCol = wsCols[cStart + c];
                const contentWidth = Math.max(100, Math.min(460, colMaxChars[c] * 8.5 + 32));
                const explicitWidth = sheetCol?.wpx ?? (sheetCol?.wch ? Math.round(sheetCol.wch * 8) : undefined);
                colWidths.push(explicitWidth ? Math.max(explicitWidth, contentWidth) : contentWidth);
            }

            setSheetData({
                colLetters,
                colWidths,
                rows,
                totalRows,
                totalCols,
            });

            setSelectedCell(rows[0]?.[0] || null);
            setSearchQ('');

            if (scrollRef.current) {
                scrollRef.current.scrollTop = 0;
                scrollRef.current.scrollLeft = 0;
            }
            setScrollTop(0);
        } catch (err: any) {
            console.error('[SecureExcelViewer] Error parsing sheet:', err);
            setError('Error al procesar la estructura de la hoja.');
        }
    }, [wb, activeIdx, sheetNames]);

    // ── 3. Smooth scroll handling ────────────────────────────────────────────
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const ro = new ResizeObserver(entries => {
            if (entries[0]) setViewHeight(entries[0].contentRect.height);
        });
        ro.observe(el);
        setViewHeight(el.clientHeight || 600);
        return () => ro.disconnect();
    }, []);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const top = e.currentTarget.scrollTop;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            setScrollTop(top);
        });
    }, []);

    // ── 4. Virtualization logic (only for large sheets > 200 rows) ───────────
    const rowH = useMemo(() => Math.max(22, Math.round(24 * zoomLevel)), [zoomLevel]);
    const isLargeSheet = (sheetData?.totalRows || 0) > 200;

    const { visStart, visEnd, topPad, bottomPad } = useMemo(() => {
        if (!sheetData) return { visStart: 0, visEnd: 0, topPad: 0, bottomPad: 0 };
        if (!isLargeSheet) {
            return {
                visStart: 0,
                visEnd: sheetData.totalRows,
                topPad: 0,
                bottomPad: 0,
            };
        }
        const BUFFER = 30;
        const total = sheetData.totalRows;
        const start = Math.max(0, Math.floor(scrollTop / rowH) - BUFFER);
        const end = Math.min(total, Math.ceil((scrollTop + viewHeight) / rowH) + BUFFER);
        return {
            visStart: start,
            visEnd: end,
            topPad: start * rowH,
            bottomPad: (total - end) * rowH,
        };
    }, [scrollTop, viewHeight, rowH, sheetData, isLargeSheet]);

    // ── 5. Search match count ────────────────────────────────────────────────
    const matchCount = useMemo(() => {
        if (!sheetData || !searchQ.trim()) return 0;
        const q = searchQ.toLowerCase();
        return sheetData.rows.reduce(
            (n, row) => n + row.filter(c => !c.skip && c.text.toLowerCase().includes(q)).length,
            0
        );
    }, [sheetData, searchQ]);

    if (loading) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4 shadow-sm">
                    <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                </div>
                <p className="text-sm font-bold text-slate-800">Cargando libro de cálculo...</p>
                <p className="text-xs text-slate-400 mt-1">Renderizando hojas, estilos y fórmulas</p>
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

    const { colLetters, colWidths, rows, totalRows, totalCols } = sheetData;
    const visibleRows = rows.slice(visStart, visEnd);
    const fontSize = Math.max(11, Math.round(12.5 * zoomLevel));
    const headerH = Math.max(24, Math.round(26 * zoomLevel));
    const paddingY = Math.max(3, Math.round(4 * zoomLevel));
    const paddingX = Math.max(6, Math.round(8 * zoomLevel));

    return (
        <div
            className="w-full h-full flex flex-col bg-white overflow-hidden select-none font-sans text-slate-900"
            onContextMenu={e => e.preventDefault()}
        >
            {/* ── Formula Bar ─────────────────────────────────────────────── */}
            <div className="h-10 bg-slate-100 border-b border-slate-300 flex items-center px-3 gap-2 shrink-0 z-30">
                {/* Active cell pill */}
                <div className="min-w-[60px] flex items-center justify-center bg-white border border-slate-300 rounded px-2.5 py-0.5 shadow-sm shrink-0">
                    <span className="text-[11px] font-bold font-mono text-emerald-700">
                        {selectedCell?.addr ?? 'A1'}
                    </span>
                </div>

                {/* Formula / value display */}
                <div className="flex-1 flex items-center bg-white border border-slate-300 rounded px-2.5 py-0.5 shadow-sm gap-2 overflow-hidden min-w-0">
                    <span className="text-[11px] font-mono font-bold text-slate-400 italic shrink-0 select-none">fx</span>
                    <span className="text-xs text-slate-800 font-mono truncate">
                        {selectedCell ? (selectedCell.formula ?? selectedCell.text) : ''}
                    </span>
                </div>

                {/* Search */}
                {showSearch ? (
                    <div className="flex items-center bg-white border border-emerald-500 rounded-lg px-2 py-0.5 gap-1.5 shrink-0 shadow-sm">
                        <Search className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <input
                            type="text"
                            autoFocus
                            value={searchQ}
                            onChange={e => setSearchQ(e.target.value)}
                            placeholder="Buscar en hoja..."
                            className="w-28 sm:w-40 text-xs focus:outline-none bg-transparent text-slate-800"
                        />
                        {searchQ && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded px-1 shrink-0">
                                {matchCount}
                            </span>
                        )}
                        <button
                            onClick={() => {
                                setSearchQ('');
                                setShowSearch(false);
                            }}
                            className="p-0.5 text-slate-400 hover:text-slate-700"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowSearch(true)}
                        className="p-1.5 text-slate-600 hover:bg-slate-200 rounded transition-colors shrink-0"
                        title="Buscar en la hoja"
                    >
                        <Search className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* ── Main Spreadsheet Grid ───────────────────────────────────── */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-auto relative bg-[#f8fafc]"
                onScroll={handleScroll}
                style={{
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehavior: 'contain',
                }}
            >
                {/* Diagonal Anti-Piracy Watermark */}
                <div
                    className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none"
                    aria-hidden="true"
                    style={{ opacity: 0.032 }}
                >
                    {Array.from({ length: 32 }).map((_, i) => (
                        <div
                            key={i}
                            className="inline-block font-black text-slate-900 text-sm tracking-widest whitespace-nowrap m-12"
                            style={{ transform: 'rotate(-25deg)' }}
                        >
                            {userWatermark} • CampusLink Excel
                        </div>
                    ))}
                </div>

                {/* Table */}
                <div className="inline-block min-w-fit align-top relative z-10">
                    <table
                        className="border-collapse bg-white"
                        style={{ fontSize: `${fontSize}px` }}
                    >
                        {/* Header Row (A, B, C...) */}
                        <thead className="sticky top-0 z-20 shadow-sm">
                            <tr style={{ height: headerH }}>
                                {/* Top-left corner */}
                                <th
                                    className="sticky left-0 z-30 bg-[#f1f5f9] border-r border-b border-slate-300 text-center text-[10px] text-slate-400 font-bold select-none"
                                    style={{ width: 48, minWidth: 48 }}
                                >
                                    ◢
                                </th>
                                {colLetters.map((col, ci) => (
                                    <th
                                        key={col}
                                        className="bg-[#f1f5f9] border-r border-b border-slate-300 text-center text-slate-700 font-semibold tracking-tight select-none"
                                        style={{
                                            width: colWidths[ci],
                                            minWidth: colWidths[ci],
                                        }}
                                    >
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {/* Top spacer for large sheets */}
                            {topPad > 0 && (
                                <tr style={{ height: topPad }}>
                                    <td colSpan={totalCols + 1} className="p-0 border-0" />
                                </tr>
                            )}

                            {/* Rows */}
                            {visibleRows.map((rowCells, rIdx) => {
                                const rowNum = visStart + rIdx + 1;
                                return (
                                    <tr key={rowNum} style={{ height: rowH }} className="hover:bg-slate-50/50">
                                        {/* Sticky Row Number (1, 2, 3...) */}
                                        <td
                                            className="sticky left-0 z-10 bg-[#f8fafc] border-r border-b border-slate-200 text-center text-[11px] text-slate-500 font-mono font-medium select-none"
                                            style={{ width: 48, minWidth: 48 }}
                                        >
                                            {rowNum}
                                        </td>

                                        {/* Data Cells */}
                                        {rowCells.map((cell, ci) => {
                                            if (cell.skip) return null;

                                            const isSelected = selectedCell?.addr === cell.addr;
                                            const isMatch = !!searchQ.trim() &&
                                                cell.text.toLowerCase().includes(searchQ.toLowerCase());
                                            const s = cell.style;

                                            // Determine text color:
                                            // 1. Red if negative number (-4,000, etc.)
                                            // 2. Custom fontColor if provided by sheet
                                            // 3. Crisp Slate-900 (#0f172a) by default!
                                            const cellColor = cell.isNegative
                                                ? '#dc2626'
                                                : s?.fontColor || '#0f172a';

                                            // Borders: custom or standard thin grid lines
                                            // If it's a Total row, add top border or double underline
                                            const borderTop = cell.isTotalRow
                                                ? '1.5px solid #0f172a'
                                                : s?.borderTop || '1px solid #e2e8f0';

                                            const borderBottom = cell.isTotalRow
                                                ? '2.5px double #0f172a'
                                                : s?.borderBottom || '1px solid #e2e8f0';

                                            const isBold = s?.bold || cell.isTotalRow;

                                            const tdStyle: React.CSSProperties = {
                                                minWidth: cell.colSpan ? undefined : colWidths[ci],
                                                textAlign: s?.align ?? (cell.isNum ? 'right' : 'left'),
                                                fontWeight: isBold ? 700 : 400,
                                                fontStyle: s?.italic ? 'italic' : undefined,
                                                textDecoration: s?.underline ? 'underline' : undefined,
                                                color: cellColor,
                                                backgroundColor: isSelected
                                                    ? '#dcfce7'
                                                    : isMatch
                                                        ? '#fef08a'
                                                        : s?.bgColor || '#ffffff',
                                                borderTop,
                                                borderBottom,
                                                borderLeft: s?.borderLeft || '1px solid #e2e8f0',
                                                borderRight: s?.borderRight || '1px solid #e2e8f0',
                                                padding: `${paddingY}px ${paddingX}px`,
                                                whiteSpace: 'nowrap',
                                                cursor: 'cell',
                                                outline: isSelected ? '2px solid #16a34a' : undefined,
                                                outlineOffset: isSelected ? '-1px' : undefined,
                                            };

                                            return (
                                                <td
                                                    key={cell.addr}
                                                    colSpan={cell.colSpan}
                                                    rowSpan={cell.rowSpan}
                                                    style={tdStyle}
                                                    onClick={() => setSelectedCell(cell)}
                                                    title={`${cell.addr}: ${cell.text || '(vacía)'}`}
                                                >
                                                    {cell.text || '\u00A0'}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}

                            {/* Bottom spacer for large sheets */}
                            {bottomPad > 0 && (
                                <tr style={{ height: bottomPad }}>
                                    <td colSpan={totalCols + 1} className="p-0 border-0" />
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Bottom Sheet Tabs Bar ───────────────────────────────────── */}
            <div className="h-10 bg-[#1e293b] border-t border-slate-700 flex items-center shrink-0 overflow-hidden shadow-md">
                {/* Icon */}
                <div className="px-3 shrink-0 flex items-center gap-1.5 text-slate-400">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] uppercase font-bold tracking-wider hidden sm:inline">Hojas</span>
                </div>

                {/* Tabs */}
                <div
                    className="flex items-end overflow-x-auto scrollbar-none flex-1 h-full gap-1 pr-2"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                >
                    {sheetNames.map((name, idx) => {
                        const active = idx === activeIdx;
                        return (
                            <button
                                key={name}
                                onClick={() => setActiveIdx(idx)}
                                className={`h-full px-3.5 text-xs font-semibold whitespace-nowrap shrink-0 border-t-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                                    active
                                        ? 'bg-white text-slate-900 border-emerald-500 shadow-sm'
                                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border-transparent'
                                }`}
                            >
                                <span>{name}</span>
                                {active && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Metrics */}
                <div className="px-3 shrink-0 text-slate-400 text-[11px] font-mono gap-2 hidden sm:flex border-l border-slate-700">
                    <span>{totalRows} filas</span>
                    <span>•</span>
                    <span>{totalCols} cols</span>
                </div>
            </div>
        </div>
    );
}
