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

    const text = `120133 - Ética - 4,00 créditos
A VARGAS DELLA CASA, Rosa Elvira
CLASE JUE 16:30 18:20 30 A-103
CLASE MAR 16:30 18:20 30 A-205
FINAL MIE 16:30 18:30 30 A-PEND
PARCIAL MIE 16:30 18:30 30 A-PEND
B QUIROZ MEZA, Danitza Dejanira
FINAL MIE 16:30 18:30 30 A-PEND
PARCIAL MIE 16:30 18:30 30 A-PEND
CLASE LUN 14:30 16:20 30 X -302
CLASE MIE 14:30 16:20 30 X -302
C PONCE BOGINO, Hector Alberto
CLASE JUE 15:30 17:20 32 A-202
Dirección de Asuntos Académicos y Registro
Horarios ofertados: 2026-I PERIODO-PRE
24/02/2026 V1
Se sugiere revisar la última versión en: https://daar.up.edu.pe
CLASE MAR 15:30 17:20 32 A-202
C PONCE BOGINO, Hector Alberto
FINAL MIE 16:30 18:30 32 A-PEND
PARCIAL MIE 16:30 18:30 32 A-PEND
D PIEDRA VALDEZ, Jose Leopoldo
CLASE LUN 07:30 09:20 32 A-408
CLASE MIE 07:30 09:20 32 A-408
FINAL MIE 16:30 18:30 32 A-PEND
PARCIAL MIE 16:30 18:30 32 A-PEND
K ARANA ALENCASTRE, Jean Luis
FINAL MIE 16:30 18:30 30 A-PEND
PARCIAL MIE 16:30 18:30 30 A-PEND
CLASE JUE 09:30 11:20 30 B-306
CLASE MAR 09:30 11:20 30 E-302
`;
    // run the function
    const lines = text.split('\\n');
    console.log("RUNNING parseLines...");
    const result = parseLines(lines);
    console.log("RESULT SECTION A:");
    console.log(JSON.stringify(result.filter(o => o.seccion === 'A'), null, 2));
    console.log("RESULT SECTION K:");
    console.log(JSON.stringify(result.filter(o => o.seccion === 'K'), null, 2));
} catch (e) {
    console.error("FAILED TO LOAD MODULE OR EXECUTE", e);
}
