/**
 * Schedule Parser
 * Parses university academic offering from PDF or Word (.docx) files.
 * Uses pdfjs-dist for PDFs and mammoth for Word documents.
 */

export type ParsedOferta = {
    codigo_curso: string;
    nombre_curso: string;
    seccion: string;
    profesor: string;
    creditos: number;
    tipo: string;       // CLASE, FINAL, PARCIAL, PRACTICA
    dia: string;        // LUN, MAR, MIE, JUE, VIE, SAB, DOM
    hora_inicio: string; // HH:MM
    hora_fin: string;    // HH:MM
    duracion: number;
    cupos: number;
    aula: string;
    section_id?: string; // codigo_curso-seccion
};

const DIAS_VALIDOS = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];
const TIPOS_VALIDOS = ['CLASE', 'FINAL', 'PARCIAL', 'LABORATORIO', 'TALLER', 'PRÁCTICA', 'PRACCALIFI', 'PRACDIRIGI'];
const TIME_REGEX = /(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})/;

/**
 * Main entry point: auto-detects file type and parses accordingly.
 */
export async function parseOfertaFile(file: File): Promise<{
    periodo: string;
    ofertas: ParsedOferta[];
    errors: string[];
}> {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'pdf') {
        return parseFromPDF(file);
    } else if (ext === 'docx' || ext === 'doc') {
        return parseFromWord(file);
    } else {
        return { periodo: '', ofertas: [], errors: [`Formato no soportado: .${ext}. Usa PDF o Word (.docx).`] };
    }
}

/**
 * Parse from PDF using pdfjs-dist
 */
async function parseFromPDF(file: File): Promise<{
    periodo: string;
    ofertas: ParsedOferta[];
    errors: string[];
}> {
    const pdfjsLib = await import('pdfjs-dist');

    if (typeof window !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
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
                    // Relaxed heuristic: if gap is small, use space. 
                    // 12px is usually enough to distinguish separate columns in these PDFs.
                    const gap = curr.x - (prev.x + prev.text.length * 4);
                    if (gap > 12) {
                        lineText += '\t';
                    } else {
                        lineText += ' ';
                    }
                }
                lineText += items[j].text;
            }
            allLines.push(lineText);
        }
    }

    return parseLines(allLines);
}

/**
 * Parse from Word (.docx) using mammoth
 */
async function parseFromWord(file: File): Promise<{
    periodo: string;
    ofertas: ParsedOferta[];
    errors: string[];
}> {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();

    // Extract raw text from the Word document
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value;

    // Split into lines
    const allLines = text.split('\n').map(line => line.trim()).filter(Boolean);

    return parseLines(allLines);
}

/**
 * Common line parser — works for both PDF and Word extracted text.
 */
function parseLines(allLines: string[]): {
    periodo: string;
    ofertas: ParsedOferta[];
    errors: string[];
} {
    let periodo = '';

    // De-duplicate raw lines to handle PDF extraction artifacts (layered text)
    const uniqueLines: string[] = [];
    for (let i = 0; i < allLines.length; i++) {
        if (i === 0 || allLines[i] !== allLines[i - 1]) {
            uniqueLines.push(allLines[i]);
        }
    }

    // Try to extract periodo from header lines
    for (const line of uniqueLines.slice(0, 20)) {
        const periodoMatch = line.match(/Horarios\s+ofertados:\s*(.+)/i) || line.match(/Horarios\s+Ofertados:\s*(.+)/i);
        if (periodoMatch) {
            periodo = periodoMatch[1].trim();
            break;
        }
        const simpleMatch = line.match(/(\d{4}-[IV]+\s*(?:PERIODO[- ]?\w*)?)/i);
        if (simpleMatch) {
            periodo = simpleMatch[1].trim();
            break;
        }
    }

    if (!periodo) periodo = 'Periodo sin identificar';

    const rawOfertas: ParsedOferta[] = [];
    const errors: string[] = [];

    let currentCodigo = '';
    let currentNombre = '';
    let currentCreditos = 0;
    let currentSeccion = '';
    let currentProfesor = '';

    // State Mapping for preventing duplicates (The Shield)
    const sectionsSeen = new Set<string>(); // "Course-Letter"
    const blocksSeen = new Set<string>();   // "Course-Letter-Type-Day-Start-End"

    // Robust Regex patterns for anchors
    const courseHeaderPattern = /^(\d{6})\s*[-–]\s*(.+)/;
    const sectionAnchorPattern = /^[A-Z]\s{2,}/; // Matches "A  " at start of line
    const diaRegex = new RegExp(`\\b(${DIAS_VALIDOS.join('|')})\\b`, 'i');
    const tipoRegex = new RegExp(`\\b(${TIPOS_VALIDOS.join('|')})\\b`, 'i');

    for (const line of uniqueLines) {
        const columns = line.split('\t').map(p => p.trim());
        const rawLine = line.trim();
        if (!rawLine) continue;

        // Skip noise
        if (rawLine.includes('Se sugiere revisar') || rawLine.includes('Dirección de Asuntos')) continue;

        // 1. Course Header Detection (Anchor: ^\d{6} - )
        const courseHeaderMatch = rawLine.match(courseHeaderPattern);
        if (courseHeaderMatch) {
            currentCodigo = courseHeaderMatch[1];
            let namePart = courseHeaderMatch[2].trim();
            const creditMatch = rawLine.match(/(\d+[.,]\d+)\s*$/);
            if (creditMatch) {
                currentCreditos = parseFloat(creditMatch[1].replace(',', '.'));
                namePart = namePart.replace(creditMatch[0], '').trim();
            }
            currentNombre = namePart;
            currentSeccion = '';
            currentProfesor = '';
            continue;
        }

        if (!currentCodigo) continue;

        // 2. Section Detection (Anchor: ^[A-Z]  )
        // Check both the raw line start AND the first column
        const startsWithSection = sectionAnchorPattern.test(rawLine);
        const firstCol = columns[0];
        const isSectionLine = startsWithSection || (firstCol && /^[A-Z]$/.test(firstCol));

        if (isSectionLine) {
            const letter = (startsWithSection ? rawLine[0] : firstCol).toUpperCase();
            const sectionId = `${currentCodigo}-${letter}`;

            // State Logic: If it's a new course-letter combination
            if (!sectionsSeen.has(sectionId)) {
                sectionsSeen.add(sectionId);
                currentSeccion = letter;

                // Extract teacher if present in this line
                const profMatch = rawLine.match(/[A-ZÀ-ÿ]{4,}\s+[A-ZÀ-ÿ\s]{2,},\s+[A-ZÀ-ÿ\s]{2,}/i);
                if (profMatch) {
                    let prof = profMatch[0].trim();
                    const cleaners = [...DIAS_VALIDOS, ...TIPOS_VALIDOS];
                    prof = prof.replace(new RegExp(`\\s(${cleaners.join('|')})(\\s|$)`, 'i'), '').trim();
                    currentProfesor = prof;
                } else {
                    currentProfesor = 'Sin profesor';
                }
            } else {
                // Return state for continuation lines (page breaks)
                currentSeccion = letter;
            }
        }

        // 3. Schedule Block Detection (Anchor: Time + Day)
        const diaMatch = rawLine.match(diaRegex);
        const timeMatch = rawLine.match(TIME_REGEX);

        if (diaMatch && timeMatch && currentSeccion) {
            const dia = diaMatch[1].toUpperCase();
            const startStr = timeMatch[1];
            const endStr = timeMatch[2];

            let tipo = 'CLASE';
            const typeMatch = rawLine.match(tipoRegex);
            if (typeMatch) {
                const rawTipo = typeMatch[1].toUpperCase();
                if (rawTipo === 'PRACDIRIGI' || rawTipo === 'PRACCALIFI' || rawTipo === 'PRÁCTICA') {
                    tipo = 'PRACTICA';
                } else if (['FINAL', 'PARCIAL'].includes(rawTipo)) {
                    tipo = rawTipo;
                }
            }

            // The Shield: In-memory duplicate prevention
            const blockKey = `${currentCodigo}-${currentSeccion}-${tipo}-${dia}-${startStr}-${endStr}`;
            if (blocksSeen.has(blockKey)) continue;
            blocksSeen.add(blockKey);

            const [h1, m1] = startStr.split(':').map(Number);
            const [h2, m2] = endStr.split(':').map(Number);
            const duracion = (h2 * 60 + m2) - (h1 * 60 + m1);

            let aula = 'PEND';
            const aulaPart = rawLine.match(/([A-Z]-?\d{3}|[A-Z]-?PEND|X\s*-\d{3})/i);
            if (aulaPart) aula = aulaPart[0].replace(/\s+/g, '');

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

    const ofertas = rawOfertas;


    if (ofertas.length === 0) {
        errors.push('No se encontraron horarios en el archivo. Verifica que el formato sea correcto.');
    }

    return { periodo, ofertas, errors };
}

// Keep backward compatibility
export const parseOfertaPDF = parseOfertaFile;
