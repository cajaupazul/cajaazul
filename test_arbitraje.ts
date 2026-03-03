import { parseOfertaText } from "./apps/web/lib/pdf-schedule-parser";
import fs from "fs";

const text = `
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
B
FERRERO DIAZ, Javier Ignacio / HUANCO PISCOCHE,
Henry Wilder
FINAL VIE 16:30 18:30 30 A-PEND
PARCIAL VIE 16:30 18:30 30 A-PEND
CLASE MIE 09:30 11:20 30 B-504
CLASE VIE 09:30 11:20 30 B-504
`;

parseOfertaText(text).then(result => {
    fs.writeFileSync("out_arbitraje.json", JSON.stringify(result, null, 2));
    console.log("Done. Results in out_arbitraje.json");
});
