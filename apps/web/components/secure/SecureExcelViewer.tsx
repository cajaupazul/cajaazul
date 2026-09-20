'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Search, FileSpreadsheet, Loader2, AlertCircle, X } from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────
const ROW_H         = 22;   // estimated row height px
const BUFFER        = 35;   // virtual-scroll buffer rows above & below viewport
const ROW_NUM_W     = 52;   // row-number column width px
const DEFAULT_COL_W = 88;   // fallback column width px

// ── Color Utilities ────────────────────────────────────────────────────────────

/** ARGB/RGB hex string → CSS "#RRGGBB".
 *  Returns undefined for white (skip default background)
 *  or when skipDark=true and color is very dark (skip default text color). */
function argbToCss(argb?: string, skipWhite = true, skipBlack = false): string | undefined {
    if (!argb || argb.length < 6) return undefined;
    // SheetJS can give 6-char RGB or 8-char ARGB
    const rgb = argb.length === 8 ? argb.slice(2) : argb;
    const upper = rgb.toUpperCase();
    if (skipWhite && upper === 'FFFFFF') return undefined;
    if (skipBlack && upper === '000000') return undefined;
    return `#${rgb}`;
}

/** Excel border descriptor → CSS border string */
function borderCss(b?: { style?: string; color?: { rgb?: string } }): string | undefined {
    if (!b?.style || b.style === 'none') return undefined;
    const col = argbToCss(b.color?.rgb, false) ?? '#000000';
    switch (b.style) {
        case 'hair':         return `0.5px solid ${col}`;
        case 'thin':         return `1px solid ${col}`;
        case 'medium':       return `2px solid ${col}`;
        case 'thick':        return `3px solid ${col}`;
        case 'dashed':       return `1px dashed ${col}`;
        case 'mediumDashed': return `2px dashed ${col}`;
        case 'dotted':       return `1px dotted ${col}`;
        case 'double':       return `3px double ${col}`;
        default:             return `1px solid ${col}`;
    }
}

/** SheetJS cell.s → CellStyle object (or undefined if no meaningful style) */
function parseStyle(s: any): CellStyle | undefined {
    if (!s) return undefined;
    const out: CellStyle = {};
    let any = false;

    // Background fill — SheetJS stores solid fill color in fgColor
    const fgRgb = s.fgColor?.rgb ?? s.bgColor?.rgb;
    const bg = argbToCss(fgRgb, true);
    if (bg) { out.bgColor = bg; any = true; }

    // Font
    if (s.font) {
        const fc = argbToCss(s.font.color?.rgb, false, true);
        if (fc) { out.fontColor = fc; any = true; }
        if (s.font.bold)      { out.bold      = true; any = true; }
        if (s.font.italic)    { out.italic    = true; any = true; }
        if (s.font.underline) { out.underline = true; any = true; }
    }

    // Text alignment
    const h = s.alignment?.horizontal;
    if (h === 'center' || h === 'right' || h === 'left') { out.align = h; any = true; }

    // Borders
    if (s.border) {
        const t = borderCss(s.border.top);
        const b = borderCss(s.border.bottom);
        const l = borderCss(s.border.left);
        const r = borderCss(s.border.right);
        if (t) { out.borderTop    = t; any = true; }
        if (b) { out.borderBottom = b; any = true; }
        if (l) { out.borderLeft   = l; any = true; }
        if (r) { out.borderRight  = r; any = true; }
    }

    return any ? out : undefined;
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface CellStyle {
    bgColor?: string;
    fontColor?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: string;
    borderTop?: string;
    borderBottom?: string;
    borderLeft?: string;
    borderRight?: string;
}

interface ParsedCell {
    addr:     string;
    text:     string;       // display string
    formula?: string;       // formula string for formula bar
    isNum:    boolean;      // numeric → right-align by default
    style?:   CellStyle;
    colSpan?: number;
    rowSpan?: number;
    skip?:    boolean;      // covered by a merge → don't render a <td>
}

interface SheetData {
    colLetters: string[];   // A, B, C…
    colWidths:  number[];   // px per column
    rows:       ParsedCell[][];
    totalRows:  number;
    totalCols:  number;
}

interface SecureExcelViewerProps {
    blob:           Blob | null;
    fileName:       string;
    zoomLevel?:     number;
    userWatermark?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function SecureExcelViewer({
    blob,
    fileName,
    zoomLevel    = 1,
    userWatermark = 'CampusLink',
}: SecureExcelViewerProps) {
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState<string | null>(null);
    const [wb,         setWb]         = useState<XLSX.WorkBook | null>(null);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [activeIdx,  setActiveIdx]  = useState(0);
    const [sheetData,  setSheetData]  = useState<SheetData | null>(null);

    // Formula bar / selected cell
    const [selectedCell, setSelectedCell] = useState<ParsedCell | null>(null);

    // In-sheet search
    const [showSearch, setShowSearch] = useState(false);
    const [searchQ,    setSearchQ]    = useState('');

    // Virtual scroll state
    const scrollRef    = useRef<HTMLDivElement>(null);
    const [scrollTop,  setScrollTop]  = useState(0);
    const [viewHeight, setViewHeight] = useState(600);

    // ── 1. Parse workbook from blob ──────────────────────────────────────────
    useEffect(() => {
        if (!blob) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        setSheetData(null);

        blob.arrayBuffer().then(buf => {
            if (cancelled) return;
            try {
                const book = XLSX.read(buf, {
                    type:       'array',
                    cellDates:  true,
                    cellStyles: true,
                    cellNF:     true,
                });
                if (!book.SheetNames?.length) throw new Error('El archivo no contiene hojas.');
                setWb(book);
                setSheetNames(book.SheetNames);
                setActiveIdx(0);
            } catch (e: any) {
                if (!cancelled) setError(e.message || 'Error al leer el archivo.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }).catch(e => {
            if (!cancelled) { setError(e.message); setLoading(false); }
        });

        return () => { cancelled = true; };
    }, [blob]);

    // ── 2. Parse active sheet ────────────────────────────────────────────────
    useEffect(() => {
        if (!wb || !sheetNames.length) return;

        const ws = wb.Sheets[sheetNames[activeIdx]];
        if (!ws || !ws['!ref']) { setSheetData(null); return; }

        const range    = XLSX.utils.decode_range(ws['!ref']);
        const rStart   = range.s.r, rEnd = range.e.r;
        const cStart   = range.s.c, cEnd = range.e.c;
        const totalRows = rEnd - rStart + 1;
        const totalCols = cEnd - cStart + 1;

        // ── Column headers & widths ─────────────────────────────────────────
        const colLetters: string[] = [];
        const colWidths:  number[] = [];
        const wsCols = (ws['!cols'] as any[]) || [];

        for (let c = cStart; c <= cEnd; c++) {
            colLetters.push(XLSX.utils.encode_col(c));
            const ci = wsCols[c];
            // wpx = explicit pixel width, wch = character width (≈7px/char)
            const w = ci?.wpx ?? (ci?.wch ? Math.round(ci.wch * 7) : DEFAULT_COL_W);
            colWidths.push(Math.max(w, 42));
        }

        // ── Merge maps ──────────────────────────────────────────────────────
        // mergeOrigin: address of top-left cell → { colSpan, rowSpan }
        // mergeCovered: addresses of cells *covered* by a merge (don't render)
        const mergeOrigin  = new Map<string, { cs: number; rs: number }>();
        const mergeCovered = new Set<string>();

        for (const m of ((ws['!merges'] as XLSX.Range[]) || [])) {
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

        // ── Parse all rows ──────────────────────────────────────────────────
        const rows: ParsedCell[][] = [];

        for (let r = rStart; r <= rEnd; r++) {
            const rowCells: ParsedCell[] = [];

            for (let c = cStart; c <= cEnd; c++) {
                const addr = XLSX.utils.encode_cell({ r, c });

                // Covered by a merge → placeholder (renders nothing)
                if (mergeCovered.has(addr)) {
                    rowCells.push({ addr, text: '', isNum: false, skip: true });
                    continue;
                }

                const cell = ws[addr];
                let text   = '';
                let formula: string | undefined;
                let isNum  = false;
                let style: CellStyle | undefined;

                if (cell) {
                    // Value resolution: formatted > raw > date
                    if (typeof cell.w === 'string' && cell.w !== '') {
                        text = cell.w;
                    } else if (cell.v !== undefined && cell.v !== null) {
                        text = cell.v instanceof Date
                            ? cell.v.toLocaleDateString()
                            : String(cell.v);
                    }
                    if (cell.f) formula = `=${cell.f}`;
                    isNum = typeof cell.v === 'number';
                    style = parseStyle(cell.s);
                }

                const merge = mergeOrigin.get(addr);
                rowCells.push({
                    addr, text, formula, isNum, style,
                    colSpan: merge?.cs,
                    rowSpan: merge?.rs,
                });
            }

            rows.push(rowCells);
        }

        setSheetData({ colLetters, colWidths, rows, totalRows, totalCols });
        setSelectedCell(null);
        setSearchQ('');

        // Reset scroll position
        if (scrollRef.current) {
            scrollRef.current.scrollTop  = 0;
            scrollRef.current.scrollLeft = 0;
        }
        setScrollTop(0);
    }, [wb, activeIdx, sheetNames]);

    // ── 3. Measure container height for virtual scroll ───────────────────────
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const ro = new ResizeObserver(entries => {
            setViewHeight(entries[0].contentRect.height);
        });
        ro.observe(el);
        setViewHeight(el.clientHeight);
        return () => ro.disconnect();
    }, []);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    // ── 4. Virtual window computation ────────────────────────────────────────
    const rowH = useMemo(() => Math.round(ROW_H * zoomLevel), [zoomLevel]);

    const { visStart, visEnd, topPad, bottomPad } = useMemo(() => {
        if (!sheetData) return { visStart: 0, visEnd: 0, topPad: 0, bottomPad: 0 };
        const total = sheetData.totalRows;
        const start = Math.max(0, Math.floor(scrollTop / rowH) - BUFFER);
        const end   = Math.min(total, Math.ceil((scrollTop + viewHeight) / rowH) + BUFFER);
        return {
            visStart:   start,
            visEnd:     end,
            topPad:     start * rowH,
            bottomPad:  (total - end) * rowH,
        };
    }, [scrollTop, viewHeight, rowH, sheetData]);

    // ── 5. Search match count ────────────────────────────────────────────────
    const matchCount = useMemo(() => {
        if (!sheetData || !searchQ.trim()) return 0;
        const q = searchQ.toLowerCase();
        return sheetData.rows.reduce(
            (n, row) => n + row.filter(c => !c.skip && c.text.toLowerCase().includes(q)).length,
            0,
        );
    }, [sheetData, searchQ]);

    // ── Render ────────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4 shadow-sm">
                <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
            </div>
            <p className="text-sm font-bold text-slate-800">Procesando libro de cálculo...</p>
            <p className="text-xs text-slate-400 mt-1">Cargando hojas, fórmulas y estilos</p>
        </div>
    );

    if (error) return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
            <h3 className="text-base font-bold text-slate-800 mb-1">No se pudo visualizar</h3>
            <p className="text-xs text-slate-500 max-w-sm">{error}</p>
        </div>
    );

    if (!sheetData) return (
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
            <FileSpreadsheet className="w-12 h-12 mb-2 opacity-30" />
            <p className="text-sm font-medium">Hoja vacía</p>
        </div>
    );

    const { colLetters, colWidths, rows, totalRows, totalCols } = sheetData;
    const visibleRows = rows.slice(visStart, visEnd);
    const fontSize    = Math.round(12 * zoomLevel);
    const headerH     = Math.round(24 * zoomLevel);
    const paddingY    = Math.max(2, Math.round(3 * zoomLevel));
    const paddingX    = Math.max(4, Math.round(6 * zoomLevel));

    return (
        <div
            className="w-full h-full flex flex-col bg-white overflow-hidden select-none font-sans"
            onContextMenu={e => e.preventDefault()}
        >
            {/* ── Formula Bar ──────────────────────────────────── */}
            <div className="h-10 bg-slate-100/90 border-b border-slate-300 flex items-center px-3 gap-2 shrink-0">
                {/* Cell address box */}
                <div className="min-w-[58px] flex items-center justify-center bg-white border border-slate-300 rounded px-2 py-0.5 shadow-sm shrink-0">
                    <span className="text-[11px] font-bold font-mono text-emerald-700">
                        {selectedCell?.addr ?? 'A1'}
                    </span>
                </div>

                {/* Formula / value preview */}
                <div className="flex-1 flex items-center bg-white border border-slate-300 rounded px-2.5 py-0.5 shadow-sm gap-2 overflow-hidden min-w-0">
                    <span className="text-[10px] font-mono font-bold text-slate-400 italic shrink-0">fx</span>
                    <span className="text-xs text-slate-700 font-mono truncate">
                        {selectedCell ? (selectedCell.formula ?? selectedCell.text) : ''}
                    </span>
                </div>

                {/* Search */}
                {showSearch ? (
                    <div className="flex items-center bg-white border border-emerald-500 rounded-lg px-2 py-0.5 gap-1.5 shrink-0">
                        <Search className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <input
                            type="text"
                            autoFocus
                            value={searchQ}
                            onChange={e => setSearchQ(e.target.value)}
                            placeholder="Buscar en hoja..."
                            className="w-28 sm:w-36 text-xs focus:outline-none bg-transparent"
                        />
                        {searchQ && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded px-1 shrink-0">
                                {matchCount}
                            </span>
                        )}
                        <button onClick={() => { setSearchQ(''); setShowSearch(false); }}>
                            <X className="w-3 h-3 text-slate-400 hover:text-slate-700" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowSearch(true)}
                        className="p-1.5 text-slate-500 hover:bg-slate-200 rounded transition-colors shrink-0"
                        title="Buscar en la hoja"
                    >
                        <Search className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* ── Spreadsheet Grid (virtualized) ───────────────── */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-auto relative bg-[#f8fafc]"
                onScroll={handleScroll}
                style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
            >
                {/* Anti-piracy watermark */}
                <div
                    className="absolute inset-0 pointer-events-none z-10 overflow-hidden select-none"
                    aria-hidden="true"
                    style={{ opacity: 0.028 }}
                >
                    {Array.from({ length: 32 }).map((_, i) => (
                        <div
                            key={i}
                            className="inline-block font-black text-slate-900 text-sm tracking-widest whitespace-nowrap m-10"
                            style={{ transform: 'rotate(-25deg)' }}
                        >
                            {userWatermark} • CampusLink Excel
                        </div>
                    ))}
                </div>

                {/* The table itself */}
                <div className="inline-block min-w-fit align-top">
                    <table
                        className="border-collapse table-fixed"
                        style={{ fontSize: `${fontSize}px` }}
                    >
                        {/* ── Sticky Column Header Row (A, B, C…) ─── */}
                        <thead className="sticky top-0 z-20 shadow-sm">
                            <tr style={{ height: headerH }}>
                                {/* Corner cell */}
                                <th
                                    className="sticky left-0 z-30 bg-[#f1f5f9] border-r border-b border-slate-300 text-center text-[10px] text-slate-400 font-bold"
                                    style={{ width: ROW_NUM_W, minWidth: ROW_NUM_W }}
                                >
                                    ◢
                                </th>
                                {colLetters.map((col, ci) => (
                                    <th
                                        key={col}
                                        className="bg-[#f1f5f9] border-r border-b border-slate-300 text-center text-slate-600 font-semibold tracking-tight"
                                        style={{ width: colWidths[ci], minWidth: colWidths[ci] }}
                                    >
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {/* Top virtual spacer */}
                            {topPad > 0 && (
                                <tr style={{ height: topPad }}>
                                    <td colSpan={totalCols + 1} className="p-0 border-0" />
                                </tr>
                            )}

                            {/* ── Visible Rows ─── */}
                            {visibleRows.map((rowCells, rIdx) => {
                                const rowNum = visStart + rIdx + 1;
                                return (
                                    <tr key={rowNum} style={{ height: rowH }}>
                                        {/* Sticky row number */}
                                        <td
                                            className="sticky left-0 z-10 bg-[#f8fafc] border-r border-b border-slate-200 text-center text-[11px] text-slate-400 font-mono"
                                            style={{ width: ROW_NUM_W, minWidth: ROW_NUM_W }}
                                        >
                                            {rowNum}
                                        </td>

                                        {/* Data cells */}
                                        {rowCells.map((cell, ci) => {
                                            // Cells covered by a merge are skipped — the origin
                                            // cell with colSpan/rowSpan fills the space.
                                            if (cell.skip) return null;

                                            const isSelected = selectedCell?.addr === cell.addr;
                                            const isMatch    = !!searchQ.trim() &&
                                                cell.text.toLowerCase().includes(searchQ.toLowerCase());
                                            const s          = cell.style;

                                            const tdStyle: React.CSSProperties = {
                                                width:           colWidths[ci],
                                                minWidth:        colWidths[ci],
                                                maxWidth:        cell.colSpan ? undefined : colWidths[ci],
                                                // Alignment: explicit > numeric default > text default
                                                textAlign:       (s?.align as React.CSSProperties['textAlign'])
                                                                    ?? (cell.isNum ? 'right' : 'left'),
                                                fontWeight:      s?.bold      ? 'bold'      : undefined,
                                                fontStyle:       s?.italic    ? 'italic'    : undefined,
                                                textDecoration:  s?.underline ? 'underline' : undefined,
                                                color:           s?.fontColor,
                                                // Selected > search match > style bg > default white
                                                backgroundColor: isSelected
                                                    ? '#d1fae5'
                                                    : isMatch
                                                        ? '#fef08a'
                                                        : s?.bgColor ?? '#ffffff',
                                                // Borders: style from file, or thin grid line
                                                borderTop:    s?.borderTop    ?? '1px solid #e2e8f0',
                                                borderBottom: s?.borderBottom ?? '1px solid #e2e8f0',
                                                borderLeft:   s?.borderLeft   ?? '1px solid #e2e8f0',
                                                borderRight:  s?.borderRight  ?? '1px solid #e2e8f0',
                                                padding:         `${paddingY}px ${paddingX}px`,
                                                overflow:        'hidden',
                                                whiteSpace:      'nowrap',
                                                textOverflow:    'ellipsis',
                                                cursor:          'cell',
                                                // Selected cell ring
                                                outline:       isSelected ? '2px solid #10b981' : undefined,
                                                outlineOffset: isSelected ? '-1px'              : undefined,
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

                            {/* Bottom virtual spacer */}
                            {bottomPad > 0 && (
                                <tr style={{ height: bottomPad }}>
                                    <td colSpan={totalCols + 1} className="p-0 border-0" />
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Sheet Tabs Bar ────────────────────────────────── */}
            <div className="h-10 bg-[#1e293b] border-t border-slate-700 flex items-center shrink-0 overflow-hidden">
                {/* Icon */}
                <div className="px-3 shrink-0">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                </div>

                {/* Tab buttons */}
                <div className="flex items-end overflow-x-auto scrollbar-none flex-1 h-full gap-1 pr-2"
                     style={{ WebkitOverflowScrolling: 'touch' }}>
                    {sheetNames.map((name, idx) => {
                        const active = idx === activeIdx;
                        return (
                            <button
                                key={name}
                                onClick={() => setActiveIdx(idx)}
                                className={`h-full px-3.5 text-xs font-semibold whitespace-nowrap shrink-0 border-t-2 transition-all flex items-center gap-1.5 ${
                                    active
                                        ? 'bg-white text-slate-900 border-emerald-500 shadow-sm'
                                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border-transparent'
                                }`}
                            >
                                {name}
                                {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                            </button>
                        );
                    })}
                </div>

                {/* Stats */}
                <div className="px-3 shrink-0 text-slate-500 text-[11px] font-mono gap-2 hidden sm:flex">
                    <span>{totalRows} filas</span>
                    <span>•</span>
                    <span>{totalCols} cols</span>
                </div>
            </div>
        </div>
    );
}
