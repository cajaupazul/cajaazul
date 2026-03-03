import { parseOfertaText } from './apps/web/lib/pdf-schedule-parser';

const text = `
CURSOS ACADÉMICOS
120266 - Antiguo Perú, Arqueología, Museos y Nuevas Tecnologías 4,00
A PARDO GRAU, Cecilia Maria Luisa
CLASE LUN 11:30 13:20 30 J-603

142082 - Emprendimiento e Innovación 4,00 A TRUJILLO SOSA, Jorge Enrique
CLASE JUE 15:30 17:20 30 H-505
CLASE MAR 15:30 17:20 30 H-505
B Dictado en Inglés. Virtual
CLASE JUE 15:30 17:20 30 Virtual-Virtua
CLASE MAR 15:30 17:20 30 Virtual-Virtua
H
. VILLEGAS VALLADARES, Shirley Rubi
CLASE JUE 17:30 19:20 30 B-505
CLASE MAR 17:30 19:20 30 B-505 I BELTRÁN PUERTA, Jorge CLASE LUN 15:30 17:20 30 A-301
CLASE MIE 15:30 17:20 30 A-301
`;

async function test() {
    const r = await parseOfertaText(text);
    console.log("PERIODO:", r.periodo);
    console.log("ERRORS:", r.errors);
    r.ofertas.forEach(o => {
        console.log(`${o.codigo_curso} - ${o.nombre_curso} [Sec ${o.seccion}]: ${o.profesor} -> ${o.tipo} ${o.dia} ${o.hora_inicio}-${o.hora_fin} (${o.creditos} cred)`);
    });
}

test();
