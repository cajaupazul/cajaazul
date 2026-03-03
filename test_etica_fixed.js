const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'apps/web/lib/pdf-schedule-parser.ts'), 'utf8');

// Strip TypeScript types
let jsCode = code
    .replace(/export /g, '')
    .replace(/import .* from .*/g, '')
    .replace(/: [A-Z][a-zA-Z0-9_\\[\\]<\\>]* /g, ' ')
    .replace(/: [A-Z][a-zA-Z0-9_\\[\\]<\\>]*,/g, ',')
    .replace(/: [A-Z][a-zA-Z0-9_\\[\\]<\\>]*;/g, ';')
    .replace(/: string/g, '')
    .replace(/: number/g, '')
    .replace(/: boolean/g, '')
    .replace(/ as any/g, '')
    .replace(/<[A-Z][a-zA-Z0-9]*>/g, '')
    .replace(/type [A-Za-z0-9_]+ = \\{[^}]*\\};/g, '');

jsCode += `
module.exports = { parseLines };
`;

fs.writeFileSync(path.join(__dirname, 'parser-temp-cjs.js'), jsCode);

const { parseLines } = require(path.join(__dirname, 'parser-temp-cjs.js'));

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
E EGOAVIL RIOS, Jean Christian
FINAL MIE 16:30 18:30 32 A-PEND
PARCIAL MIE 16:30 18:30 32 A-PEND
CLASE JUE 15:30 17:20 32 B-306
CLASE MAR 15:30 17:20 32 B-306
F HINOSTROZA RIVERA, Dino Arturo
CLASE MAR 14:30 16:20 30 A-503
CLASE JUE 15:30 17:20 30 A-508
FINAL MIE 16:30 18:30 30 A-PEND
PARCIAL MIE 16:30 18:30 30 A-PEND
G IVANOFF SABOGAL, Christian
FINAL MIE 16:30 18:30 30 A-PEND
PARCIAL MIE 16:30 18:30 30 A-PEND
CLASE LUN 13:30 15:20 30 Virtual-Virtua
CLASE MIE 13:30 15:20 30 Virtual-Virtua
H HINOSTROZA RIVERA, Dino Arturo
CLASE LUN 15:30 17:20 30 A-101
CLASE MIE 15:30 17:20 30 A-107
FINAL MIE 16:30 18:30 30 A-PEND
PARCIAL MIE 16:30 18:30 30 A-PEND
I VARGAS DELLA CASA, Rosa Elvira
CLASE JUE 18:30 20:20 30 A-103
CLASE MAR 18:30 20:20 30 A-205
FINAL MIE 16:30 18:30 30 A-PEND
PARCIAL MIE 16:30 18:30 30 A-PEND
J ARANA ALENCASTRE, Jean Luis
CLASE MAR 07:30 09:20 30 A-206
CLASE JUE 07:30 09:20 30 A-407
FINAL MIE 16:30 18:30 30 A-PEND
PARCIAL MIE 16:30 18:30 30 A-PEND
K ARANA ALENCASTRE, Jean Luis
FINAL MIE 16:30 18:30 30 A-PEND
PARCIAL MIE 16:30 18:30 30 A-PEND
CLASE JUE 09:30 11:20 30 B-306
CLASE MAR 09:30 11:20 30 E-302
L EGOAVIL RIOS, Jean Christian
CLASE MAR 19:30 21:20 30 A-507
Dirección de Asuntos Académicos
y Registro
Horarios ofertados: 2026
-
I PERIODO
-PRE
24/02/2026 V1
Se sugiere revisar la última versión en: https://daar.up.edu.pe
FINAL MIE 16:30 18:30 30
A
-PEND
L EGOAVIL RIOS, Jean Christian
PARCIAL MIE 16:30 18:30 30
A
-PEND
CLASE JUE 19:30 21:20 30
B
-305
M EGOAVIL RIOS, Jean Christian
FINAL MIE 16:30 18:30 32
A
-PEND
PARCIAL MIE 16:30 18:30 32
A
-PEND
CLASE LUN 17:30 19:20 32
B
-306
CLASE MIE 17:30 19:20 32
B
-306
N EGOAVIL RIOS, Jean Christian
FINAL MIE 16:30 18:30 32
A
-PEND
PARCIAL MIE 16:30 18:30 32
A
-PEND
CLASE LUN 19:30 21:20 32
B
-306
CLASE MIE 19:30 21:20 32
B
-306
O VILLARAN CONTAVALLI, ALONSO MANUEL
CLASE JUE 11:30 13:20 32
A
-406
CLASE MAR 11:30 13:20 32
A
-406
FINAL MIE 16:30 18:30 32
A
-PEND
PARCIAL MIE 16:30 18:30 32
A
-PEND
P EGOAVIL RIOS, Jean Christian
FINAL MIE 16:30 18:30 32
A
-PEND
PARCIAL MIE 16:30 18:30 32
A
-PEND
CLASE JUE 11:30 13:20 32
B
-306
CLASE MAR 13:30 15:20 32
B
-306
Q DEXTRE UZATEGUI, Sergio Guillermo
FINAL MIE 16:30 18:30 30
A
-PEND
PARCIAL MIE 16:30 18:30 30
A
-PEND
CLASE JUE 09:30 11:20 30 X
-301
CLASE MAR 09:30 11:20 30 X
-301`;

const result = parseLines(text.split('\\n'));

console.log('\\n--- SECTION A JSON ---\\n');
console.log(JSON.stringify(result.filter(o => o.seccion === 'A'), null, 2));

console.log('\\n--- EXTRANEOUS SECTION CHECK (K) ---\\n');
console.log(JSON.stringify(result.filter(o => o.seccion === 'K'), null, 2));

console.log('\\n--- SUMMARY ---\\n');
const secMap = {};
for (const x of result) {
    if (!secMap[x.seccion]) secMap[x.seccion] = 0;
    secMap[x.seccion]++;
}
console.log(JSON.stringify(secMap, null, 2));
