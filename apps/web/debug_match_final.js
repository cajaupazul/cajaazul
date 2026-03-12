const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://emsbaasg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtc2JhYXNnIiwiaWF0IjoxNzM2ODcxMTM3LCJleHAiOjIwNTI0NDcxMzd9.05d270794-2624882322a66e9660647af41564f0');

async function debug() {
  const courseName = 'NIVELACIÓN EN MATEMÁTICAS';
  
  // Find course first
  const { data: c, error: cErr } = await supabase.from('courses').select('id, nombre').ilike('nombre', courseName).limit(1).maybeSingle();
  if (!c) {
    console.log('Course not found with name:', courseName);
    return;
  }
  console.log(`Analyzing Course: ${c.nombre} (ID: ${c.id})`);

  // Fetch junction data for this course
  const { data: junctionData, error: jErr } = await supabase.from('course_professors').select('professor_id').eq('course_id', c.id);
  const linkedProfIds = new Set(junctionData?.map(cp => cp.professor_id) || []);
  console.log(`Total professors linked in DB: ${linkedProfIds.size}`);

  // Fetch professors (pool)
  const { data: profsData, error: pErr } = await supabase.from('professors').select('id, nombre, especialidad, otros_cursos').limit(200);

  const normalizeString = (str) => {
    if (!str) return '';
    return String(str)
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

  console.log('\nResults:');
  profsData.forEach(p => {
    const isLinked = linkedProfIds.has(p.id);
    const profCourses = [
      p.especialidad,
      ...(p.otros_cursos ? (typeof p.otros_cursos === 'string' ? p.otros_cursos.split(/[,;|•/]/) : (Array.isArray(p.otros_cursos) ? p.otros_cursos : [p.otros_cursos])) : [])
    ].filter(Boolean);

    const matchesName = isCleanMatch(profCourses, c.nombre);

    if (isLinked || matchesName) {
      console.log(`[FOUND] ${p.nombre}`);
      console.log(`  - Specialty: ${p.especialidad}`);
      console.log(`  - Others: ${p.otros_cursos}`);
      console.log(`  - Reason: ${isLinked ? 'LINKED' : ''} ${matchesName ? 'NAME_MATCH' : ''}`);
    }
  });
}

debug().catch(console.error);
