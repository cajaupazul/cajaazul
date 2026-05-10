import fs from 'fs';
import path from 'path';

const data = JSON.parse(fs.readFileSync('parsed_offer.json', 'utf-8'));

let totalSections = 0;
const professors = new Set();

data.forEach(c => {
    totalSections += c.sections.length;
    c.sections.forEach(s => {
        // Clean professor name from artifacts like "A" at start if wrongly parsed
        let name = s.profesor.trim();
        // Sometimes the section letter gets caught if the regex is too broad, 
        // but my regex ^([A-Z])(?:\s+(Virtual))?\s+ handles it.
        professors.add(name);
    });
});

console.log(`Resumen de la Oferta Académica:`);
console.log(`- Cursos detectados: ${data.length}`);
console.log(`- Secciones totales: ${totalSections}`);
console.log(`- Profesores únicos (pre-deduplicación): ${professors.size}`);
console.log(`\nEjemplos de Cursos:`);
data.slice(0, 5).forEach(c => {
    console.log(`  * ${c.codigo} - ${c.nombre} (${c.sections.length} secciones)`);
});

console.log(`\nEjemplos de Profesores (Verificando limpieza):`);
Array.from(professors).slice(0, 10).forEach(p => console.log(`  * ${p}`));
