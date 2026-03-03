import { parseOfertaText } from "./apps/web/lib/pdf-schedule-parser";
const text = `
Z DEXTRE UZATEGUI, Sergio Guillermo
CLASE MAR 11:30 13:20 30 X -301
129007 - Filosofía - 4,00 créditos
A CARRIÓN CARAVEDO, Úrsula
CLASE JUE 09:30 11:20 30 J-202
`;

async function test() {
    const res = await parseOfertaText(text);
    console.log("Ofertas:", res.ofertas.length);
    console.log(JSON.stringify(res, null, 2));
}
test();
