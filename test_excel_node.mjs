import fs from 'fs';
import ts from 'typescript';

const code = fs.readFileSync('./apps/web/lib/pdf-schedule-parser.ts', 'utf8');

const jsCode = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext }
}).outputText;

fs.writeFileSync('./parser-excel-temp.js', jsCode);

// Dynamic import for CommonJS wrapper
const { parseLines } = await import('./parser-excel-temp.js');

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

const counts = {};
for (const o of result.ofertas) {
    if (!counts[o.codigo_curso]) counts[o.codigo_curso] = { secciones: new Set(), totalHorarios: 0 };
    counts[o.codigo_curso].secciones.add(o.seccion);
    counts[o.codigo_curso].totalHorarios++;
}

console.log("\\n--- PARSED OVERVIEW ---");
for (const [codigo, data] of Object.entries(counts)) {
    console.log(\`Course \${codigo}: \${data.secciones.size} secciones, \${data.totalHorarios} horarios\`);
}

console.log("\\n--- 142462 ---");
console.log(JSON.stringify(result.ofertas.filter(o => o.codigo_curso === '142462'), null, 2));
