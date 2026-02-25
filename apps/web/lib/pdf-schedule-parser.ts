/**
 * PDF Schedule Parser
 * Parses the university academic offering PDF into structured data.
 * Uses pdfjs-dist to extract text, then pattern-matches the tabular format.
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
const TIPOS_VALIDOS = ['CLASE', 'FINAL', 'PARCIAL', 'LABORATORIO', 'TALLER', 'PRÁCTICA'];
const TIME_REGEX = /(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})/;

/**
 * Parse the academic offering PDF file.
 * Returns an array of structured course entries.
 */
export async function parseOfertaPDF(file: File): Promise<{
    periodo: string;
    ofertas: ParsedOferta[];
    errors: string[];
}> {
    const pdfjsLib = await import('pdfjs-dist');

    // Set worker
    if (typeof window !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const allLines: string[] = [];
    let periodo = '';

    // Extract text from all pages
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Group text items by Y position to reconstruct lines
        const lineMap = new Map<number, Array<{ x: number; text: string }>>();

        for (const item of textContent.items) {
            if ('str' in item && item.str.trim()) {
                const y = Math.round((item as any).transform[5]);
                const x = Math.round((item as any).transform[4]);
                if (!lineMap.has(y)) lineMap.set(y, []);
                lineMap.get(y)!.push({ x, text: item.str.trim() });
            }
        }

        // Sort lines by Y (descending because PDF Y is bottom-up) then items by X
        const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
        for (const y of sortedYs) {
            const items = lineMap.get(y)!.sort((a, b) => a.x - b.x);
            const lineText = items.map(i => i.text).join('\t');
            allLines.push(lineText);
        }
    }

    // Try to extract periodo from header lines
    for (const line of allLines.slice(0, 10)) {
        const periodoMatch = line.match(/Horarios\s+ofertados:\s*(.+)/i);
        if (periodoMatch) {
            periodo = periodoMatch[1].trim();
            break;
        }
        // Also try simpler pattern
        const simpleMatch = line.match(/(\d{4}-[IV]+\s*(?:PERIODO[- ]?\w*)?)/i);
        if (simpleMatch) {
            periodo = simpleMatch[1].trim();
            break;
        }
    }

    if (!periodo) {
        periodo = 'Periodo sin identificar';
    }

    const ofertas: ParsedOferta[] = [];
    const errors: string[] = [];

    let currentCodigo = '';
    let currentNombre = '';
    let currentCreditos = 0;
    let currentSeccion = '';
    let currentProfesor = '';

    for (const line of allLines) {
        const parts = line.split('\t').map(p => p.trim()).filter(Boolean);
        if (parts.length === 0) continue;

        // Skip header lines
        if (parts.some(p => /^(Secc|Tipo|Docentes|Cred|Teoría|Día|Horario|Duración|Cupos|Aula)$/i.test(p))) {
            continue;
        }
        if (parts.some(p => /^(CURSOS ACAD|Dirección de|Horarios ofertados)/i.test(p))) {
            continue;
        }
        if (parts.some(p => /^PREREQUISITO/i.test(p))) {
            continue;
        }

        // Detect course header line: starts with course code (6 digits) + dash + name
        const courseHeaderMatch = line.match(/(\d{6})\s*[-–]\s*(.+)/);
        if (courseHeaderMatch) {
            currentCodigo = courseHeaderMatch[1];
            // The name may have extra text after it, including credits
            let namePart = courseHeaderMatch[2].trim();

            // Try to extract credits from the same line
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

        // Detect standalone credits line (just a number like "4,00" or "4.00")
        const standaloneCredits = line.match(/^\s*(\d+[.,]\d+)\s*$/);
        if (standaloneCredits && currentCodigo) {
            currentCreditos = parseFloat(standaloneCredits[1].replace(',', '.'));
            continue;
        }

        // Detect section line: single letter (A, B, C...) possibly followed by professor name
        const sectionMatch = parts[0].match(/^([A-Z])$/);
        if (sectionMatch && currentCodigo) {
            currentSeccion = sectionMatch[1];
            // Professor name might be in the next column
            if (parts.length > 1) {
                const possibleProf = parts.slice(1).join(' ');
                // Check it's not a tipo or dia
                if (!TIPOS_VALIDOS.includes(possibleProf.toUpperCase()) && !DIAS_VALIDOS.includes(possibleProf.toUpperCase())) {
                    currentProfesor = possibleProf;
                }
            }
            continue;
        }

        // Detect schedule line: contains TIPO + DIA + HORARIO
        if (currentCodigo) {
            const tipo = parts.find(p => TIPOS_VALIDOS.includes(p.toUpperCase()));
            const dia = parts.find(p => DIAS_VALIDOS.includes(p.toUpperCase()));
            const timeMatch = line.match(TIME_REGEX);

            if (dia && timeMatch) {
                const hora_inicio = timeMatch[1];
                const hora_fin = timeMatch[2];

                // Calculate duration in minutes
                const [h1, m1] = hora_inicio.split(':').map(Number);
                const [h2, m2] = hora_fin.split(':').map(Number);
                const duracion = (h2 * 60 + m2) - (h1 * 60 + m1);

                // Try to extract cupos and aula from remaining parts
                let cupos = 0;
                let aula = '';

                // Look for a number that could be cupos (usually 20-50 range)
                const numericParts = parts.filter(p => /^\d+$/.test(p));
                if (numericParts.length > 0) {
                    // The cupos is usually the first standalone number
                    cupos = parseInt(numericParts[0]) || 0;
                }

                // Look for aula pattern (letter + dash + number like "A-206" or "J-603" or "A-PEND")
                const aulaMatch = line.match(/([A-Z]-?\d{3}|[A-Z]-?PEND)/i);
                if (aulaMatch) {
                    aula = aulaMatch[1];
                }

                ofertas.push({
                    codigo_curso: currentCodigo,
                    nombre_curso: currentNombre,
                    seccion: currentSeccion || 'A',
                    profesor: currentProfesor,
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

    if (ofertas.length === 0) {
        errors.push('No se encontraron horarios en el PDF. Verifica que el formato sea correcto.');
    }

    return { periodo, ofertas, errors };
}
