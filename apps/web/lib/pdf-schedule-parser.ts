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
    tipo: string;       // CLASE, FINAL, PARCIAL
    dia: string;        // LUN, MAR, MIE, JUE, VIE, SAB, DOM
    hora_inicio: string; // HH:MM
    hora_fin: string;    // HH:MM
    duracion: number;
    cupos: number;
    aula: string;
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
                    // Use a heuristic: if items are close, use space; if far, use tab
                    const gap = curr.x - (prev.x + prev.text.length * 4); // rough estimate of width
                    if (gap > 20) {
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

    if (!periodo) {
        periodo = 'Periodo sin identificar';
    }

    const rawOfertas: ParsedOferta[] = [];
    const errors: string[] = [];

    let currentCodigo = '';
    let currentNombre = '';
    let currentCreditos = 0;
    let currentSeccion = '';
    let currentProfesor = '';

    for (const line of uniqueLines) {
        const parts = line.split('\t').map(p => p.trim()).filter(Boolean);
        if (parts.length === 0) continue;

        // Skip header/footer noise
        if (parts.some(p => /^(Secc|Tipo|Docentes|Cred|Teoría|Día|Horario|Duración|Cupos|Aula|Horarios Ofertados)$/i.test(p))) {
            continue;
        }
        if (parts.some(p => /^(CURSOS ACAD|Dirección de|Horas Tot|Periodo Acad|Se sugiere revisar)/i.test(p))) {
            continue;
        }
        if (parts.some(p => /^PREREQUISITO/i.test(p))) {
            continue;
        }

        // Detect course header line: starts with course code (6 digits) + dash + name
        const courseHeaderMatch = line.match(/(\d{6})\s*[-–]\s*(.+)/);
        if (courseHeaderMatch) {
            currentCodigo = courseHeaderMatch[1];
            let namePart = courseHeaderMatch[2].trim();

            const creditMatch = line.match(/(\d+[.,]\d+)\s*$/);
            if (creditMatch) {
                currentCreditos = parseFloat(creditMatch[1].replace(',', '.'));
                namePart = namePart.replace(creditMatch[0], '').trim();
            }

            currentNombre = namePart;
            currentSeccion = '';
            currentProfesor = '';
            continue;
        }

        // Detect standalone credits line
        const standaloneCredits = line.match(/^\s*(\d+[.,]\d+)\s*$/);
        if (standaloneCredits && currentCodigo) {
            currentCreditos = parseFloat(standaloneCredits[1].replace(',', '.'));
            continue;
        }

        // Section Detection: starts with section letter (usually col 0 or 1)
        const firstPart = parts[0];
        const isSectionStart = /^[A-Z0-9]$/.test(firstPart);

        if (isSectionStart && currentCodigo) {
            if (currentSeccion !== firstPart) {
                currentSeccion = firstPart;
                currentProfesor = ''; // Reset for new section
            }

            // Try to find professor in the line
            // It's usually the part that doesn't have numbers or schedule types
            for (let i = 1; i < parts.length; i++) {
                const part = parts[i];
                if (!TIPOS_VALIDOS.includes(part.toUpperCase()) &&
                    !DIAS_VALIDOS.some(d => part.toUpperCase().includes(d)) &&
                    !TIME_REGEX.test(part) &&
                    part.length > 5 && // Name usually reasonably long
                    /[A-Z]/.test(part)) {
                    currentProfesor = part;
                    break;
                }
            }
        }

        // Schedule Detection
        if (currentCodigo) {
            const tipo = parts.find(p => TIPOS_VALIDOS.includes(p.toUpperCase()));
            const dia = parts.find(p => DIAS_VALIDOS.includes(p.toUpperCase()));
            const timeMatch = line.match(TIME_REGEX);

            if (dia && timeMatch) {
                const hora_inicio = timeMatch[1];
                const hora_fin = timeMatch[2];

                const [h1, m1] = hora_inicio.split(':').map(Number);
                const [h2, m2] = hora_fin.split(':').map(Number);
                const duracion = (h2 * 60 + m2) - (h1 * 60 + m1);

                let cupos = 0;
                let aula = '';

                // Look for cupos and aula after the time
                const timeIndex = parts.findIndex(p => p.includes(hora_inicio) || p.includes(hora_fin));
                if (timeIndex !== -1) {
                    const remaining = parts.slice(timeIndex + 1);
                    const cuposPart = remaining.find(p => /^\d+$/.test(p));
                    if (cuposPart) cupos = parseInt(cuposPart);

                    const aulaPart = remaining.find(p => /([A-Z]-?\d{3}|[A-Z]-?PEND|X\s*-\d{3})/i.test(p));
                    if (aulaPart) aula = aulaPart.replace(/\s+/g, '');
                }

                rawOfertas.push({
                    codigo_curso: currentCodigo,
                    nombre_curso: currentNombre,
                    seccion: currentSeccion || 'A',
                    profesor: currentProfesor || 'Sin profesor',
                    creditos: currentCreditos,
                    tipo: (tipo || 'CLASE').toUpperCase(),
                    dia: dia.toUpperCase(),
                    hora_inicio,
                    hora_fin,
                    duracion: duracion > 0 ? duracion : 0,
                    cupos,
                    aula,
                });
            }
        }
    }

    // De-duplicate final results (same course, section, day, time, type)
    const seen = new Set<string>();
    const ofertas = rawOfertas.filter(o => {
        const key = `${o.codigo_curso}|${o.seccion}|${o.dia}|${o.hora_inicio}|${o.hora_fin}|${o.tipo}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    if (ofertas.length === 0) {
        errors.push('No se encontraron horarios en el archivo. Verifica que el formato sea correcto.');
    }

    return { periodo, ofertas, errors };
}

// Keep backward compatibility
export const parseOfertaPDF = parseOfertaFile;
