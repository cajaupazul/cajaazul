const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'apps/web/lib/pdf-schedule-parser.ts'), 'utf8');

// A very aggressive regex stripper that only keeps JS
const strippedCode = code
    .replace(/export async function/g, 'async function')
    .replace(/export function/g, 'function')
    .replace(/import .* from .*/g, '')
    .replace(/type [a-zA-Z0-9_]+ = [^;]+;/g, '')
    .replace(/: [a-zA-Z0-9_<>{}\\[\\]| ']+/g, (match) => {
        if (match.includes('=>') && !match.includes('{')) return match;
        if (match.startsWith(':')) return '';
        return match;
    })
    .replace(/<ParsedOferta\\[\\]>/g, '')
    .replace(/<[A-Za-z]+>/g, '')
    .replace(/ as any/g, '');

const finalJS = `
${strippedCode}

module.exports = { parseLines };
`;

fs.writeFileSync(path.join(__dirname, 'test-parser.js'), finalJS);

try {
    const { parseLines } = require('./test-parser.js');
    console.log("MODULE LOADED SUCCESSFULLY");

    // Exact structure matching the user's Excel paste format:
    const text = "180350 - Sociedades\\t4,00\\tPREREQUISITO: 180276\\n" +
        "\\t\\tCLASE\\tJUE\\t10:30\\t13:20\\t35\\tA-505\\n" +
        "A\\tRAMIREZ OTERO, Lorena\\tFINAL\\tMIE\\t07:30\\t09:30\\t35\\tA-PEND\\n" +
        "\\t\\tPARCIAL\\tMIE\\t07:30\\t09:30\\t35\\tA-PEND\\n" +
        "\\t\\tPRACTICA\\tMAR\\t14:30\\t16:20\\t35\\tH-507\\n" +
        "180317 - Técnicas de Persuasión y Moot Court\\t3,00\\tPREREQUISITO: bla\\n" +
        "A\\tFREITAS CABANILLAS, Rodrigo\\tCLASE\\tLUN\\t07:30\\t10:20\\t30\\tX-401\\n" +
        "180282 - Teoría General del Proceso\\t4,00\\tPREREQUISITO: 185099\\n" +
        "\\t\\tCLASE\\tJUE\\t18:30\\t20:20\\t30\\tA-406\\n" +
        "A\\tSIMONS PINO, Adrian\\tCLASE\\tMAR\\t18:30\\t20:20\\t30\\tA-406\\n" +
        "\\t\\tFINAL\\tVIE\\t10:30\\t12:30\\t30\\tA-PEND\\n" +
        "\\t\\tPARCIAL\\tVIE\\t10:30\\t12:30\\t30\\tA-PEND\\n" +
        "B\\tCHIRINOS VIDAURRAZAGA, Gonzalo\\tCLASE\\tLUN\\t07:30\\t09:20\\t30\\tH-303\\n" +
        "\\t\\tCLASE\\tVIE\\t07:30\\t09:20\\t30\\tH-303\\n" +
        "1F0162 - Análisis Financiero\\t4,00\\tPREREQUISITO: bla\\n" +
        "\\t\\tCLASE\\tMIE\\t13:30\\t16:20\\t35\\tA-103\\n" +
        "A\\tSALINAS MORRIS, Juan\\tFINAL\\tMIE\\t07:30\\t09:30\\t35\\tA-PEND\\n" +
        "\\t\\tPARCIAL\\tMIE\\t07:30\\t09:30\\t35\\tA-PEND";

    const lines = text.split('\\n');
    console.log("RUNNING parseLines...");
    const result = parseLines(lines);

    const counts = {};
    for (const o of result) {
        if (!counts[o.codigo_curso]) counts[o.codigo_curso] = { secciones: new Set(), totalHorarios: 0 };
        counts[o.codigo_curso].secciones.add(o.seccion);
        counts[o.codigo_curso].totalHorarios++;
    }

    console.log("\\n--- PARSED OVERVIEW ---");
    for (const [codigo, data] of Object.entries(counts)) {
        console.log("Course " + codigo + ": " + data.secciones.size + " secciones, " + data.totalHorarios + " horarios");
    }

    console.log("\\n--- TEORIA GENERAL DEL PROCESO (180282) ---");
    console.log(JSON.stringify(result.filter(o => o.codigo_curso === '180282'), null, 2));

} catch (e) {
    console.error("FAILED TO LOAD MODULE OR EXECUTE", e);
}
