import { parseOfertaText } from "./apps/web/lib/pdf-schedule-parser";
import fs from "fs";

const text = `
Dirección de Asuntos Académicos y Registro
Horarios ofertados: 2026-I PERIODO-PRE
24/02/2026 V1
Se sugiere revisar la última versión en: https://daar.up.edu.pe
Secc Docentes Cred Teoría o Práctica Día Horario Duración Cupo
s
Aula
CURSOS ACADÉMICOS
120266 - Antiguo Perú, Arqueología, Museos y Nuevas Tecnologías -
4,00 créditos
A PARDO GRAU, Cecilia Maria Luisa
CLASE LUN 11:30 13:20 30 J-603
CLASE MIE 11:30 13:20 30 J-603
120253 - Antropología Filosófica - 4,00 créditos
A DEL MASTRO PUCCIO, Cesare Anibal
FINAL MIE 10:30 12:30 40 A-PEND
PARCIAL MIE 10:30 12:30 40 A-PEND
CLASE LUN 11:30 13:20 40 J-503
CLASE MIE 11:30 13:20 40 J-503
120280 - Arte y diseño prehispánico. Naturaleza y legado - 4,00
créditos
A PARDO GRAU, Cecilia Maria Luisa
CLASE JUE 11:30 13:20 30 J-603
CLASE MAR 11:30 13:20 30 J-603
120270 - Comunicación Digital - 4,00 créditos PREREQUISITO: (120252 Lectura Crítica de la Prensa Digital y e Y 120001 Lenguaje I)
A ESPINOSA WINDER, Francisco
CLASE LUN 15:30 17:20 30 A-621
FINAL MIE 10:30 12:30 30 A-PEND
PARCIAL MIE 10:30 12:30 30 A-PEND
CLASE MIE 15:30 17:20 30 J-601
120133 - Ética - 4,00 créditos
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
120269 - Historia Económica del Perú - 4,00 créditos PREREQUISITO: 130642 Economía General II Y (150004 Ciencia Política O
120070 Historia Económica y Empresarial O
122005 Historia Crítica del Perú)
A
MONSALVE ZANATTI, Martin Alberto / CAMACHO
GAVIDIA, Abel Fernando / CASAS TRAGODARA, Carlos
Augusto
CLASE MIE 17:30 19:20 30 A-508
CLASE LUN 17:30 19:20 30 B-506
186045 - Arbitraje - 4,00 créditos PREREQUISITO: (180067 Derecho Procesal I O 180282 Teoría General del Proceso)
Y
180278 Obligaciones
A
ESPEJO DONAIRE, Andrea Patricia / TOVAR GIL, Maria
Del Carmen Violeta
FINAL VIE 16:30 18:30 30 A-PEND
PARCIAL VIE 16:30 18:30 30 A-PEND
CLASE MIE 11:30 13:20 30 B-503
CLASE VIE 11:30 13:20 30 B-503
`;

async function main() {
    const result = await parseOfertaText(text);

    // Write result to file
    fs.writeFileSync('out_huge_test.json', JSON.stringify(result, null, 2));
    console.log(`Parsed ${result.ofertas.length} ofertas`);
    if (result.errors.length > 0) {
        console.error('Errors:', result.errors);
    }
}

main().catch(console.error);
