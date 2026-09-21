import type { Border, Color } from 'exceljs';

type ExcelColor = Partial<Color> & { indexed?: number; tint?: number };

export interface FormulaReference {
    id: string;
    label: string;
    sheetName: string;
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
    color: string;
    tint: string;
}

export const FORMULA_TRACE_COLORS = [
    { color: '#2563eb', tint: 'rgba(37, 99, 235, 0.12)' },
    { color: '#dc2626', tint: 'rgba(220, 38, 38, 0.10)' },
    { color: '#9333ea', tint: 'rgba(147, 51, 234, 0.10)' },
    { color: '#ea580c', tint: 'rgba(234, 88, 12, 0.11)' },
    { color: '#0891b2', tint: 'rgba(8, 145, 178, 0.11)' },
    { color: '#ca8a04', tint: 'rgba(202, 138, 4, 0.12)' },
] as const;

const OFFICE_THEME = [
    '#000000',
    '#ffffff',
    '#1f497d',
    '#eeece1',
    '#4f81bd',
    '#c0504d',
    '#9bbb59',
    '#8064a2',
    '#4bacc6',
    '#f79646',
    '#0000ff',
    '#800080',
];

const INDEXED_COLORS: Record<number, string> = {
    0: '#000000', 1: '#ffffff', 2: '#ff0000', 3: '#00ff00',
    4: '#0000ff', 5: '#ffff00', 6: '#ff00ff', 7: '#00ffff',
    8: '#000000', 9: '#ffffff', 10: '#ff0000', 11: '#00ff00',
    12: '#0000ff', 13: '#ffff00', 14: '#ff00ff', 15: '#00ffff',
    16: '#800000', 17: '#008000', 18: '#000080', 19: '#808000',
    20: '#800080', 21: '#008080', 22: '#c0c0c0', 23: '#808080',
};

function normalizeHex(value: string): string | undefined {
    const clean = value.replace(/^#/, '').trim();
    const rgb = clean.length === 8 ? clean.slice(2) : clean;
    return /^[0-9a-f]{6}$/i.test(rgb) ? `#${rgb.toLowerCase()}` : undefined;
}

function applyTint(hex: string, tint = 0): string {
    if (!tint) return hex;
    const raw = hex.slice(1);
    const channels = [0, 2, 4].map(offset => parseInt(raw.slice(offset, offset + 2), 16));
    const adjusted = channels.map(channel => {
        const next = tint < 0
            ? channel * (1 + tint)
            : channel + (255 - channel) * tint;
        return Math.max(0, Math.min(255, Math.round(next)));
    });
    return `#${adjusted.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

export function excelColorToCss(color?: ExcelColor): string | undefined {
    if (!color) return undefined;
    let resolved: string | undefined;

    if (color.argb) resolved = normalizeHex(color.argb);
    if (!resolved && typeof color.theme === 'number') resolved = OFFICE_THEME[color.theme];
    if (!resolved && typeof color.indexed === 'number' && color.indexed !== 64) {
        resolved = INDEXED_COLORS[color.indexed];
    }

    return resolved ? applyTint(resolved, color.tint ?? 0) : undefined;
}

export function excelBorderToCss(border?: Partial<Border>): string | undefined {
    if (!border?.style) return undefined;
    const color = excelColorToCss(border.color) ?? '#000000';

    switch (border.style) {
        case 'hair': return `1px solid ${color}`;
        case 'thin': return `1px solid ${color}`;
        case 'medium': return `2px solid ${color}`;
        case 'thick': return `3px solid ${color}`;
        case 'dotted': return `1px dotted ${color}`;
        case 'dashed': return `1px dashed ${color}`;
        case 'dashDot': return `1px dashed ${color}`;
        case 'dashDotDot': return `1px dashed ${color}`;
        case 'mediumDashed': return `2px dashed ${color}`;
        case 'mediumDashDot': return `2px dashed ${color}`;
        case 'mediumDashDotDot': return `2px dashed ${color}`;
        case 'slantDashDot': return `2px dashed ${color}`;
        case 'double': return `3px double ${color}`;
        default: return `1px solid ${color}`;
    }
}

export function columnWidthToPixels(width?: number): number {
    const excelWidth = width && width > 0 ? width : 8.43;
    return Math.max(24, Math.round(excelWidth * 7 + 5));
}

export function pointsToPixels(points?: number, fallback = 15): number {
    return Math.max(2, Math.round((points && points > 0 ? points : fallback) * (96 / 72)));
}

export function columnNameToIndex(name: string): number {
    let result = 0;
    for (const char of name.toUpperCase()) {
        result = result * 26 + char.charCodeAt(0) - 64;
    }
    return result - 1;
}

export function columnIndexToName(index: number): string {
    let value = index + 1;
    let result = '';
    while (value > 0) {
        const remainder = (value - 1) % 26;
        result = String.fromCharCode(65 + remainder) + result;
        value = Math.floor((value - 1) / 26);
    }
    return result;
}

function parseCellAddress(address: string): { row: number; col: number } | null {
    const match = address.replace(/\$/g, '').match(/^([A-Z]{1,3})(\d{1,7})$/i);
    if (!match) return null;
    const col = columnNameToIndex(match[1]);
    const row = Number(match[2]) - 1;
    if (col < 0 || col > 16383 || row < 0 || row > 1048575) return null;
    return { row, col };
}

function removeStringLiterals(formula: string): string {
    return formula.replace(/"(?:[^"]|"")*"/g, match => ' '.repeat(match.length));
}

export function extractFormulaReferences(
    formula: string,
    currentSheet: string,
): FormulaReference[] {
    const expression = removeStringLiterals(formula.replace(/^=/, ''));
    const pattern = /(?:(?:'((?:[^']|'')+)'|([A-Za-z_\\][A-Za-z0-9_.\\]*))!)?(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?/gi;
    const references: FormulaReference[] = [];
    const seen = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(expression)) !== null) {
        const before = expression[match.index - 1];
        const after = expression[match.index + match[0].length];
        if (
            (before && /[A-Za-z0-9_.]/.test(before))
            || (after && /[A-Za-z0-9_.(]/.test(after))
        ) {
            continue;
        }

        const start = parseCellAddress(match[3]);
        const end = parseCellAddress(match[4] || match[3]);
        if (!start || !end) continue;

        const sheetName = (match[1]?.replace(/''/g, "'") || match[2] || currentSheet).trim();
        const startRow = Math.min(start.row, end.row);
        const endRow = Math.max(start.row, end.row);
        const startCol = Math.min(start.col, end.col);
        const endCol = Math.max(start.col, end.col);
        const normalizedAddress = `${columnIndexToName(startCol)}${startRow + 1}${
            startRow === endRow && startCol === endCol
                ? ''
                : `:${columnIndexToName(endCol)}${endRow + 1}`
        }`;
        const key = `${sheetName.toLowerCase()}!${normalizedAddress}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const palette = FORMULA_TRACE_COLORS[references.length % FORMULA_TRACE_COLORS.length];
        references.push({
            id: key,
            label: sheetName === currentSheet ? normalizedAddress : `${sheetName}!${normalizedAddress}`,
            sheetName,
            startRow,
            endRow,
            startCol,
            endCol,
            color: palette.color,
            tint: palette.tint,
        });
    }

    return references;
}

export function referenceContainsCell(
    reference: FormulaReference,
    sheetName: string,
    row: number,
    col: number,
): boolean {
    return reference.sheetName.toLowerCase() === sheetName.toLowerCase()
        && row >= reference.startRow
        && row <= reference.endRow
        && col >= reference.startCol
        && col <= reference.endCol;
}
