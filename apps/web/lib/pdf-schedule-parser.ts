/**
 * pdf-schedule-parser.ts  (v4 – rewritten from scratch)
 *
 * Parses UP academic offerings from PDF-copied text, PDF binary or Word (.docx).
 * Format supported:
 *
 *   120266 - Antiguo Perú, … 4,00
 *   A PARDO GRAU, Cecilia Maria Luisa
 *   CLASE LUN 11:30 13:20 30 J-603
 *   CLASE MIE 11:30 13:20 30 J-603
 *   FINAL MIE 10:30 12:30 40 A-PEND
 *   PARCIAL MIE 10:30 12:30 40 A-PEND
 */

export type ParsedOferta = {
    codigo_curso: string;
    nombre_curso: string;
    seccion: string;
    profesor: string;
    creditos: number;
    tipo: string;       // CLASE | FINAL | PARCIAL | PRACTICA | LABORATORIO | …
    dia: string;        // LUN | MAR | MIE | JUE | VIE | SAB | DOM
    hora_inicio: string; // HH:MM
    hora_fin: string;    // HH:MM
    duracion: number;
    cupos: number;
    aula: string;
    section_id?: string;
};

// ────────────────────────────────────────────────────────────────────────────────
//  Helper sets / regexes
// ────────────────────────────────────────────────────────────────────────────────

const DIAS = new Set(['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM']);

const TIPOS = new Set([
    'CLASE', 'FINAL', 'PARCIAL', 'LABORATORIO', 'TALLER',
    'PRÁCTICA', 'PRACTICA', 'PRACCALIFI', 'PRACDIRIGI',
]);

// Tokens that look like section letters but are actually type or day keywords
const NON_SECTION_TOKENS = new Set([
    ...Array.from(DIAS),
    ...Array.from(TIPOS),
    'SIN', 'PENDIENTE', 'PEND', 'PREREQUISITO', 'AULA', 'HORARIO',
    'VIRTUAL', 'PRESENCIAL', 'LUNES', 'MARTES', 'MIERCOLES',
    'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO', 'CURSOS', 'ACADÉMICOS',
    'CREDITOS', 'ACA', 'CURSADO', 'DICTADO', 'INGLÉS', 'INGLES',
    'DOBLE', 'GRADO', 'CLASES',
]);

// Matches "09:30" or "9:30"
const TIME_RE = /\b(\d{1,2}:\d{2})\b/g;

// Match a course header like "120266 - Nombre del curso 4,00"
const COURSE_HEADER_RE = /^(\d{6})\s*[-–]\s*(.+)/;

// Noise lines to ignore entirely (but NOT reset course context)
const NOISE_RE = [
    /^Se sugiere revisar/i,
    /^Horarios ofertados:/i,
    /^Dirección de Asuntos/i,
    /^Página\s+\d/i,
    /^OFERTA/i,
    /^SISTEMA/i,
    /^Secc\s+Tipo\s+Docentes/i,   // table header row
];

// ────────────────────────────────────────────────────────────────────────────────
//  Public entry points
// ────────────────────────────────────────────────────────────────────────────────

export async function parseOfertaFile(file: File): Promise<{
    periodo: string; ofertas: ParsedOferta[]; errors: string[];
}> {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return parseFromPDF(file);
    if (ext === 'docx' || ext === 'doc') return parseFromWord(file);
    return { periodo: '', ofertas: [], errors: [`Formato no soportado: .${ext}. Usa PDF o Word.`] };
}

export async function parseOfertaText(text: string): Promise<{
    periodo: string; ofertas: ParsedOferta[]; errors: string[];
}> {
    return parseLines(text.split('\n'));
}

// ────────────────────────────────────────────────────────────────────────────────
//  PDF / Word readers
// ────────────────────────────────────────────────────────────────────────────────

async function parseFromPDF(file: File): Promise<{ periodo: string; ofertas: ParsedOferta[]; errors: string[] }> {
    const pdfjsLib = await import('pdfjs-dist');
    if (typeof window !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    }
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const lines: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();

        // Group items by y-position to reconstruct lines
        const byY = new Map<number, Array<{ x: number; text: string }>>();
        for (const item of content.items) {
            if (!('str' in item) || !item.str.trim()) continue;
            const y = Math.round((item as any).transform[5]);
            const x = Math.round((item as any).transform[4]);
            if (!byY.has(y)) byY.set(y, []);
            byY.get(y)!.push({ x, text: item.str.trim() });
        }

        // Top-to-bottom order (descending y in PDF coords)
        const ys = Array.from(byY.keys()).sort((a, b) => b - a);
        for (const y of ys) {
            const items = byY.get(y)!.sort((a, b) => a.x - b.x);
            let line = '';
            for (let j = 0; j < items.length; j++) {
                if (j > 0) {
                    const gap = items[j].x - (items[j - 1].x + items[j - 1].text.length * 4);
                    line += gap > 10 ? ' ' : ' ';
                }
                line += items[j].text;
            }
            lines.push(line);
        }
    }
    return parseLines(lines);
}

async function parseFromWord(file: File): Promise<{ periodo: string; ofertas: ParsedOferta[]; errors: string[] }> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return parseLines(result.value.split('\n'));
}

// ────────────────────────────────────────────────────────────────────────────────
//  Core parser  (line-by-line state machine)
// ────────────────────────────────────────────────────────────────────────────────

function parseLines(rawLines: string[]): { periodo: string; ofertas: ParsedOferta[]; errors: string[] } {

    // ── 1. Normalise: deduplicate identical consecutive lines ──────────────────
    const lines: string[] = [];
    for (let i = 0; i < rawLines.length; i++) {
        const t = rawLines[i];
        if (i === 0 || t !== rawLines[i - 1]) lines.push(t);
    }

    // ── 2. Detect periodo ──────────────────────────────────────────────────────
    let periodo = '';
    for (const line of lines.slice(0, 40)) {
        const m = line.match(/Horarios\s+[Oo]fertados:\s*(.+)/i);
        if (m) { periodo = m[1].trim(); break; }
    }
    // Fallback: look anywhere
    if (!periodo) {
        for (const line of lines) {
            const m = line.match(/(\d{4}-[IV]+(?:\s+PERIODO[- \w]*)?)/i);
            if (m) { periodo = m[1].trim(); break; }
        }
    }
    if (!periodo) periodo = 'Periodo sin identificar';

    // ── 3. State ───────────────────────────────────────────────────────────────
    let currentCodigo = '';
    let currentNombre = '';
    let currentCreditos = 0;
    let currentSeccion = '';
    let currentProfesor = '';
    let professorBuffer = ''; // accumulates multi-line professor names
    let expectingProfessor = false; // true after a lone section letter line

    const ofertas: ParsedOferta[] = [];
    const blocksSeen = new Set<string>();      // prevent duplicates

    // ── 4. Line-by-line ────────────────────────────────────────────────────────
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // Skip noise (but keep course context)
        if (NOISE_RE.some(re => re.test(line))) continue;

        // ── A. Course header ──────────────────────────────────────────────────
        const courseMatch = line.match(COURSE_HEADER_RE);
        if (courseMatch) {
            const codigo = courseMatch[1];
            if (codigo !== currentCodigo) {
                flushProfessorBuffer();
                currentCodigo = codigo;
                let namePart = courseMatch[2].trim();
                // Extract credits from end: "4,00" or "4.00"
                const creditMatch = namePart.match(/(\d+[.,]\d+)\s*$/);
                if (creditMatch) {
                    currentCreditos = parseFloat(creditMatch[1].replace(',', '.'));
                    namePart = namePart.slice(0, creditMatch.index).trim();
                }
                // Strip PREREQUISITO suffix
                namePart = namePart.replace(/\s+PREREQUISITO[:\s].*/i, '').trim();
                currentNombre = namePart;
                currentSeccion = '';
                currentProfesor = '';
                professorBuffer = '';
            }
            continue;
        }

        if (!currentCodigo) continue;

        // ── B. Try to classify the line ───────────────────────────────────────
        const firstToken = line.split(/\s+/)[0].toUpperCase();

        // B1. Schedule type token (CLASE/FINAL/PARCIAL/PRÁCTICA/…)
        // These lines look like:  CLASE LUN 11:30 13:20 30 J-603
        if (TIPOS.has(firstToken)) {
            flushProfessorBuffer();
            expectingProfessor = false;
            if (!currentSeccion) continue;  // no section context yet
            if (firstToken === 'PRACCALIFI') continue;  // always skip

            const tipo = normalizeTipo(firstToken);
            const times = extractTimes(line);
            if (times.length === 0) continue;

            const dia = extractDay(line);

            for (const [start, end] of times) {
                const key = `${currentCodigo}-${currentSeccion}-${tipo}-${dia}-${start}-${end}`;
                if (blocksSeen.has(key)) continue;
                blocksSeen.add(key);

                const [h1, m1] = start.split(':').map(Number);
                const [h2, m2] = end.split(':').map(Number);
                const duracion = (h2 * 60 + m2) - (h1 * 60 + m1);
                const aula = extractAula(line, start);

                ofertas.push({
                    codigo_curso: currentCodigo,
                    nombre_curso: currentNombre,
                    seccion: currentSeccion,
                    profesor: currentProfesor,
                    creditos: currentCreditos,
                    tipo,
                    dia,
                    hora_inicio: start,
                    hora_fin: end,
                    duracion: duracion > 0 ? duracion : 0,
                    cupos: 0,
                    aula,
                });
            }
            continue;
        }

        // B2. Day-only token — could be a wrapped schedule line:
        //   "LUN 11:30 13:20 30 J-603"  (rare, but happens on wrapping)
        if (DIAS.has(firstToken)) {
            flushProfessorBuffer();
            expectingProfessor = false;
            if (!currentSeccion) continue;
            // We need to know the tipo — peek at previous ofertas for this section
            const lastOferta = [...ofertas].reverse().find(o =>
                o.codigo_curso === currentCodigo && o.seccion === currentSeccion
            );
            const tipo = lastOferta?.tipo ?? 'CLASE';
            const times = extractTimes(line);
            if (times.length === 0) continue;
            const dia = firstToken;

            for (const [start, end] of times) {
                const key = `${currentCodigo}-${currentSeccion}-${tipo}-${dia}-${start}-${end}`;
                if (blocksSeen.has(key)) continue;
                blocksSeen.add(key);
                const [h1, m1] = start.split(':').map(Number);
                const [h2, m2] = end.split(':').map(Number);
                const aula = extractAula(line, start);
                ofertas.push({
                    codigo_curso: currentCodigo,
                    nombre_curso: currentNombre,
                    seccion: currentSeccion,
                    profesor: currentProfesor,
                    creditos: currentCreditos,
                    tipo,
                    dia,
                    hora_inicio: start,
                    hora_fin: end,
                    duracion: Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1)),
                    cupos: 0,
                    aula,
                });
            }
            continue;
        }

        // B3. Section header.
        // Case A: "A PARDO GRAU, Cecilia" — letter + professor on same line
        // Case B: standalone "B" alone — letter on its own line, professor follows
        const sectionMatchFull = line.match(/^([A-Z0-9]{1,3})\s+(.+)/);
        const sectionMatchLone = line.match(/^([A-Z0-9]{1,3})$/);

        // Determine if this is a lone section letter
        const isLoneSection = !!sectionMatchLone &&
            !NON_SECTION_TOKENS.has(sectionMatchLone[1].toUpperCase());

        // Determine if this is a section+text line
        const isFullSection = !!sectionMatchFull &&
            !NON_SECTION_TOKENS.has(sectionMatchFull[1].toUpperCase()) &&
            !hasTime(line);

        if (isLoneSection) {
            // Just a letter like "B" — expect professor name on next line(s)
            flushProfessorBuffer();
            currentSeccion = sectionMatchLone![1].toUpperCase();
            currentProfesor = 'Sin profesor';
            professorBuffer = '';
            expectingProfessor = true;
            continue;
        }

        if (isFullSection) {
            flushProfessorBuffer();
            expectingProfessor = false;
            currentSeccion = sectionMatchFull![1].toUpperCase();
            const rest = sectionMatchFull![2].trim();

            // Check: does the rest begin with a TIPO (inline schedule)?
            const firstOfRest = rest.split(/\s+/)[0].toUpperCase();
            if (TIPOS.has(firstOfRest)) {
                // Schedule is on the same line as section letter
                currentProfesor = 'Sin profesor';
                if (firstOfRest !== 'PRACCALIFI') {
                    const tipo = normalizeTipo(firstOfRest);
                    const times = extractTimes(rest);
                    const dia = extractDay(rest);
                    for (const [start, end] of times) {
                        const key = `${currentCodigo}-${currentSeccion}-${tipo}-${dia}-${start}-${end}`;
                        if (blocksSeen.has(key)) continue;
                        blocksSeen.add(key);
                        const [h1, m1] = start.split(':').map(Number);
                        const [h2, m2] = end.split(':').map(Number);
                        const aula = extractAula(rest, start);
                        ofertas.push({
                            codigo_curso: currentCodigo,
                            nombre_curso: currentNombre,
                            seccion: currentSeccion,
                            profesor: currentProfesor,
                            creditos: currentCreditos,
                            tipo,
                            dia,
                            hora_inicio: start,
                            hora_fin: end,
                            duracion: Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1)),
                            cupos: 0,
                            aula,
                        });
                    }
                }
            } else {
                // Professor name starts here; may continue on next line(s)
                professorBuffer = cleanProfName(rest);
                expectingProfessor = true;
            }
            continue;
        }

        // B4. Professor name continuation (multi-line names like "MONSALVE ZANATTI, Martin / …")
        //     Also handles: professor on the line AFTER a lone section letter.
        //     These lines contain no time tokens and don't start with a TIPO or known keyword.
        if (currentSeccion && !hasTime(line) && !TIPOS.has(firstToken) && !DIAS.has(firstToken)) {
            // Append to professorBuffer if it looks like a name fragment
            if (/^[A-ZÁÉÍÓÚÑÜ]/.test(line) && !NOISE_RE.some(re => re.test(line))) {
                if (expectingProfessor) {
                    // After a lone-letter or mid-name continuation
                    if (professorBuffer) {
                        professorBuffer += ' ' + cleanProfName(line);
                    } else {
                        professorBuffer = cleanProfName(line);
                    }
                }
                // else: just an annotation line, ignore
            }
            continue;
        }
    }

    flushProfessorBuffer();

    const errors: string[] = [];
    if (ofertas.length === 0) {
        errors.push(
            'No se encontraron horarios. Asegúrate de pegar el texto completo (incluyendo los códigos de 6 dígitos y los horarios).'
        );
    }
    return { periodo, ofertas, errors };

    // ── Helper: flush accumulated professor name to current section ──────────
    function flushProfessorBuffer() {
        if (professorBuffer) {
            currentProfesor = professorBuffer;
            professorBuffer = '';
        }
    }
}

// ────────────────────────────────────────────────────────────────────────────────
//  Utility helpers
// ────────────────────────────────────────────────────────────────────────────────

function hasTime(line: string): boolean {
    return /\b\d{1,2}:\d{2}\b/.test(line);
}

/** Returns all [start, end] time pairs found in a line */
function extractTimes(line: string): [string, string][] {
    const matches = Array.from(line.matchAll(/\b(\d{1,2}:\d{2})\b/g));
    const result: [string, string][] = [];
    for (let i = 0; i + 1 < matches.length; i += 2) {
        result.push([matches[i][1], matches[i + 1][1]]);
    }
    return result;
}

/** Extracts the first day keyword from a line */
function extractDay(line: string): string {
    for (const token of line.split(/\s+/)) {
        if (DIAS.has(token.toUpperCase())) return token.toUpperCase();
    }
    return 'LUN';
}

/** Extracts classroom code (e.g. A-603, X -302, Virtual-Virtua) after the times */
function extractAula(line: string, afterTime: string): string {
    const idx = line.lastIndexOf(afterTime);
    if (idx < 0) return 'PEND';
    const rest = line.slice(idx);
    // Match pattern like: J-603 | A-PEND | X -302 | Virtual-Virtua | B-306
    const aulaMatch = rest.match(/\b([A-Z][a-zA-Z]?\s*-\s*(?:\d{3}|PEND|Virtua|[A-Z]{3,}))\b/);
    if (aulaMatch) return aulaMatch[1].replace(/\s+/g, '').toUpperCase();
    return 'PEND';
}

/** Normalize tipo names */
function normalizeTipo(raw: string): string {
    const u = raw.toUpperCase();
    if (u === 'PRACTICA' || u === 'PRÁCTICA') return 'PRACTICA';
    if (u === 'PRACDIRIGI') return 'PRACTICA';
    if (u === 'PRACCALIFI') return 'PRACCALIFI'; // should already be skipped
    return u;
}

/** Clean up a raw professor name string */
function cleanProfName(raw: string): string {
    // Cut at first TIPO keyword
    const tipoIdx = raw.search(/\b(CLASE|FINAL|PARCIAL|PRÁCTICA|PRACTICA|LABORATORIO|TALLER)\b/i);
    if (tipoIdx > 0) raw = raw.slice(0, tipoIdx);
    // Cut at first time
    const timeIdx = raw.search(/\b\d{1,2}:\d{2}\b/);
    if (timeIdx > 0) raw = raw.slice(0, timeIdx);
    // Remove trailing numbers, tabs, extra whitespace
    return raw.replace(/\s+\d+\s*$/, '').replace(/\t/g, ' ').trim();
}

// Backward compat
export const parseOfertaPDF = parseOfertaFile;
