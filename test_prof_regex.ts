import fs from "fs";

function extractProfessor(raw: string): string {
    if (/sin profesor/i.test(raw)) return 'Sin profesor';

    // Strip known noise that might contain commas
    let cleaned = raw.replace(/Codictado\.[^A-Z]*/ig, ' ');

    // A robust regex for Spanish names with a comma: 
    // Optional prefixes, then ALL CAPS or Mixed case LAST NAMES, a comma, and Mixed case FIRST NAMES
    // e.g. "PRIALE UGAS, Miguel Enrique", "Díaz Rojas, Carlos Andres", "TRUJILLO SOSA, Jorge"
    // We look for parts with comma!
    const commaMatch = cleaned.match(/([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:[\s\-][A-ZÁÉÍÓÚÑa-záéíóúñ]+)*,\s*[A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:[\s\-][A-ZÁÉÍÓÚÑa-záéíóúñ]+)*)/g);

    if (commaMatch && commaMatch.length > 0) {
        let joined = commaMatch.map(s => s.trim()).join(' / ');
        // If the regex missed some "noise" because it looked like a name, clean it.
        // Actually, name format is strict enough. But let's be careful not to match random text and commas.
        return joined;
    }

    // Fallback logic
    cleaned = cleaned.replace(/\b(?:Lunes|Martes|Mi[ée]rcoles|MIE|MAR|JUE|VIE|SAB|DOM|Jueves|Viernes|S[áa]bado|Domingo)?\s*\d{1,2}:\d{2}\s*(?:a|-)\s*\d{1,2}:\d{2}\.?/ig, '');

    const PROF_NOISE = [
        /Dictado en Ingl[ée]s\.?/ig,
        /DOBLE GRADO\.?/ig,
        /Virtual(?:\s*\/?\s*Presencial)?\.?/ig,
        /Pr[áa]cticas? quincenales?\.?/ig,
        /Pr[áa]cticas? (?:quincenal )?(?:semana )?(?:par|impar):?/ig,
        /La sesiones de los d[ií]as martes son virtuales\.?/ig,
        /Clases teóricas presenciales.*?\./ig,
        /Fechas de clases pr[áa]cticas.*?\sasincr[óo]nicas/ig,
        /Del lunes .*? pm/ig,
        /Presentaci[óo]n final:.*?pm/ig,
        /Curso Faculty Led Program/ig,
        /Clases previas:.*?pm/ig,
        /Revisar fechas en web ORI\.?/ig,
        /Curso de la Semana Internacional\.?/ig,
        /Clases del \d{2}\/\d{2}\/\d{4} al \d{2}\/\d{2}\/\d{4}\.?/ig,
    ];
    for (const re of PROF_NOISE) {
        cleaned = cleaned.replace(re, ' ');
    }

    const tipoIdx = cleaned.search(/\b(CLASE|FINAL|PARCIAL|PRÁCTICA|PRACTICA|LABORATORIO|TALLER)\b/i);
    if (tipoIdx > 0) cleaned = cleaned.slice(0, tipoIdx);

    // Remove standalone times that might not have "a" or "-" like "11:20."
    cleaned = cleaned.replace(/\b\d{1,2}:\d{2}\b\.?/g, '');
    cleaned = cleaned.replace(/\b(?:Lunes|Martes|Mi[ée]rcoles|MIE|MAR|JUE|VIE|SAB|DOM|Jueves|Viernes|S[áa]bado|Domingo)\b/ig, '');

    return cleaned.replace(/\s+\d+\s*$/, '').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
}

const namesToTest = [
    "Prácticas quincenales PRIALE UGAS, Miguel Enrique",
    "Dictado en Inglés ROMERO VEREAU, Daniel Alonso",
    "Prácticas semana par: Viernes 09:30 a 11:20. LIBAQUE SAENZ, Christian Fernando",
    "Dictado en Inglés. DOBLE GRADO MATEU BULLON, Pedro Fernando",
    "Díaz Rojas, Carlos Andres",
    "Codictado. Segunda parte del curso (Excel) - Prof. Marco Vásquez BENITES SANCHEZ, Luis Enrique",
    "Sin profesor",
    "Dictado en Inglés. Virtual",
    "Vivanco Loomer, Luis Miguel",
    "MONSALVE ZANATTI, Martin Alberto / CAMACHO GAVIDIA, Abel Fernando",
    "Virtual PEREZ MARTINEZ, Angel Ruben",
    "A SANCHEZ JUGO, Isabel" // wait, if A is included
];

for (const n of namesToTest) {
    console.log(`Original: ${n}\nExtracted: ${extractProfessor(n)}\n`);
}
