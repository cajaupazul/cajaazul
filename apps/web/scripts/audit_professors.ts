import fs from 'fs';
import path from 'path';

function normalizeName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[,.-]/g, " ").toLowerCase().trim();
}

function getWords(name: string) {
  const words = normalizeName(name).split(/\s+/).filter(w => w.length > 2 && w !== 'del' && w !== 'las' && w !== 'los' && w !== 'san');
  return new Set(words);
}

function intersection(setA: Set<string>, setB: Set<string>) {
  let _intersection = new Set();
  for (let elem of setB) {
      if (setA.has(elem)) {
          _intersection.add(elem);
      }
  }
  return _intersection;
}

async function run() {
  const filePath = path.resolve('C:/Users/huama/.gemini/antigravity/brain/39f2b139-4ace-4a87-bd39-b1176155fd28/.system_generated/steps/2578/output.txt');
  const rawOutput = fs.readFileSync(filePath, 'utf8');
  const startIdx = rawOutput.indexOf('[');
  const endIdx = rawOutput.lastIndexOf(']');
  const jsonStr = rawOutput.slice(startIdx, endIdx + 1);
  const profs = JSON.parse(jsonStr);

  const duplicates: any[] = [];
  const processed = new Set();

  for (let i = 0; i < profs.length; i++) {
    const p1 = profs[i];
    if (processed.has(p1.id)) continue;
    
    const words1 = getWords(p1.nombre);
    const matches = [p1];

    for (let j = i + 1; j < profs.length; j++) {
      const p2 = profs[j];
      if (processed.has(p2.id)) continue;

      const words2 = getWords(p2.nombre);
      const intersect = intersection(words1, words2);
      
      const unionSize = new Set([...words1, ...words2]).size;
      const matchRatio = intersect.size / unionSize;

      // Match if they share at least 2 distinct words and are exact,
      // or if they overlap highly.
      if (
        (intersect.size >= 2 && intersect.size === words1.size && intersect.size === words2.size) ||
        (intersect.size >= 3 && matchRatio >= 0.75) ||
        (intersect.size === 3 && words1.size === 3 && words2.size === 3)
      ) {
        matches.push(p2);
      }
    }

    if (matches.length > 1) {
      duplicates.push(matches);
      matches.forEach(m => processed.add(m.id));
    }
  }

  console.log(`Found ${duplicates.length} potential duplicate groups.`);
  duplicates.forEach((group, idx) => {
    console.log(`\nGroup ${idx + 1}:`);
    group.forEach((p: any) => console.log(`  - ${p.nombre} (ID: ${p.id}) [Esp: ${p.especialidad} | Otros: ${p.otros_cursos}]`));
  });
}

run();
