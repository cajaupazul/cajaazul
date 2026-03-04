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

    // Let's create a text block that exactly mimics the Excel paste.
    // I will include a dummy course before it that HAS those weird 09:30-12:30 schedules to see if they bleed.
    const text = "142285 - Gestión Estratégica de Organizaciones Deportivas\\t2,00\\tPREREQUISITO: 141038\\n" +
        "A\\tGOMEZ CHANGA, Sarita\\tCLASE\\tLUN\\t09:30\\t12:30\\t30\\tX-202\\n" +
        "\\t\\tCLASE\\tMAR\\t09:30\\t12:30\\t30\\tX-202\\n" +
        "\\t\\tCLASE\\tMIE\\t09:30\\t12:30\\t30\\tX-202\\n" +
        "\\t\\tCLASE\\tJUE\\t09:30\\t12:30\\t30\\tX-202\\n" +
        "\\t\\tCLASE\\tVIE\\t09:30\\t12:30\\t30\\tX-202\\n" +
        "142462 - Gestión y Emprendimiento en la Industria Musical\\t2,00\\tPREREQUISITO: 142081\\n" +
        "A\\t\\tCLASE\\tMAR\\t15:30\\t17:20\\t30\\tH-201\\n" +
        "142466 - Innovación Social y Sostenible\\t4,00\\tPREREQUISITO: 142081\\n" +
        "A\\t\\tCLASE\\tMAR\\t15:30\\t17:20\\t30\\tH-201\\n";

    const lines = text.split('\\n');
    console.log("RUNNING parseLines...");
    const result = parseLines(lines);

    console.log("\\n--- GESTION Y EMPRENDIMIENTO EN LA INDUSTRIA MUSICAL (142462) ---");
    console.log(JSON.stringify(result.filter(o => o.codigo_curso === '142462'), null, 2));

} catch (e) {
    console.error("FAILED TO LOAD MODULE OR EXECUTE", e);
}
