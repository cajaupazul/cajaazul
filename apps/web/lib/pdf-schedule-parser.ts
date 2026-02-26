/**
 * Schedule Parser - Improved
 * Parses university academic offering from PDF, Word (.docx), or pasted text.
 *
 * Key improvements:
 *  - Multi-professor sections (LORA ALVAREZ, X / SALAZAR TIRADO, Y)
 *  - Sections continuing after page-break headers (no repeated course header)
 *  - FINAL and PARCIAL blocks now stored (not filtered out)
 *  - Smarter section detection: won't hijack keywords
 */

export type ParsedOferta = {
    codigo_curso: string;
    nombre_curso: string;
    seccion: string;
    profesor: string;
    creditos: number;
    tipo: string;       // CLASE, FINAL, PARCIAL, PRACTICA, LABORATORIO, TALLER
    dia: string;        // LUN, MAR, MIE, JUE, VIE, SAB, DOM
    hora_inicio: string; // HH:MM
    hora_fin: string;    // HH:MM
    duracion: number;
    cupos: number;
    aula: string;
    section_id?: string;
};

const DIAS_VALIDOS = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];
const TIPOS_VALIDOS = ['CLASE', 'FINAL', 'PARCIAL', 'LABORATORIO', 'TALLER', 'PRÁCTICA', 'PRACTICA', 'PRACCALIFI', 'PRACDIRIGI'];
const TIME_REGEX = /(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})/g;

// Full list of keywords that should never be treated as section letters
const RESERVED_WORDS = new Set([
    ...TIPOS_VALIDOS.map(t => t.toUpperCase()),
    'SIN', 'PENDIENTE', 'PEND', 'PREREQUISITO', 'AULA', 'HORARIO',
    'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO',
    ...DIAS_VALIDOS,
]);

export async function parseOfertaFile(file: File): Promise<{
    periodo: string;
    ofertas: ParsedOferta[];
    errors: string[];
}> {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return parseFromPDF(file);
    if (ext === 'docx' || ext === 'doc') return parseFromWord(file);
    return { periodo: '', ofertas: [], errors: [`Formato no soportado: .${ext}. Usa PDF o Word (.docx).`] };
}

export async function parseOfertaText(text: string): Promise<{
    periodo: string;
    ofertas: ParsedOferta[];
    errors: string[];
}> {
    const allLines = text.split('\n');
    return parseLines(allLines);
}

async function parseFromPDF(file: File): Promise<{
    periodo: string; ofertas: ParsedOferta[]; errors: string[];
}> {
    const pdfjsLib = await import('pdfjs-dist');
    if (typeof window !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const allLines: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const lineMap = new Map<number, Array<{ x: number; text: string }>>();
        for (const item of textContent.items) {
            if ('str' in item && item.str.trim()) {
                const transform = (item as any).transform;
                const y = Math.round(transform[5]);
                const x = Math.round(transform[4]);
                if (!lineMap.has(y)) lineMap.set(y, []);
                lineMap.get(y)!.push({ x, text: item.str.trim() });
            }
        }
        const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
        for (const y of sortedYs) {
            const items = lineMap.get(y)!.sort((a, b) => a.x - b.x);
            let lineText = '';
            for (let j = 0; j < items.length; j++) {
                if (j > 0) {
                    const prev = items[j - 1];
                    const curr = items[j];
                    const gap = curr.x - (prev.x + prev.text.length * 4);
                    lineText += gap > 12 ? '\t' : ' ';
                }
                lineText += items[j].text;
            }
            allLines.push(lineText);
        }
    }
    return parseLines(allLines);
}

async function parseFromWord(file: File): Promise<{
    periodo: string; ofertas: ParsedOferta[]; errors: string[];
}> {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const allLines = result.value.split('\n').map(line => line.trim()).filter(Boolean);
    return parseLines(allLines);
}

/**
 * Core line parser — handles:
 *  - Course headers: "130649 - Matemáticas I  5.00"
 *  - Section lines: "A  TEACHER NAME   CLASE  LUN  09:30  11:20  35  J-503"
 *  - Continuation lines: "  CLASE  LUN  09:30  11:20  35  J-503" (no section letter)
 *  - Page-break noise: stripped out
 *  - Multi-prof sections: "TEACHER A / TEACHER B"
 */
function parseLines(allLines: string[]): {
    periodo: string; ofertas: ParsedOferta[]; errors: string[];
} {
    let periodo = '';

    // De-duplicate adjacent identical lines (PDF artifact)
    const uniqueLines: string[] = [];
    for (let i = 0; i < allLines.length; i++) {
        if (i === 0 || allLines[i] !== allLines[i - 1]) {
            uniqueLines.push(allLines[i]);
        }
    }

    // Try to extract periodo from first 20 lines (or anywhere if not found)
    for (const line of uniqueLines.slice(0, 30)) {
        const m = line.match(/Horarios\s+[Oo]fertados:\s*(.+)/i);
        if (m) { periodo = m[1].trim(); break; }
        const m2 = line.match(/(\d{4}-[IV]+\s*(?:PERIODO[- ]?\w*)?)/i);
        if (m2) { periodo = m2[1].trim(); break; }
    }
    if (!periodo) periodo = 'Periodo sin identificar';

    const rawOfertas: ParsedOferta[] = [];
    const errors: string[] = [];

    let currentCodigo = '';
    let currentNombre = '';
    let currentCreditos = 0;
    let currentSeccion = '';
    let currentProfesor = '';

    // Dedup tracking
    const sectionsSeen = new Set<string>();
    const blocksSeen = new Set<string>();
    const teacherBySection = new Map<string, string>();

    const courseHeaderPattern = /^(\d{6})\s*[-–]\s*(.+)/;
    // Section letter pattern: line starts with 1-3 uppercase alphanumeric chars followed by 2+ spaces
    const sectionStartPattern = /^([A-Z0-9]{1,3})\s{2,}/;

    // Noise lines to skip
    const isNoiseLine = (line: string) => {
        const t = line.trim();
        if (!t) return true;
        if (t.includes('Se sugiere revisar')) return true;
        if (t.startsWith('OFERTA') || t.startsWith('SISTEMA') || t.startsWith('Página')) return true;
        if (t.startsWith('Dirección de Asuntos')) return true;
        // Page-break periods found mid-document — skip but DON'T reset currentCodigo
        if (/^Horarios\s+[Oo]fertados:/i.test(t)) return true;
        return false;
    };

    for (const line of uniqueLines) {
        const rawLine = line.trim();
        if (isNoiseLine(rawLine)) continue;

        const columns = line.split('\t').map(p => p.trim());

        // 1. Course header: "180268 - Derecho Laboral y Tributario  3,00"
        const courseHeaderMatch = rawLine.match(courseHeaderPattern);
        if (courseHeaderMatch) {
            const nextCodigo = courseHeaderMatch[1];
            if (nextCodigo !== currentCodigo) {
                currentCodigo = nextCodigo;
                let namePart = courseHeaderMatch[2].trim();
                const creditMatch = rawLine.match(/(\d+[.,]\d+)\b/);
                if (creditMatch) {
                    currentCreditos = parseFloat(creditMatch[1].replace(',', '.'));
                    namePart = namePart.replace(creditMatch[0], '').trim();
                }
                // Strip trailing PREREQUISITO info from name
                namePart = namePart.replace(/\s+PREREQUISITO:.*/i, '').trim();
                currentNombre = namePart;
                currentSeccion = '';
                currentProfesor = '';
            }
            continue;
        }

        if (!currentCodigo) continue;

        // 2. Section detection
        // Only treat as section if first token is a short uppercase label NOT in reserved words
        const firstToken = rawLine.split(/\s+/)[0];
        const sectionMatch = rawLine.match(sectionStartPattern);
        const isSection = sectionMatch &&
            sectionMatch[1].length === firstToken.length &&
            !RESERVED_WORDS.has(firstToken.toUpperCase()) &&
            // Sanity: section letters are typically 1-2 chars, or numeric codes
            firstToken.length <= 3;

        if (isSection) {
            const letter = sectionMatch![1].toUpperCase();
            const sectionId = `${currentCodigo}-${letter}`;
            currentSeccion = letter;

            if (!sectionsSeen.has(sectionId)) {
                sectionsSeen.add(sectionId);
                // Extract professor name — handle multi-prof "A / B" by joining
                const profRaw = extractProfessor(rawLine, letter);
                currentProfesor = profRaw || 'Sin profesor';
                teacherBySection.set(sectionId, currentProfesor);
            } else {
                // Continuation of same section across page break
                currentProfesor = teacherBySection.get(sectionId) || 'Sin profesor';
            }
        }

        // 3. Schedule block detection — parse ALL time pairs on this line
        if (!currentCodigo || !currentSeccion) continue;

        const diaMatches = Array.from(rawLine.matchAll(new RegExp(`\\b(${DIAS_VALIDOS.join('|')})\\b`, 'gi')));
        const timeMatches = Array.from(rawLine.matchAll(TIME_REGEX));
        const typeMatches = Array.from(rawLine.matchAll(new RegExp(`\\b(${TIPOS_VALIDOS.join('|')})\\b`, 'gi')));

        if (timeMatches.length === 0) continue;

        for (let i = 0; i < timeMatches.length; i++) {
            const timeMatch = timeMatches[i];
            const timePos = timeMatch.index || 0;

            // Pick day: closest before this time
            let dia = 'LUN';
            if (diaMatches.length > 0) {
                const before = diaMatches.filter(m => (m.index || 0) < timePos);
                dia = before.length > 0
                    ? before[before.length - 1][1].toUpperCase()
                    : diaMatches[Math.min(i, diaMatches.length - 1)][1].toUpperCase();
            }

            // Pick tipo: closest before this time
            let tipo = 'CLASE';
            if (typeMatches.length > 0) {
                const before = typeMatches.filter(m => (m.index || 0) < timePos);
                const best = before.length > 0
                    ? before[before.length - 1][1]
                    : typeMatches[Math.min(i, typeMatches.length - 1)][1];
                const rawTipo = best.toUpperCase();

                if (rawTipo === 'PRACCALIFI') continue; // always skip
                if (['FINAL', 'PARCIAL'].includes(rawTipo)) {
                    tipo = rawTipo;
                } else if (rawTipo === 'PRACDIRIGI' || rawTipo === 'PRÁCTICA' || rawTipo === 'PRACTICA') {
                    tipo = 'PRACTICA';
                } else {
                    tipo = rawTipo;
                }
            }

            const startStr = timeMatch[1];
            const endStr = timeMatch[2];

            // Dedup
            const blockKey = `${currentCodigo}-${currentSeccion}-${tipo}-${dia}-${startStr}-${endStr}`;
            if (blocksSeen.has(blockKey)) continue;
            blocksSeen.add(blockKey);

            // Duration
            const [h1, m1] = startStr.split(':').map(Number);
            const [h2, m2] = endStr.split(':').map(Number);
            const duracion = (h2 * 60 + m2) - (h1 * 60 + m1);

            // Classroom: e.g. "A-101", "J-503", "A-PEND", "H-203"
            let aula = 'PEND';
            const aulaMatches = Array.from(rawLine.matchAll(/\b([A-Z]-?(?:\d{3}|PEND)|X\s*-\s*\d{3})\b/gi));
            if (aulaMatches.length > 0) {
                const after = aulaMatches.filter(m => (m.index || 0) > timePos);
                const best = after.length > 0 ? after[0][0] : aulaMatches[aulaMatches.length - 1][0];
                aula = best.replace(/\s+/g, '').toUpperCase();
            }

            rawOfertas.push({
                codigo_curso: currentCodigo,
                nombre_curso: currentNombre,
                seccion: currentSeccion,
                profesor: currentProfesor,
                creditos: currentCreditos,
                tipo,
                dia,
                hora_inicio: startStr,
                hora_fin: endStr,
                duracion: duracion > 0 ? duracion : 0,
                cupos: 0,
                aula,
            });
        }
    }

    if (rawOfertas.length === 0) {
        errors.push('No se encontraron horarios. Verifica que el texto copiado incluya el código de curso (6 dígitos), sección y horarios.');
    }

    return { periodo, ofertas: rawOfertas, errors };
}

/**
 * Extract professor name(s) from a section line.
 * Handles:
 *  - "A  TEACHER NAME   CLASE  LUN  ..."
 *  - "A  TEACHER A / TEACHER B   CLASE  LUN  ..."
 */
function extractProfessor(rawLine: string, sectionLetter: string): string {
    // Remove the section letter prefix
    const afterSection = rawLine.replace(new RegExp(`^${sectionLetter}\\s+`, 'i'), '').trim();

    // Find the first TIPO keyword position — professor name is everything before it
    const TIPO_REGEX = new RegExp(`\\b(${TIPOS_VALIDOS.join('|')})\\b`, 'i');
    const tipoMatch = afterSection.match(TIPO_REGEX);

    let profRaw = tipoMatch
        ? afterSection.slice(0, tipoMatch.index).trim()
        : afterSection.trim();

    // Also cut off at the first time-like pattern
    const timeMatch = profRaw.match(/\d{1,2}:\d{2}/);
    if (timeMatch && timeMatch.index !== undefined) {
        profRaw = profRaw.slice(0, timeMatch.index).trim();
    }

    // Clean trailing numbers (cupos), tabs, extra whitespace
    profRaw = profRaw.replace(/\s+\d+\s*$/, '').replace(/\t/g, ' ').trim();

    // Handle multi-professor separated by " / "
    if (profRaw.includes('/')) {
        const parts = profRaw.split('/').map(p => p.trim()).filter(Boolean);
        profRaw = parts.join(' / ');
    }

    // Final cleanup: remove any day/tipo fragments that leaked in
    const cleaners = [...DIAS_VALIDOS, ...TIPOS_VALIDOS];
    profRaw = profRaw.replace(new RegExp(`\\b(${cleaners.join('|')})\\b`, 'gi'), '').replace(/\s{2,}/g, ' ').trim();

    return profRaw || 'Sin profesor';
}

// Backward compatibility
export const parseOfertaPDF = parseOfertaFile;
