import fs from 'fs';
import path from 'path';

const INPUT_FILE = path.join(process.cwd(), 'OFERTA_IMPORT.txt');

/**
 * Parse TSV with proper handling of quoted fields containing newlines (RFC 4180).
 * Returns an array of rows, where each row is an array of string fields.
 */
function parseTSV(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
        const ch = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (ch === '"' && next === '"') {
                // Escaped quote
                field += '"';
                i += 2;
            } else if (ch === '"') {
                // End of quoted field
                inQuotes = false;
                i++;
            } else {
                field += ch;
                i++;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
                i++;
            } else if (ch === '\t') {
                row.push(field.trim());
                field = '';
                i++;
            } else if (ch === '\r' && next === '\n') {
                row.push(field.trim());
                rows.push(row);
                row = [];
                field = '';
                i += 2;
            } else if (ch === '\n' || ch === '\r') {
                row.push(field.trim());
                rows.push(row);
                row = [];
                field = '';
                i++;
            } else {
                field += ch;
                i++;
            }
        }
    }
    // Last field/row
    if (field.length > 0 || row.length > 0) {
        row.push(field.trim());
        rows.push(row);
    }

    return rows;
}

function normalizeType(raw: string): string {
    const upper = (raw || '').toUpperCase();
    if (upper.includes('CLASE')) return 'CLASE';
    if (upper.includes('PARCIAL')) return 'PARCIAL';
    if (upper.includes('FINAL')) return 'FINAL';
    if (upper.includes('PRÁCTICA') || upper.includes('PRACTICA') || 
        upper.includes('PRACCALIFI') || upper.includes('PRACDIRIGI')) return 'PRACTICA';
    return 'CLASE';
}

function parseTSVOffer(rows: string[][]) {
    const courses: any[] = [];
    let currentCourse: any = null;
    let currentSection: any = null;

    // Course header: col0 matches CODE - NAME, col3 matches credits (e.g. "4.00")
    const COURSE_CODE_RE = /^([A-Z0-9]{4,7})\s*-\s*(.+)$/i;
    const CREDITS_RE = /^\d+\.\d{2}$/;

    // Valid days
    const DAYS = new Set(['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM']);
    // Valid schedule types
    const SCHED_TYPES = new Set(['CLASE', 'FINAL', 'PARCIAL', 'PRÁCTICA', 'PRACTICA', 'PRACCALIFI', 'PRACDIRIGI']);
    function isSchedType(s: string) {
        const u = (s || '').toUpperCase();
        return [...SCHED_TYPES].some(t => u.includes(t));
    }

    // Single capital letter
    const LETTER_RE = /^[A-Z]$/;

    for (const cols of rows) {
        // Pad to at least 11 columns
        while (cols.length < 11) cols.push('');

        const c0 = cols[0] || ''; // Secc
        const c1 = cols[1] || ''; // Tipo/nota
        const c2 = cols[2] || ''; // Docentes
        const c3 = cols[3] || ''; // TipoHorario or Credits
        const c5 = cols[5] || ''; // Día
        const c6 = cols[6] || ''; // HoraInicio
        const c7 = cols[7] || ''; // HoraFin
        const c9 = cols[9] || ''; // Cupos
        const c10 = cols[10] || ''; // Aula

        // Skip header rows
        if (c0 === 'Secc' || c0 === 'CURSOS ACADÉMICOS') continue;
        // Skip completely empty rows
        if (cols.every(c => c === '')) continue;

        // --- COURSE HEADER ---
        // Pattern: col0 = "CODE - NAME", col3 = "4.00"
        const courseMatch = c0.match(COURSE_CODE_RE);
        if (courseMatch && CREDITS_RE.test(c3)) {
            currentCourse = {
                codigo: courseMatch[1].trim(),
                nombre: courseMatch[2].trim(),
                creditos: c3,
                sections: []
            };
            courses.push(currentCourse);
            currentSection = null;
            continue;
        }

        if (!currentCourse) continue;

        // --- NEW SECTION ROW ---
        // col0 = single letter, col2 = professor name (non-empty)
        if (LETTER_RE.test(c0) && c2.length > 0) {
            const isVirtual = /virtual/i.test(c1) || /virtual/i.test(c10);
            currentSection = {
                letra: c0,
                virtual: isVirtual,
                nota: c1,
                profesor: c2,
                schedules: []
            };
            currentCourse.sections.push(currentSection);

            // This row may also have a schedule entry
            if (isSchedType(c3) && DAYS.has(c5) && c6 && c7) {
                currentSection.schedules.push({
                    tipo: normalizeType(c3),
                    dia: c5,
                    inicio: c6,
                    fin: c7,
                    cupos: c9,
                    aula: c10
                });
            }
            continue;
        }

        // --- CONTINUATION SCHEDULE ROW ---
        // col0 empty, col2 empty, col3 = schedule type, col5 = day
        if (c0 === '' && c2 === '' && isSchedType(c3) && DAYS.has(c5) && c6 && c7) {
            if (currentSection) {
                currentSection.schedules.push({
                    tipo: normalizeType(c3),
                    dia: c5,
                    inicio: c6,
                    fin: c7,
                    cupos: c9,
                    aula: c10
                });
            }
            continue;
        }

        // Everything else: prerequisite continuation, notes, etc. — skip
    }

    return courses;
}

const rawText = fs.readFileSync(INPUT_FILE, 'utf-8');
const rows = parseTSV(rawText);
console.error(`Total TSV rows parsed: ${rows.length}`);

const parsedData = parseTSVOffer(rows);

// Stats
const totalSections = parsedData.reduce((acc, c) => acc + c.sections.length, 0);
const totalBlocks = parsedData.reduce((acc, c) => acc + c.sections.reduce((a: number, s: any) => a + s.schedules.length, 0), 0);
const zeroSectionCourses = parsedData.filter(c => c.sections.length === 0);
const zeroBlockSections = parsedData.flatMap(c =>
    c.sections.filter((s: any) => s.schedules.length === 0).map((s: any) => `${c.codigo}-${s.letra} (${s.profesor})`)
);

console.error(`\nParsing complete:`);
console.error(`  Courses:         ${parsedData.length}`);
console.error(`  Sections:        ${totalSections}`);
console.error(`  Schedule blocks: ${totalBlocks}`);
console.error(`  Courses with 0 sections: ${zeroSectionCourses.length}`);
zeroSectionCourses.forEach(c => console.error(`    -> ${c.codigo} - ${c.nombre}`));
console.error(`  Sections with 0 blocks: ${zeroBlockSections.length}`);
zeroBlockSections.forEach(s => console.error(`    -> ${s}`));

// Sample verification
console.error('\n--- Sample verification ---');
parsedData.slice(0, 4).forEach(c => {
    console.error(`${c.codigo} - ${c.nombre} (${c.creditos} cr, ${c.sections.length} secs)`);
    c.sections.slice(0, 2).forEach((s: any) => {
        console.error(`  [${s.letra}] ${s.profesor} | ${s.schedules.length} blocks`);
        s.schedules.slice(0, 2).forEach((b: any) => console.error(`      ${b.tipo} ${b.dia} ${b.inicio}-${b.fin} | ${b.aula}`));
    });
});

fs.writeFileSync('parsed_offer.json', JSON.stringify(parsedData, null, 2), 'utf-8');
console.error(`\nSaved to parsed_offer.json`);
