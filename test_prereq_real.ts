import { parseOfertaFile } from './apps/web/lib/pdf-schedule-parser';

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

async function runTest() {
    const file = new File([text], "test.txt", { type: "text/plain" });
    const result = await parseOfertaFile(file);

    const counts: Record<string, any> = {};
    for (const o of result.ofertas) {
        if (!counts[o.codigo_curso]) counts[o.codigo_curso] = { nombre: o.nombre_curso, secciones: new Set(), totalHorarios: 0 };
        counts[o.codigo_curso].secciones.add(o.seccion);
        counts[o.codigo_curso].totalHorarios++;
    }

    console.log("\\n--- PARSED OVERVIEW ---");
    for (const [codigo, data] of Object.entries(counts)) {
        console.log(\`Course \${codigo} (\${data.nombre}): \${data.secciones.size} secciones, \${data.totalHorarios} horarios\`);
    }

    console.log("\\n--- 141036 (Multivariado) ---");
    console.log(JSON.stringify(result.ofertas.filter((o: any) => o.codigo_curso === '141036'), null, 2));

    console.log("\\n--- 142277 (Analítica) ---");
    console.log(JSON.stringify(result.ofertas.filter((o: any) => o.codigo_curso === '142277'), null, 2));
}

runTest();
