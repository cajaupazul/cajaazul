import { parseOfertaText } from "./apps/web/lib/pdf-schedule-parser";
import fs from "fs";

const text = `
189097 - Derecho Administrativo II 4,00
PREREQUISITO: 187019 Derecho Administrativo I Y (180315 Derecho Procesal Constitucional O 180267 Derecho Constitucional Especial)
CLASE LUN 19:30 21:20 35 A-406
CLASE MIE 19:30 21:20 35 A-406
A MORI TORRES, Natalia Vanessa
FINAL JUE 07:30 09:30 35 A-PEND
PARCIAL JUE 07:30 09:30 35 A-PEND
B FARFAN SOUSA, Ronnie Ado
FINAL JUE 07:30 09:30 35 A-PEND
PARCIAL JUE 07:30 09:30 35 A-PEND
CLASE MAR 13:30 15:20 35 J-401
CLASE VIE 15:30 17:20 35 J-403

180086 - Derecho Constitucional General 5,00 
CLASE JUE 09:30 11:20 35 A-301
A ALBAN GONZALEZ, Javier Ignacio
FINAL DOM 13:30 15:30 35 A-PEND
`;

parseOfertaText(text).then(result => {
    fs.writeFileSync("out_orphan_schedules.json", JSON.stringify(result, null, 2));
    console.log("Done. Results in out_orphan_schedules.json");
});
