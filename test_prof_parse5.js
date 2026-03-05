const fs = require('fs');

const text = fs.readFileSync('test_prof_parse4.ts', 'utf8').split('`')[1];

const lines = text.split('\n').map(l => l.trimRight());
let currentCodigo = '';
let currentCurso = '';

const profMap = new Map();

for (const line of lines) {
    if (!line.trim()) continue;

    // Try course header: "120266 - Antiguo Perú..." or "123456 - Algo\t"
    const courseMatch = line.match(/^([A-Z0-9]{4,8})\s*[-–]\s*(.+?)(?:\t|$)/);
    if (courseMatch) {
        currentCodigo = courseMatch[1];
        currentCurso = courseMatch[2].trim();
        console.log("COURSE MATCH:", currentCodigo, "|", currentCurso);
        continue;
    }

    // Try professor line: "A\tPARDO GRAU, Cecilia" or "A   DE VEGA DE UNCETA..."
    console.log("Trying prof line for:", JSON.stringify(line));
    const profMatch = line.match(/^([A-Z0-9]{1,3})(?:\t|\s{2,})(.*)$/);

    if (profMatch) {
        const seccion = profMatch[1].trim();
        const profNamesStr = profMatch[2].trim();
        console.log("  -> PROF MATCH:", seccion, "|", profNamesStr);
    } else {
        console.log("  -> NO MATCH");
    }
}
