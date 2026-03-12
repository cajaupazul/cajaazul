const normalizeString = (str) => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

const isCleanMatch = (professorCourses, targetCourse) => {
  if (!targetCourse) return false;
  const targetNorm = normalizeString(targetCourse);

  return professorCourses.some(course => {
    const courseNorm = normalizeString(course);
    if (courseNorm === targetNorm) return true;

    const segments = courseNorm.split(/[,;|•/]/).map(s => s.trim()).filter(Boolean);
    return segments.some(segment => segment === targetNorm);
  });
};

const courseName = "NIVELACIÓN EN MATEMÁTICAS";
const profs = [
  { name: "PEREZ SOTELO", esp: "Estadística I", otros: null },
  { name: "SINCHE CHOCCA", esp: "Matemáticas I", otros: null },
  { name: "CERNADES GOMEZ", esp: "Nivelación en Matemáticas", otros: null },
  { name: "CHULLUNCUY CENTENO", esp: "Matemáticas II", otros: null },
  { name: "ESCALANTE HUAMANÍ", esp: "Matemáticas I", otros: null },
  { name: "ESCUDERO ACERO", esp: "Matemáticas I", otros: null }
];

console.log(`Course: ${courseName}`);
profs.forEach(p => {
  const profCourses = [
    p.esp,
    ...(p.otros ? (typeof p.otros === 'string' ? p.otros.split(/[,;|•/]/) : (Array.isArray(p.otros) ? p.otros : [p.otros])) : [])
  ].filter(Boolean);

  const match = isCleanMatch(profCourses, courseName);
  console.log(`Prof: ${p.name} (${p.esp}) -> Match: ${match}`);
});
