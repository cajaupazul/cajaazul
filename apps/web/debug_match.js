const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://emsbaasg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtc2JhYXNnIiwiaWF0IjoxNzM2ODcxMTM3LCJleHAiOjIwNTI0NDcxMzd9.05d270794-2624882322a66e9660647af41564f0'; // Derived from earlier chunks + common knowledge of format

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMatch() {
  const targetCourse = "NIVELACIÓN EN MATEMÁTICAS";
  const targetCourseId = '2a88...'; // Not needed yet

  console.log(`Checking matching for: "${targetCourse}"`);

  const { data: profs, error } = await supabase
    .from('professors')
    .select('*')
    .ilike('nombre', '%SENMACHE SARMIENTO%');

  if (error) {
    console.error('Error fetching professor:', error);
    return;
  }

  profs.forEach(p => {
    console.log(`\nProfessor: ${p.nombre}`);
    console.log(`Specialty: "${p.especialidad}"`);
    console.log(`Other Courses: "${p.otros_cursos}"`);
    
    const profCourses = [
      p.especialidad,
      ...(p.otros_cursos ? (p.otros_cursos.split ? p.otros_cursos.split(/[,;|•]/) : [p.otros_cursos]) : [])
    ].filter(Boolean).map(c => c.trim());

    console.log('Processed Courses:', profCourses);
    
    const normalizeString = (str) => {
      return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    };

    const targetNorm = normalizeString(targetCourse);
    const matches = profCourses.some(c => normalizeString(c) === targetNorm);
    console.log(`Matches "${targetCourse}"? ${matches}`);
    
    // Check if linked via junction
    supabase.from('course_professors')
      .select('course_id, courses(nombre)')
      .eq('professor_id', p.id)
      .then(({data, error}) => {
         if (data && data.length > 0) {
           console.log('Linked Courses (Junction):', data.map(d => d.courses.nombre));
         } else {
           console.log('No Junction table links found.');
         }
      });

    // Check if contributor via materials
    supabase.from('materials')
      .select('course_id, courses(nombre)')
      .eq('professor_id', p.id)
      .then(({data, error}) => {
         if (data && data.length > 0) {
           console.log('Contributor in Courses (Materials):', [...new Set(data.map(d => d.courses.nombre))]);
         } else {
           console.log('No Material links found.');
         }
      });
  });
}

checkMatch();
