import { parseOfertaFile, parseOfertaText } from './apps/web/lib/pdf-schedule-parser';

const text = `Horarios ofertados: 2026-I PERIODO-PRE
142285 - Gestión Estratégica de Organizaciones Deportivas	2,00	PREREQUISITO: 141038 Fundamentos de las Ciencias Empresariale O 149744
Introducción a los Negocios
A	GOMEZ CHANGA, Sarita Julia/ MOSCOSO ZAMBRANO, Renzo	CLASE		MAR	14:30	16:20		30	X-202
Mauricio
142462 - Gestión y Emprendimiento en la Industria Musical	2,00	PREREQUISITO: (142081 Diseño Organizacional y Estrategia O 142083 Estrategia)
A		CLASE		MAR	15:30	17:20		30	H-201
142466 - Innovación Social y Sostenible en la Cadena de Valor	4,00	
Textil: La Ruta de
		CLASE		JUE	09:30	12:30		20	A-PEND
		CLASE		LUN	09:30	12:30		20	A-PEND
A	LARIOS FRANCIA, Rosa Patricia	CLASE		MAR	09:30	12:30		20	A-PEND
		CLASE		MIE	09:30	12:30		20	A-PEND
		CLASE		VIE	09:30	12:30		20	A-PEND
		FINAL		JUE	18:30	20:20		20	A-PEND
		FINAL		MAR	18:30	20:20		20	A-PEND
142091 - Innovación y Gestión en Negocios Digitales	3,00	PREREQUISITO: 142081 Diseño Organizacional`;

async function runTest() {
    const result = await parseOfertaText(text);

    const counts: Record<string, any> = {};
    for (const o of result.ofertas) {
        if (!counts[o.codigo_curso]) counts[o.codigo_curso] = { nombre: o.nombre_curso, secciones: new Set(), totalHorarios: 0 };
        counts[o.codigo_curso].secciones.add(o.seccion);
        counts[o.codigo_curso].totalHorarios++;
    }

    console.log(`\n--- PARSED ${result.ofertas.length} OFERTAS TOTAL ---`);
    for (const [codigo, data] of Object.entries(counts)) {
        console.log(`Course ${codigo} (${data.nombre}): ${data.secciones.size} secciones, ${data.totalHorarios} horarios`);
    }

    console.log(`\n--- 142462 (El Ladron) ---`);
    console.log(JSON.stringify(result.ofertas.filter((o: any) => o.codigo_curso === '142462'), null, 2));

    console.log(`\n--- 142466 (El Robado) ---`);
    console.log(JSON.stringify(result.ofertas.filter((o: any) => o.codigo_curso === '142466'), null, 2));
}

runTest();
