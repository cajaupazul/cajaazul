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

    // Regex for schedule indicators with word boundaries to be bullet-proof
    const tipoRegex = new RegExp(`\\b(${TIPOS_VALIDOS.join('|')})\\b`, 'i');
    const diaRegex = new RegExp(`\\b(${DIAS_VALIDOS.join('|')})\\b`, 'i');

    for (const line of uniqueLines) {
        // Normalization: treat multiple spaces or tabs as column separators
        const parts = line.split(/[\t]+| {3,}/).map(p => p.trim()).filter(Boolean);
        if (parts.length === 0) continue;

        // Skip header/footer noise
        if (parts.some(p => /^(Secc|Tipo|Docentes|Cred|Teoría|Día|Horario|Duración|Cupos|Aula|Horarios Ofertados)$/i.test(p))) continue;
        if (parts.some(p => /^(CURSOS ACAD|Dirección de|Horas Tot|Periodo Acad|Se sugiere revisar)/i.test(p))) continue;

        // Course Header Detection
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

        // Section Detection
        // Look for standalone single char at the beginning or after a tab
        const sectionMatch = line.match(/(?:^|[\t])\s*([A-Z0-9])\s*[\t ]/);
        if (sectionMatch && currentCodigo) {
            const potentialSec = sectionMatch[1];
            if (currentSeccion !== potentialSec) {
                currentSeccion = potentialSec;
                currentProfesor = '';
            }
        }

        // Professor Detection (resilient to column merging)
        // If the line has many words but no dia/time, it's likely a professor
        if (currentCodigo && !diaRegex.test(line) && !TIME_REGEX.test(line)) {
            const cleanedLine = line.replace(/^[A-Z0-9]\s+/, '').trim(); // Remove leading section if any
            if (cleanedLine.length > 8 && /[A-Z]/.test(cleanedLine) && !cleanedLine.includes('PREREQUISITO')) {
                currentProfesor = cleanedLine;
            }
        }

        // Schedule Detection
        const timeMatch = line.match(TIME_REGEX);
        const diaMatch = line.match(diaRegex);

        if (currentCodigo && diaMatch && timeMatch) {
            const dia = diaMatch[1].toUpperCase();
            const tipoMatch = line.match(tipoRegex);
            const tipo = tipoMatch ? tipoMatch[1].toUpperCase() : 'CLASE';

            const hora_inicio = timeMatch[1];
            const hora_fin = timeMatch[2];
            const [h1, m1] = hora_inicio.split(':').map(Number);
            const [h2, m2] = hora_fin.split(':').map(Number);
            const duracion = (h2 * 60 + m2) - (h1 * 60 + m1);

            // Resilient cupos/aula extraction
            let cupos = 0;
            let aula = '';
            const afterTime = line.split(timeMatch[0])[1] || '';
            const afterParts = afterTime.split(/[\t ]+/).filter(Boolean);

            const cuposPart = afterParts.find(p => /^\d+$/.test(p));
            if (cuposPart) cupos = parseInt(cuposPart);

            const aulaPart = afterParts.find(p => /([A-Z]-?\d{3}|[A-Z]-?PEND|X\s*-\d{3})/i.test(p));
            if (aulaPart) aula = aulaPart.replace(/\s+/g, '');

            rawOfertas.push({
                codigo_curso: currentCodigo,
                nombre_curso: currentNombre,
                seccion: currentSeccion || 'A',
                profesor: currentProfesor || 'Sin profesor',
                creditos: currentCreditos,
                tipo,
                dia,
                hora_inicio,
                hora_fin,
                duracion: duracion > 0 ? duracion : 0,
                cupos,
                aula: aula || 'PEND',
            });
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
