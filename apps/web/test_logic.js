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

    const segments = courseNorm.split(/[,;|•]/).map(s => s.trim()).filter(Boolean);
    return segments.some(segment => segment === targetNorm);
  });
};

const profSpecialty = "NIVELACIÓN EN INFORMÁTICA";
const targetCourse = "NIVELACIÓN EN MATEMÁTICAS";

console.log("Testing matching logic...");
console.log(`Specialty: ${profSpecialty}`);
console.log(`Target: ${targetCourse}`);

const matches = isCleanMatch([profSpecialty], targetCourse);
console.log(`Match? ${matches}`);

// test with split
const profSpecialty2 = "Nivelación en Informática, Cálculo 1, Matemáticas Discretas";
console.log(`\nSpecialty 2: ${profSpecialty2}`);
console.log(`Match? ${isCleanMatch([profSpecialty2], targetCourse)}`);

// test with slash (the one I suspected)
const profSpecialty3 = "Nivelación en Matemáticas / Nivelación en Informática";
console.log(`\nSpecialty 3: ${profSpecialty3}`);
console.log(`Match? ${isCleanMatch([profSpecialty3], targetCourse)}`);
