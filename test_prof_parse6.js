const { parseOfertaText } = require('./apps/web/lib/pdf-schedule-parser');
const fs = require('fs');

const text = fs.readFileSync('test_prof_parse4.ts', 'utf8').split('`')[1];

async function run() {
    console.log("Starting parseOfertaText...");
    try {
        const result = await parseOfertaText(text);
        console.log("Finished! Ofertas:", result.ofertas.length);
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
