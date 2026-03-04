import { parseOfertaFile, parseOfertaText } from './apps/web/lib/pdf-schedule-parser';

// Simulating Excel's exact behavior when a cell has Alt+Enter (internal newline).
// Excel wraps the entire cell data in double quotes. 
const text = `Horarios ofertados: 2026-I PERIODO-PRE
142462 - Gestión y Emprendimiento en la Industria Musical	2,00	PREREQUISITO: ...
A		CLASE		MAR	15:30	17:20		30	H-201
"142466 - Innovación Social y Sostenible en la Cadena de Valor
Textil: La Ruta de"	4,00
		CLASE		JUE	09:30	12:30		20	A-PEND
A	LARIOS FRANCIA, Rosa Patricia	CLASE		MAR	09:30	12:30		20	A-PEND`;

async function runTest() {
    const result = await parseOfertaText(text);

    console.log(`\n--- PARSED 142462 (The Stealer) ---`);
    console.log(JSON.stringify(result.ofertas.filter((o: any) => o.codigo_curso === '142462'), null, 2));

    console.log(`\n--- PARSED 142466 (The Stolen) ---`);
    console.log(JSON.stringify(result.ofertas.filter((o: any) => o.codigo_curso === '142466'), null, 2));
}

runTest();
