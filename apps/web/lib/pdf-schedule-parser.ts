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
    'DOBLE', 'GRADO', 'CLASES', 'DE', 'DEL', 'LA', 'LAS', 'LOS',
    'SAN', 'MAC', 'VON', 'VAN', 'EL', 'MC'
]);

// Matches "09:30" or "9:30"
const TIME_RE = /\b(\d{1,2}:\d{2})\b/g;

// Match a course header like "120266 - Nombre del curso 4,00" or "1F0162 - Análisis Financiero" or "1MN003 Gestión"
// Includes optional leading " to handle CSV/Excel wrapped cells
const COURSE_HEADER_RE = /^"?([A-Z0-9]{4,8})\s*(?:[-–]\s*)?(.+)/i;

// Noise lines to ignore entirely (but NOT reset course context)
const NOISE_RE = [
    /^Se sugiere revisar/i,
    /^Horarios ofertados/i,
    /^Dirección de Asuntos/i,
    /^Página\s+\d/i,
    /^OFERTA/i,
    /^SISTEMA/i,
    /^Secc\s+Tipo/i,              // table header row
    /^CURSOS ACADÉMICOS/i,        // yellow section header
    /^\d{2}\/\d{2}\/\d{4}/,       // date stamp (e.g. 07/07/2026 V1)
    /^Cred\s+Teoría/i,            // table header continuation
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
    if (ext === 'xlsx' || ext === 'xls') return parseFromExcel(file);
    return { periodo: '', ofertas: [], errors: [`Formato no soportado: .${ext}. Usa PDF, Word o Excel.`] };
}

/**
 * Handles Excel's copy-paste behavior where internal cell newlines (Alt+Enter)
 * cause the entire cell to be wrapped in double quotes. This breaks standard line-by-line parsing.
 * This function merges those fractured lines back into single lines seamlessly.
 */
function splitExcelText(text: string): string[] {
    const lines: string[] = [];
    let currentLine = '';
    let insideQuotes = false;

    // Normalize \r\n to \n
    text = text.replace(/\r\n/g, '\n');

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === '\n' && !insideQuotes) {
            lines.push(currentLine);
            currentLine = '';
            continue;
        }
        currentLine += char;
    }
    if (currentLine) lines.push(currentLine);

    // After reassembling the wrapped cells, any internal newlines are converted to spaces.
    // We also forcefully strip all double quotes now that we have used them to recombine the cells.
    return lines.map(l => l.replace(/\n/g, ' ').replace(/"/g, ''));
}

export async function parseOfertaText(text: string): Promise<{
    periodo: string; ofertas: ParsedOferta[]; errors: string[];
}> {
    return parseLines(splitExcelText(text));
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

async function parseFromExcel(file: File): Promise<{ periodo: string; ofertas: ParsedOferta[]; errors: string[] }> {
    const XLSX = await import('xlsx');
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
    
    const lines: string[] = [];
    for (const row of rows) {
        if (!Array.isArray(row)) continue;
        const line = row
            .map(cell => String(cell).trim())
            .filter(Boolean)
            .join(' ');
        if (line) lines.push(line);
    }
    return parseLines(lines);
}

// ────────────────────────────────────────────────────────────────────────────────
//  Core parser  (line-by-line state machine)
// ────────────────────────────────────────────────────────────────────────────────

function parseLines(rawLines: string[]): { periodo: string; ofertas: ParsedOferta[]; errors: string[] } {

    // ── 1. Normalise: deduplicate identical consecutive lines ──────────────────
    let lines: string[] = [];
    for (let i = 0; i < rawLines.length; i++) {
        const t = rawLines[i].trim();
        if (!t) continue;
        if (lines.length === 0 || t !== lines[lines.length - 1]) lines.push(t);
    }

    // ── 1.5. Heal fractured aulas ──────────────────────────────────────────────
    // Aulas like A-PEND or B-305 sometimes get split across 3 lines: 
    // "FINAL MIE 16:30 18:30 30" -> "A" -> "-PEND"
    // Or across 2 lines: "FINAL MIE 16:30 18:30 30" -> "A -PEND"
    const healedLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1. Fully fractured: "FINAL..." -> "A" -> "-PEND"
        if (/^-(PEND|VIR|VIRT|VIRTUA|AUD|\d{3})/i.test(line) && healedLines.length >= 2) {
            const prevLine = healedLines[healedLines.length - 1];
            const prevPrevLine = healedLines[healedLines.length - 2];

            // Check if prev is just 1-3 uppercase letters
            if (/^[A-Z]{1,3}$/.test(prevLine)) {
                // Check if prevPrev contains scheduling info
                const firstToken = prevPrevLine.split(/\s+/)[0].toUpperCase();
                if (TIPOS.has(firstToken) || hasTime(prevPrevLine)) {
                    healedLines.pop(); // Remove "A"
                    const base = healedLines.pop(); // Remove "FINAL..."
                    healedLines.push(`${base} ${prevLine}${line}`);
                    continue;
                }
            }
        }

        // 2. Partially fractured: "FINAL..." -> "A -PEND"
        if (/^[A-Z]{1,3}\s*-(PEND|VIR|VIRT|VIRTUA|AUD|\d{3})/i.test(line) && healedLines.length >= 1) {
            const prevLine = healedLines[healedLines.length - 1];
            const firstToken = prevLine.split(/\s+/)[0].toUpperCase();
            if (TIPOS.has(firstToken) || hasTime(prevLine)) {
                const base = healedLines.pop(); // Remove "FINAL..."
                healedLines.push(`${base} ${line}`);
                continue;
            }
        }

        healedLines.push(line);
    }

    // overwrite lines with healedLines
    lines = healedLines;

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

    // ── 4. Line-by-line (Queue-based) ────────────────────────────────────────
    const queue = [...lines];

    while (queue.length > 0) {
        const rawLine = queue.shift()!;
        const line = rawLine.trim();
        if (!line) continue;

        // Skip noise (but keep course context)
        if (NOISE_RE.some(re => re.test(line))) continue;

        // ── A. Course header ──────────────────────────────────────────────────
        const courseMatch = line.match(COURSE_HEADER_RE);
        if (courseMatch) {
            const codigo = courseMatch[1].toUpperCase();

            // Ensure the captured code is not a reserved word (like "CLASE") and contains at least one digit
            if (!NON_SECTION_TOKENS.has(codigo) && /\d/.test(codigo)) {

                // IMPORTANT: Prevent Prerequisite/Correquisite fragments from hijacking the parser!
                // If a line is a real Excel course row, it will almost always have a hyphen ("120266 - Course") 
                // OR it will have a credit amount ("EJEM010 Strategy 4,00"). 
                // If a line lacks both, it is just a wrapped text fragment (like "142277 Analítica de Datos...)").
                const hasHyphen = line.includes('-') || line.includes('–');
                const hasCredits = /\s+(\d+[.,]\d+)\s*/.test(line);

                if (!hasHyphen && !hasCredits) {
                    // Ignore this fake course header, let it fall through or be ignored
                    continue;
                }

                if (codigo !== currentCodigo) {
                    flushProfessorBuffer();
                    currentCodigo = codigo;
                    currentCreditos = 0; // Reset for new course!
                    let namePart = courseMatch[2].trim();

                    // 1. Strip PREREQUISITO suffix FIRST, so it doesn't block the credit regex
                    namePart = namePart.replace(/\s+PREREQUISITO[:\s].*/i, '').trim();

                    // 2. Extract credits anywhere in the remaining string
                    // Often: "Nombre del curso 4,00 A PROFESOR..."
                    const creditMatch = namePart.match(/\s+(\d+[.,]\d+)\s*/);
                    if (creditMatch) {
                        currentCreditos = parseFloat(creditMatch[1].replace(',', '.'));
                        const creditIndex = creditMatch.index!;
                        const creditLength = creditMatch[0].length;

                        // The actual course name is whatever came before the credit
                        const beforeCredit = namePart.slice(0, creditIndex).trim();
                        // Whatever came after the credit is likely a section header that got squashed!
                        const afterCredit = namePart.slice(creditIndex + creditLength).trim();

                        namePart = beforeCredit;

                        if (afterCredit) {
                            // Re-inject the rest of the line to be parsed next iteration
                            queue.unshift(afterCredit);
                        }
                    }

                    currentNombre = namePart;
                    currentSeccion = '';
                    currentProfesor = '';
                    professorBuffer = '';
                }
                continue;
            }
        }

        if (!currentCodigo) continue;

        // ── B. Try to classify the line ───────────────────────────────────────
        const firstToken = line.split(/\s+/)[0].toUpperCase();

        // B1. Schedule type token (CLASE/FINAL/PARCIAL/PRÁCTICA/…)
        // These lines look like:  CLASE LUN 11:30 13:20 30 J-603
        if (TIPOS.has(firstToken)) {
            flushProfessorBuffer();
            expectingProfessor = false;

            if (!currentSeccion) {
                // Allow orphan schedules to be parsed temporarily under '?'
                currentSeccion = '?';
                currentProfesor = 'Sin profesor';
            }

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

                const { aula, endIndex } = extractAulaWithIndex(line, start);
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

                // If there's garbage left over after the aula (like another squashed section)
                if (endIndex < line.length) {
                    const leftover = line.slice(endIndex).trim();
                    if (leftover && !leftover.match(/^\d+$/)) {
                        // Very common squashed case: "I BELTRÁN PUERTA" -> section I
                        // Or even just "I" (lone section letter)
                        queue.unshift(leftover);
                    }
                }
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

                const { aula, endIndex } = extractAulaWithIndex(line, start);
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

                if (endIndex < line.length) {
                    const leftover = line.slice(endIndex).trim();
                    if (leftover && !leftover.match(/^\d+$/)) {
                        queue.unshift(leftover);
                    }
                }
            }
            continue;
        }

        // B3. Section header.
        // Case A: "A PARDO GRAU, Cecilia" — letter + professor on same line
        // Case B: standalone "B" alone — letter on its own line, professor follows

        // Let's make the regex more permissive for section names. It can start with up to 3 upper case alphanumeric chars.
        // REMOVED 'i' FLAG: Sections MUST be strictly upper-case. This prevents cases where "Del" is interpreted as "DEL"
        const sectionMatchFull = line.match(/^([A-Z0-9]{1,3})\s+(.+)/);
        const sectionMatchLone = line.match(/^([A-Z0-9]{1,3})$/);

        // Determine if this is a lone section letter
        const isLoneSection = !!sectionMatchLone &&
            !NON_SECTION_TOKENS.has(sectionMatchLone[1].toUpperCase());

        // Determine if this is a section+text line. 
        // IMPORTANT: Must NOT be an aula fragment like "A -PEND" mistakenly parsed as Section A, Professor "-PEND"
        const isFullSection = !!sectionMatchFull &&
            !NON_SECTION_TOKENS.has(sectionMatchFull[1].toUpperCase()) &&
            !hasTime(sectionMatchFull[2].trim().split(/\s+/)[0]) &&
            !/^\s*-(PEND|VIR|VIRT|VIRTUA|AUD|\d{3})/i.test(sectionMatchFull[2]);

        if (isLoneSection) {
            // Just a letter like "B" — expect professor name on next line(s)
            flushProfessorBuffer();
            currentSeccion = sectionMatchLone![1].toUpperCase();
            retrofillOrphanSchedules(currentCodigo, currentSeccion);
            currentProfesor = 'Sin profesor';
            professorBuffer = '';
            expectingProfessor = true;
            continue;
        }

        if (isFullSection) {
            flushProfessorBuffer();
            expectingProfessor = false;
            currentSeccion = sectionMatchFull![1].toUpperCase();
            retrofillOrphanSchedules(currentCodigo, currentSeccion);
            const rest = sectionMatchFull![2].trim();

            // Check: does the rest begin with a TIPO (inline schedule)?
            const firstOfRest = rest.split(/\s+/)[0].toUpperCase();
            if (TIPOS.has(firstOfRest)) {
                // Schedule is on the same line as section letter
                currentProfesor = 'Sin profesor';
                if (firstOfRest !== 'PRACCALIFI') {
                    // Push it back onto the queue to be processed by B1
                    queue.unshift(rest);
                }
            } else {
                // Professor name starts here; may continue on next line(s)
                professorBuffer = cleanProfName(rest);
                expectingProfessor = true;

                // CRITICAL FIX: If the line ALSO contains a schedule (e.g., squashed on the same line after the professor),
                // we must parse that schedule. `cleanProfName` removed it from the professor name, but we need to extract it.
                const tipoMatch = rest.match(/\b(CLASE|FINAL|PARCIAL|PRÁCTICA|PRACTICA|LABORATORIO|TALLER)\b/i);
                if (tipoMatch && hasTime(rest)) {
                    const schedPart = rest.slice(tipoMatch.index);
                    queue.unshift(schedPart);
                }
            }
            continue;
        }

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

        // B5. Inline schedule mixed with professor name or other text
        // (e.g. "PEREZ BARROS, Juan CLASE MIE 10:30 12:30 J-503")
        if (currentSeccion && hasTime(line) && !TIPOS.has(firstToken) && !DIAS.has(firstToken)) {
            const tipoMatch = line.match(/\b(CLASE|FINAL|PARCIAL|PRÁCTICA|PRACTICA|LABORATORIO|TALLER)\b/i);
            if (tipoMatch) {
                const schedPart = line.slice(tipoMatch.index);
                const profPart = line.slice(0, tipoMatch.index).trim();

                if (profPart && expectingProfessor) {
                    if (professorBuffer) professorBuffer += ' ' + cleanProfName(profPart);
                    else professorBuffer = cleanProfName(profPart);
                }

                // Instead of processing manually here, push it into the queue!
                // It will be picked up by B1.
                queue.unshift(schedPart);
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

            // Retro-fill professor for existing ofertas in the current section
            for (const oferta of ofertas) {
                if (oferta.codigo_curso === currentCodigo &&
                    oferta.seccion === currentSeccion &&
                    (!oferta.profesor || oferta.profesor === 'Sin profesor' || oferta.profesor.trim() === '')) {
                    oferta.profesor = currentProfesor;
                }
            }
        }
    }

    function retrofillOrphanSchedules(codigo: string, seccion: string) {
        for (const oferta of ofertas) {
            if (oferta.codigo_curso === codigo && oferta.seccion === '?') {
                oferta.seccion = seccion;
                // Professor retrofilling will be handled by flushProfessorBuffer
            }
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
function extractAulaWithIndex(lineTokensStr: string, timeMatch: string): { aula: string, endIndex: number } {
    const afterTime = lineTokensStr.slice(lineTokensStr.indexOf(timeMatch) + timeMatch.length);
    const words = afterTime.split(/\s+/).filter(Boolean);

    // Check next few tokens for typical class markers: "30 B-505" (30 cupos, aula B-505), "A-PEND", "VIRTUAL"
    let aula = 'POR ASIGNAR';
    let endWordIndex = 0;

    for (let i = 0; i < words.length; i++) {
        const w = words[i].toUpperCase();
        if (w.match(/^[A-Z]-\d{3}$/)) { // like B-505, J-603
            aula = w;
            endWordIndex = i;
            break;
        }
        if (w === 'A-PEND' || w === 'VIRTUAL' || w === 'C-CRAI' || w === 'J-AUD' || w === 'POR ASIGNAR') {
            aula = w;
            endWordIndex = i;
            break;
        }
    }

    // Now calculate where this aula actually ends in the ORIGINAL string so we can chop it!
    let endIndex = lineTokensStr.length;
    if (aula !== 'POR ASIGNAR') {
        const originalAulaMatchIndex = lineTokensStr.indexOf(aula, lineTokensStr.indexOf(timeMatch));
        if (originalAulaMatchIndex !== -1) {
            endIndex = originalAulaMatchIndex + aula.length;
        }
    } else {
        // If we didn't find an aula, but we know there's text (and maybe a cupos number like "30"), let's just 
        // chop off the string immediately after the cupos number if it exists.
        // It usually follows: TIME TIME CUPOS AULA. e.g "17:30 19:20 30 B-505". If B-505 is missing: "17:30 19:20 30"
        if (words.length > 0 && /^\d+$/.test(words[0])) {
            const cuposNumber = words[0];
            const originalCuposMatchIndex = lineTokensStr.indexOf(cuposNumber, lineTokensStr.indexOf(timeMatch));
            if (originalCuposMatchIndex !== -1) {
                endIndex = originalCuposMatchIndex + cuposNumber.length;
            }
        }
    }

    return { aula, endIndex };
}

/** Normalize tipo names */
function normalizeTipo(raw: string): string {
    const u = raw.toUpperCase();
    if (u === 'PRACTICA' || u === 'PRÁCTICA') return 'PRACTICA';
    if (u === 'PRACDIRIGI') return 'PRACTICA';
    if (u === 'PRACCALIFI') return 'PRACCALIFI'; // should already be skipped
    return u;
}

const PROF_NOISE = [
    /Dictado en Ingl[ée]s\.?/ig,
    /DOBLE GRADO\.?/ig,
    /Virtual(?:\s*\/?\s*Presencial)?\.?/ig,
    /Pr[áa]cticas? quincenales?\.?/ig,
    /Pr[áa]cticas? (?:quincenal )?(?:semana )?(?:par|impar):.*?\./ig,
    /La sesiones de los d[ií]as martes son virtuales\.?/ig,
    /Clases teóricas presenciales.*?\./ig,
    /Fechas de clases pr[áa]cticas.*?\sasincr[óo]nicas/ig,
    /Del lunes .*? pm/ig,
    /Presentaci[óo]n final:.*?pm/ig,
    /Curso Faculty Led Program/ig,
    /Clases previas:.*?pm/ig,
    /Revisar fechas en web ORI\.?/ig,
    /Curso de la Semana Internacional\.?/ig,
    /Clases del \d{2}\/\d{2}\/\d{4} al \d{2}\/\d{2}\/\d{4}\.?/ig,
    /Codictado\..*?-\s*Prof\.\s*[A-Za-zÁÉÍÓÚÑáéíóúñ\s]+/ig,
    /Las primeras tres semanas.*?Virtual \/ Presencial/ig,
    /Las sesiones de clase y las.*?manera virtual\./ig,
    /La primera semana de clases.*?d[ií]as mi[ée]rcoles/ig,
    /La primera semana de clases.*?d[ií]as viernes\.?/ig,
    /Las asesor[íi]as se realizar[áa]n virtualmente\..*?Presencial/ig,
    /Las asesor[íi]as se realizar[áa]n presencialmente.*?s[áa]bados\.?/ig,
    /Clases te[óo]ricas presenciales.*?clases virtuales\..*?Presencial/ig
];

/** Clean up a raw professor name string */
function cleanProfName(raw: string): string {
    // 1. Cut at first TIPO keyword because everything after is the schedule part
    const tipoIdx = raw.search(/\b(CLASE|FINAL|PARCIAL|PRÁCTICA|PRACTICA|LABORATORIO|TALLER)\b/i);
    if (tipoIdx > 0) raw = raw.slice(0, tipoIdx);

    // 2. Iteratively strip noise phrases until stable
    let prev = "";
    while (raw !== prev) {
        prev = raw;
        for (const re of PROF_NOISE) {
            raw = raw.replace(re, ' ').trim();
        }
        // Remove dangling standalone times like "09:30 a 11:20."
        raw = raw.replace(/^\d{1,2}:\d{2}\s+a\s+\d{1,2}:\d{2}\.?\s*/i, ' ').trim();
        // Remove dangling word "Viernes" if left at start
        raw = raw.replace(/^(Lunes|Martes|Mi[ée]rcoles|Jueves|Viernes|S[áa]bado|Domingo)\s*/i, ' ').trim();
    }

    // 3. Last fallback: if there is still an actual time left in the string, cut it
    const timeIdx = raw.search(/\b\d{1,2}:\d{2}\b/);
    if (timeIdx > 0) raw = raw.slice(0, timeIdx);

    // 4. Remove trailing numbers, tabs, extra whitespace
    return raw.replace(/\s+\d+\s*$/, '').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
}

// Backward compat
export const parseOfertaPDF = parseOfertaFile;
