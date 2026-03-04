const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'apps/web/lib/pdf-schedule-parser.ts'), 'utf8');

// A very aggressive regex stripper that only keeps JS
const strippedCode = code
    .replace(/export async function/g, 'async function')
    .replace(/export function/g, 'function')
    .replace(/export const parseOfertaPDF = parseOfertaFile;/g, '')
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

    // Exact structure matching the user's Excel paste format, including the problematic prerequisite wrap:
    const text = "141036 - Análisis Multivariado para los Negocios\\t4,00\\tPREREQUISITO: (170124 Informática para los Negocios I O 170355 Informática para\\n" +
        "los Negocios O\\n" +
        "142277 Analítica de Datos para los Negocios)\\n" +
        "A\\tBENITES SANCHEZ, Luis Enrique\\tCLASE\\tLUN\\t09:30\\t11:20\\t30\\tA-405\\n" +
        "\\t\\tCLASE\\tMIE\\t09:30\\t11:20\\t30\\tA-405\\n" +
        "\\t\\tPRÁCTICA\\tMIE\\t11:30\\t12:20\\t30\\tA-405\\n" +
        "\\t\\tFINAL\\tMAR\\t07:30\\t09:30\\t30\\tA-PEND\\n" +
        "\\t\\tPARCIAL\\tMAR\\t07:30\\t09:30\\t30\\tA-PEND\\n" +
        "B\\tCAYCHO HUAMANI, Jose Alberto\\tCLASE\\tMAR\\t18:30\\t20:20\\t30\\tA-204\\n" +
        "\\t\\tPRÁCTICA\\tMAR\\t20:30\\t21:20\\t30\\tA-204\\n" +
        "\\t\\tCLASE\\tVIE\\t07:30\\t09:20\\t30\\tA-505\\n" +
        "\\t\\tFINAL\\tMAR\\t07:30\\t09:30\\t30\\tA-PEND\\n" +
        "\\t\\tPARCIAL\\tMAR\\t07:30\\t09:30\\t30\\tA-PEND\\n";

    const lines = text.split('\\n');
    console.log("RUNNING parseLines...");
    const result = parseLines(lines);

    const counts = {};
    for (const o of result) {
        if (!counts[o.codigo_curso]) counts[o.codigo_curso] = { nombre: o.nombre_curso, secciones: new Set(), totalHorarios: 0 };
        counts[o.codigo_curso].secciones.add(o.seccion);
        counts[o.codigo_curso].totalHorarios++;
    }

    console.log("\\n--- PARSED OVERVIEW ---");
    for (const [codigo, data] of Object.entries(counts)) {
        console.log("Course " + codigo + " (" + data.nombre + "): " + data.secciones.size + " secciones, " + data.totalHorarios + " horarios");
    }

    console.log("\\n--- 141036 (Multivariado) ---");
    console.log(JSON.stringify(result.filter(o => o.codigo_curso === '141036'), null, 2));

    console.log("\\n--- 142277 (Analítica, hallucinated course!) ---");
    console.log(JSON.stringify(result.filter(o => o.codigo_curso === '142277'), null, 2));

} catch (e) {
    console.error("FAILED TO LOAD MODULE OR EXECUTE", e);
}
