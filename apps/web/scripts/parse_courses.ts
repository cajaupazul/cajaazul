import fs from 'fs';

const rawData = fs.readFileSync('./supabase/lista_cursos.txt', 'utf-8');
const lines = rawData.split('\n').map(l => l.trim());

const profToCourses = new Map<string, Set<string>>();
let currentCourse = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line || line.includes('Secc\tDocentes') || line.includes('CURSOS ACADÉMICOS')) continue;

  const courseMatch = line.match(/^([A-Z0-9]+)\s*-\s+(.+)$/i);
  if (courseMatch) {
    currentCourse = courseMatch[2].trim();
    continue;
  }

  // Allow matching single/double letter or number followed by space/tab and names
  const teacherMatch = line.match(/^([A-Z0-9]{1,2})\s+(.+)$/i);
  if (teacherMatch && currentCourse) {
    let teachersText = teacherMatch[2].trim();
    teachersText = teachersText.replace(/"/g, '');

    const teachers = teachersText.split(/\s+\/\s+/);
    for (let t of teachers) {
      const cleanName = t.trim();
      if (!cleanName) continue;
      
      if (!profToCourses.has(cleanName)) {
        profToCourses.set(cleanName, new Set());
      }
      profToCourses.get(cleanName).add(currentCourse);
    }
  }
}

const updates = [];
let sql = `
CREATE TEMP TABLE temp_prof_updates (
  nombre text,
  especialidad text,
  otros_cursos text
);
INSERT INTO temp_prof_updates (nombre, especialidad, otros_cursos) VALUES
`;
const sqlValues = [];

for (const [profName, coursesSet] of profToCourses.entries()) {
  const courses = Array.from(coursesSet);
  const esp = courses[0] || null;
  const otros = courses.slice(1).join(', ') || null;
  updates.push({ 
    nombre: profName, 
    especialidad: esp, 
    otros_cursos: otros 
  });
  
  const safeName = profName.replace(/'/g, "''");
  const safeEsp = esp ? "'" + esp.replace(/'/g, "''") + "'" : 'NULL';
  const safeOtros = otros ? "'" + otros.replace(/'/g, "''") + "'" : 'NULL';
  sqlValues.push(`('${safeName}', ${safeEsp}, ${safeOtros})`);
}

const CHUNK_SIZE = 150;
const sqlChunks = [];
for (let i = 0; i < sqlValues.length; i += CHUNK_SIZE) {
  const chunk = sqlValues.slice(i, i + CHUNK_SIZE);
  let sql = `
CREATE TEMP TABLE temp_prof_updates (
  nombre text,
  especialidad text,
  otros_cursos text
);
INSERT INTO temp_prof_updates (nombre, especialidad, otros_cursos) VALUES
`;
  sql += chunk.join(',\n') + ';\n';
  sql += `
UPDATE professors p
SET 
  especialidad = t.especialidad,
  otros_cursos = t.otros_cursos
FROM temp_prof_updates t
WHERE UPPER(TRIM(p.nombre)) = UPPER(TRIM(t.nombre));
DROP TABLE temp_prof_updates;
`;
  sqlChunks.push(sql);
}

fs.writeFileSync('./apps/web/scripts/parsed_professors.json', JSON.stringify(updates, null, 2));
sqlChunks.forEach((sql, index) => {
  fs.writeFileSync(`./apps/web/scripts/update_profs_${index + 1}.sql`, sql);
});
console.log(`Parsed ${updates.length} professors and saved to JSON and ${sqlChunks.length} SQL files.`);

