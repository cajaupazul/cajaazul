'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { 
    Table, 
    Search, 
    ChevronLeft, 
    ChevronRight, 
    FileSpreadsheet, 
    Loader2, 
    AlertCircle, 
    Layers, 
    X,
    Maximize2,
    ZoomIn,
    ZoomOut
} from 'lucide-react';

interface CellData {
    address: string;
    value: any;
    formatted: string;
    formula?: string;
    isNumber: boolean;
}

interface SecureExcelViewerProps {
    blob: Blob | null;
    fileName: string;
    zoomLevel?: number;
    userWatermark?: string;
}

export default function SecureExcelViewer({
    blob,
    fileName,
    zoomLevel = 1,
    userWatermark = 'CampusLink'
}: SecureExcelViewerProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [activeSheetIndex, setActiveSheetIndex] = useState(0);

    // Sheet grid state
    const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
    const [rows, setRows] = useState<CellData[][]>([]);
    const [totalRows, setTotalRows] = useState(0);
    const [totalCols, setTotalCols] = useState(0);
    const [visibleRowCount, setVisibleRowCount] = useState(150);

    // Interactive state
    const [selectedCell, setSelectedCell] = useState<CellData | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearchBar, setShowSearchBar] = useState(false);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const tabsContainerRef = useRef<HTMLDivElement>(null);

    // 1. Parse Workbook from Blob
    useEffect(() => {
        let isCancelled = false;

        async function parseWorkbook() {
            if (!blob) return;
            setLoading(true);
            setError(null);
            try {
                const arrayBuffer = await blob.arrayBuffer();
                const wb = XLSX.read(arrayBuffer, { 
                    type: 'array', 
                    cellDates: true, 
                    cellStyles: true 
                });

                if (isCancelled) return;

                if (!wb.SheetNames || wb.SheetNames.length === 0) {
                    throw new Error('El archivo de cálculo no contiene ninguna hoja válida.');
                }

                setWorkbook(wb);
                setSheetNames(wb.SheetNames);
                setActiveSheetIndex(0);
            } catch (err: any) {
                if (!isCancelled) {
                    console.error('[SecureExcelViewer] Error parsing workbook:', err);
                    setError(err.message || 'No se pudo leer el archivo Excel.');
                }
            } finally {
                if (!isCancelled) setLoading(false);
            }
        }

        parseWorkbook();

        return () => {
            isCancelled = true;
        };
    }, [blob]);

    // 2. Parse Active Sheet Data
    useEffect(() => {
        if (!workbook || sheetNames.length === 0) return;

        const sheetName = sheetNames[activeSheetIndex];
        const worksheet = workbook.Sheets[sheetName];

        if (!worksheet || !worksheet['!ref']) {
            setColumnHeaders([]);
            setRows([]);
            setTotalRows(0);
            setTotalCols(0);
            setSelectedCell(null);
            return;
        }

        try {
            const range = XLSX.utils.decode_range(worksheet['!ref']);
            const startRow = range.s.r;
            const endRow = range.e.r;
            const startCol = range.s.c;
            const endCol = range.e.c;

            const cols: string[] = [];
            for (let c = startCol; c <= endCol; c++) {
                cols.push(XLSX.utils.encode_col(c));
            }
            setColumnHeaders(cols);

            const parsedRows: CellData[][] = [];
            // Cap at 1000 rows initially for performance, with lazy display
            const rowCount = endRow - startRow + 1;
            const colCount = endCol - startCol + 1;

            setTotalRows(rowCount);
            setTotalCols(colCount);
            setVisibleRowCount(Math.min(150, rowCount));

            for (let r = startRow; r <= endRow; r++) {
                const rowCells: CellData[] = [];
                for (let c = startCol; c <= endCol; c++) {
                    const address = XLSX.utils.encode_cell({ r, c });
                    const cell = worksheet[address];
                    let formatted = '';
                    let val = null;
                    let formula: string | undefined = undefined;
                    let isNum = false;

                    if (cell) {
                        val = cell.v;
                        if (cell.w !== undefined) {
                            formatted = cell.w;
                        } else if (val instanceof Date) {
                            formatted = val.toLocaleDateString();
                        } else if (val !== null && val !== undefined) {
                            formatted = String(val);
                        }
                        if (cell.f) formula = `=${cell.f}`;
                        isNum = typeof val === 'number';
                    }

                    rowCells.push({
                        address,
                        value: val,
                        formatted,
                        formula,
                        isNumber: isNum
                    });
                }
                parsedRows.push(rowCells);
            }

            setRows(parsedRows);
            setSelectedCell(parsedRows[0]?.[0] || null);

            // Scroll to top
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = 0;
                scrollContainerRef.current.scrollLeft = 0;
            }
        } catch (err: any) {
            console.error('[SecureExcelViewer] Error loading sheet:', err);
        }
    }, [workbook, activeSheetIndex, sheetNames]);

    // Handle lazy load more rows
    const handleLoadMoreRows = () => {
        setVisibleRowCount(prev => Math.min(prev + 100, totalRows));
    };

    // Filter / search match count
    const searchMatches = useMemo(() => {
        if (!searchQuery.trim()) return 0;
        const q = searchQuery.toLowerCase();
        let matches = 0;
        for (const row of rows) {
            for (const cell of row) {
                if (cell.formatted && cell.formatted.toLowerCase().includes(q)) {
                    matches++;
                }
            }
        }
        return matches;
    }, [searchQuery, rows]);

    // Dynamic zoom calculations
    const fontSize = useMemo(() => Math.round(12 * zoomLevel), [zoomLevel]);
    const cellPaddingY = useMemo(() => Math.max(4, Math.round(6 * zoomLevel)), [zoomLevel]);
    const cellPaddingX = useMemo(() => Math.max(6, Math.round(10 * zoomLevel)), [zoomLevel]);
    const headerHeight = useMemo(() => Math.max(26, Math.round(28 * zoomLevel)), [zoomLevel]);

    if (loading) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 p-8">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4 shadow-sm">
                    <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                </div>
                <p className="text-sm font-bold text-slate-800 tracking-tight">Procesando libro de cálculo...</p>
                <p className="text-xs text-slate-400 mt-1 font-medium">Cargando hojas y fórmulas</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
                <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
                <h3 className="text-base font-bold text-slate-800 mb-1">No se pudo visualizar la hoja</h3>
                <p className="text-xs text-slate-500 max-w-sm mb-4">{error}</p>
            </div>
        );
    }

    const visibleRows = rows.slice(0, visibleRowCount);

    return (
        <div 
            className="w-full h-full flex flex-col bg-white overflow-hidden select-none relative font-sans"
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* ── Top Bar: Formula Bar & Quick Search ────────────────────────────── */}
            <div className="h-11 bg-slate-100/90 border-b border-slate-300 flex items-center px-3 gap-2 shrink-0 z-30">
                {/* Active Cell Address Pill */}
                <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded px-2.5 py-1 shadow-sm shrink-0 min-w-[65px] justify-center">
                    <span className="text-[11px] font-bold font-mono text-emerald-700">
                        {selectedCell ? selectedCell.address : 'A1'}
                    </span>
                </div>

                {/* Formula Bar / Cell Value Preview */}
                <div className="flex-1 flex items-center bg-white border border-slate-300 rounded px-2.5 py-1 shadow-sm overflow-hidden gap-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400 italic select-none">fx</span>
                    <input 
                        type="text"
                        readOnly
                        value={selectedCell ? (selectedCell.formula || selectedCell.formatted) : ''}
                        placeholder="Contenido de la celda"
                        className="w-full bg-transparent text-xs text-slate-700 font-mono focus:outline-none truncate"
                    />
                </div>

                {/* Search Toggle */}
                <div className="flex items-center gap-1 shrink-0">
                    {showSearchBar ? (
                        <div className="flex items-center bg-white border border-emerald-500 rounded-lg px-2 py-0.5 shadow-sm gap-1.5 animate-in fade-in duration-200">
                            <Search className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <input 
                                type="text"
                                autoFocus
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar en hoja..."
                                className="w-28 sm:w-44 text-xs text-slate-800 focus:outline-none"
                            />
                            {searchQuery && (
                                <span className="text-[10px] font-bold text-emerald-700 px-1 bg-emerald-50 rounded">
                                    {searchMatches}
                                </span>
                            )}
                            <button 
                                onClick={() => { setSearchQuery(''); setShowSearchBar(false); }}
                                className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setShowSearchBar(true)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 rounded transition-colors"
                            title="Buscar texto en la hoja"
                        >
                            <Search className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Main Spreadsheet Grid Container ─────────────────────────────────── */}
            <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-auto relative bg-[#f8fafc] scroll-smooth"
                style={{ 
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehavior: 'contain'
                }}
            >
                {/* Diagonal Anti-Piracy Watermark Overlay */}
                <div 
                    className="absolute inset-0 pointer-events-none z-10 flex flex-wrap gap-24 p-12 overflow-hidden opacity-[0.035] select-none"
                    aria-hidden="true"
                >
                    {Array.from({ length: 48 }).map((_, i) => (
                        <div 
                            key={i} 
                            className="transform -rotate-25 text-slate-900 font-black text-sm tracking-widest whitespace-nowrap"
                        >
                            {userWatermark} • CampusLink Excel
                        </div>
                    ))}
                </div>

                {rows.length === 0 ? (
                    <div className="w-full h-64 flex flex-col items-center justify-center text-slate-400">
                        <FileSpreadsheet className="w-12 h-12 mb-2 opacity-30" />
                        <p className="text-sm font-medium">Esta hoja de cálculo está vacía</p>
                    </div>
                ) : (
                    <div className="min-w-fit inline-block align-top">
                        <table className="border-collapse bg-white table-fixed" style={{ fontSize: `${fontSize}px` }}>
                            {/* Sticky Column Headers (A, B, C...) */}
                            <thead className="sticky top-0 z-20 shadow-sm">
                                <tr style={{ height: `${headerHeight}px` }}>
                                    {/* Top-Left Corner Cell (Row / Col intersection) */}
                                    <th className="sticky left-0 z-30 bg-[#f1f5f9] border-r border-b border-slate-300 w-12 min-w-[48px] max-w-[48px] p-0 text-center font-bold text-[10px] text-slate-400 select-none">
                                        ◢
                                    </th>
                                    {columnHeaders.map((col) => (
                                        <th 
                                            key={col}
                                            className="bg-[#f8fafc] border-r border-b border-slate-300 px-3 py-1 font-semibold text-slate-600 text-center tracking-tight select-none min-w-[95px]"
                                            style={{ height: `${headerHeight}px` }}
                                        >
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            {/* Rows Body */}
                            <tbody>
                                {visibleRows.map((rowCells, rIdx) => {
                                    const rowNumber = rIdx + 1;
                                    return (
                                        <tr key={rowNumber} className="hover:bg-slate-50/60 transition-colors">
                                            {/* Sticky Row Number (1, 2, 3...) */}
                                            <td 
                                                className="sticky left-0 z-10 bg-[#f8fafc] border-r border-b border-slate-300 w-12 min-w-[48px] max-w-[48px] text-center font-mono font-medium text-[11px] text-slate-500 select-none"
                                                style={{
                                                    paddingTop: `${cellPaddingY}px`,
                                                    paddingBottom: `${cellPaddingY}px`
                                                }}
                                            >
                                                {rowNumber}
                                            </td>

                                            {/* Data Cells */}
                                            {rowCells.map((cell) => {
                                                const isSelected = selectedCell?.address === cell.address;
                                                const isSearchMatch = searchQuery.trim().length > 0 && 
                                                    cell.formatted.toLowerCase().includes(searchQuery.toLowerCase());

                                                return (
                                                    <td
                                                        key={cell.address}
                                                        onClick={() => setSelectedCell(cell)}
                                                        className={`border-r border-b border-slate-200 transition-all cursor-cell truncate max-w-[280px] ${
                                                            isSelected 
                                                                ? 'outline outline-2 outline-emerald-600 bg-emerald-50/40 z-10 shadow-sm' 
                                                                : isSearchMatch 
                                                                    ? 'bg-amber-100 text-amber-950 font-bold border-amber-300' 
                                                                    : 'bg-white text-slate-800'
                                                        } ${cell.isNumber ? 'text-right font-mono' : 'text-left'}`}
                                                        style={{
                                                            paddingTop: `${cellPaddingY}px`,
                                                            paddingBottom: `${cellPaddingY}px`,
                                                            paddingLeft: `${cellPaddingX}px`,
                                                            paddingRight: `${cellPaddingX}px`
                                                        }}
                                                        title={`${cell.address}: ${cell.formatted || '(vacía)'}`}
                                                    >
                                                        {cell.formatted || '\u00A0'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Lazy Load Indicator / Button if Sheet has many rows */}
                        {visibleRowCount < totalRows && (
                            <div className="p-4 flex items-center justify-center bg-slate-50 border-t border-slate-200">
                                <button
                                    onClick={handleLoadMoreRows}
                                    className="px-4 py-2 bg-white border border-slate-300 hover:border-emerald-500 text-slate-700 hover:text-emerald-700 text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                                >
                                    <ChevronRight className="w-4 h-4 rotate-90" />
                                    Cargar más filas ({visibleRowCount} de {totalRows})
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Bottom Sheet Tabs Bar (Classic Excel Style) ────────────────────── */}
            <div className="h-11 bg-[#1e293b] border-t border-slate-700 flex items-center px-2 shrink-0 z-30 shadow-lg justify-between overflow-hidden">
                {/* Sheet Tabs Scroll Container */}
                <div 
                    ref={tabsContainerRef}
                    className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1 flex-1 pr-2"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                >
                    <div className="flex items-center gap-1.5 px-2 text-slate-400 shrink-0">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] uppercase font-bold tracking-wider hidden sm:inline">Hojas</span>
                    </div>

                    {sheetNames.map((name, idx) => {
                        const isActive = idx === activeSheetIndex;
                        return (
                            <button
                                key={name}
                                onClick={() => setActiveSheetIndex(idx)}
                                className={`px-3 py-1.5 rounded-t text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer shrink-0 border-t-2 ${
                                    isActive
                                        ? 'bg-white text-slate-900 border-emerald-500 shadow-md'
                                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-white border-transparent'
                                }`}
                            >
                                <span>{name}</span>
                                {isActive && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Sheet Metrics Badge */}
                <div className="flex items-center gap-3 shrink-0 pl-2 border-l border-slate-700 text-slate-400 text-[11px] font-mono hidden sm:flex">
                    <span>{totalRows} filas</span>
                    <span>•</span>
                    <span>{totalCols} cols</span>
                </div>
            </div>
        </div>
    );
}
