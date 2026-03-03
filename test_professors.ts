import { parseOfertaText } from "./apps/web/lib/pdf-schedule-parser";
import fs from "fs";

const text = `
130639 - Diseño y Evaluación Social de Proyectos 4,00
PREREQUISITO: ...
A Prácticas quincenales PRIALE UGAS, Miguel Enrique
CLASE MIE 07:30 09:20 35 H-402

130223 - Estadística Aplicada 4,00
A Dictado en Inglés ROMERO VEREAU, Daniel Alonso
PRÁCTICA JUE 19:30 21:20 35 A-203

170351 - Métodos de Investigación Cuantitativa 4,00
A Prácticas semana par: Viernes 09:30 a 11:20. LIBAQUE SAENZ, Christian Fernando
CLASE MAR 09:30 11:20 28 A-106

130225 - Estadística II 4,00
B Dictado en Inglés. DOBLE GRADO MATEU BULLON, Pedro Fernando
CLASE JUE 09:30 11:20 30 B-402

142077 - Creación de Valor y Toma de Decisiones 3,00
C Díaz Rojas, Carlos Andres
CLASE JUE 18:30 21:20 30 A-305

142277 - Analítica de Datos para los Negocios 3,00
A Codictado. Segunda parte del curso (Excel) - Prof. Marco Vásquez BENITES SANCHEZ, Luis Enrique
PRÁCTICA LUN 13:30 16:20 30 A-405
`;

// Simulate the logic we'd add to cleanProfName
const PROF_NOISE = [
    /Dictado en Ingl[ée]s\.?/ig,
    /DOBLE GRADO\.?/ig,
    /Virtual(?:\s*\/?\s*Presencial)?\.?/ig,
    /Pr[áa]cticas? quincenales?\.?/ig,
    /Pr[áa]cticas? (?:quincenal )?(?:semana )?(?:par|impar):.*?\./ig,
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
    /Codictado\..*?-\s*Prof\.\s*[A-Za-zÁÉÍÓÚÑáéíóúñ\s]+/ig,
];

function stripProfessorNoise(name: string): string {
    let prev = "";
    while (name !== prev) {
        prev = name;
        for (const re of PROF_NOISE) {
            name = name.replace(re, '').trim();
        }
        // Remove dangling times like "09:30 a 11:20." if left behind
        name = name.replace(/^\d{1,2}:\d{2}\s+a\s+\d{1,2}:\d{2}\.?\s*/i, '').trim();
        // Remove dangling words like "Viernes" if left behind
        name = name.replace(/^(Lunes|Martes|Mi[ée]rcoles|Jueves|Viernes|S[áa]bado|Domingo)\s*/i, '').trim();
    }
    return name;
}

const namesToTest = [
    "Prácticas quincenales PRIALE UGAS, Miguel Enrique",
    "Dictado en Inglés ROMERO VEREAU, Daniel Alonso",
    "Prácticas semana par: Viernes 09:30 a 11:20. LIBAQUE SAENZ, Christian Fernando",
    "Dictado en Inglés. DOBLE GRADO MATEU BULLON, Pedro Fernando",
    "Díaz Rojas, Carlos Andres",
    "Codictado. Segunda parte del curso (Excel) - Prof. Marco Vásquez BENITES SANCHEZ, Luis Enrique"
];

for (const n of namesToTest) {
    console.log(`Original: ${n}\nCleaned:  ${stripProfessorNoise(n)}\n`);
}
