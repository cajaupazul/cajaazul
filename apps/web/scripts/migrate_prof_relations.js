const { createClient } = require('@supabase/supabase-js');

// Use environment variables or hardcode for one-time run
const SUPABASE_URL = 'https://mevfhlhwrrkbhppgeyaj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ldmZobGh3cnJrYmhwcGdleWFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTk0ODIwMiwiZXhwIjoyMDc3NTI0MjAyfQ.yfwGSE1BBT7LLlJrZRzdnLarXh-nE2BGvPX9SqfonYA';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalize(str) {
  if (!str) return '';
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

async function migrate() {
  console.log('--- STARTING MIGRATION ---');

  // 1. Fetch Courses
  const { data: courses, error: courseError } = await supabase.from('courses').select('id, nombre');
  if (courseError) {
    console.error('Error fetching courses:', courseError);
    return;
  }
  console.log(`Found ${courses.length} courses.`);

  const courseMap = new Map();
  courses.forEach(c => {
    courseMap.set(normalize(c.nombre), c.id);
  });

  // 2. Fetch Professors
  const { data: professors, error: profError } = await supabase.from('professors').select('id, nombre, especialidad, otros_cursos');
  if (profError) {
    console.error('Error fetching professors:', profError);
    return;
  }
  console.log(`Found ${professors.length} professors.`);

  const relations = [];

  professors.forEach(p => {
    const rawCourses = [
      p.especialidad,
      ...(p.otros_cursos ? (typeof p.otros_cursos === 'string' ? p.otros_cursos.split(/[,;|•/]/) : []) : [])
    ].filter(Boolean);

    const uniqueNormCourses = [...new Set(rawCourses.map(normalize))];

    uniqueNormCourses.forEach(nc => {
      const courseId = courseMap.get(nc);
      if (courseId) {
        relations.push({
          professor_id: p.id,
          course_id: courseId
        });
      } else {
          // Optional: fuzzy search or log missing courses
          // console.log(`  Course not found for: ${nc}`);
      }
    });
  });

  console.log(`Prepared ${relations.length} relations to insert.`);

  // 3. Insert Relations (Upsert to avoid duplicates if constraints are already there)
  if (relations.length > 0) {
    // Break into chunks to avoid request size limits
    const CHUNK_SIZE = 100;
    for (let i = 0; i < relations.length; i += CHUNK_SIZE) {
      const chunk = relations.slice(i, i + CHUNK_SIZE);
      const { error: insertError } = await supabase
        .from('course_professors')
        .upsert(chunk, { onConflict: 'professor_id, course_id' });

      if (insertError) {
        console.error(`Error inserting chunk ${i}:`, insertError);
      } else {
        console.log(`  Inserted chunk starting at ${i}`);
      }
    }
  }

  console.log('--- MIGRATION COMPLETE ---');
}

migrate();
