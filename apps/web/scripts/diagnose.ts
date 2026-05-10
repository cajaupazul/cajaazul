import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'apps/web/.env.utf8' });

// Use the ANON key to simulate what the browser sees
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ldmZobGh3cnJrYmhwcGdleWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDgyMDIsImV4cCI6MjA3NzUyNDIwMn0.E_Rhnhh8dbRiBLTg52HpDfJSqv2Q_hE-mSjHlkLF2IE';
const SUPABASE_URL = 'https://mevfhlhwrrkbhppgeyaj.supabase.co';

const anonClient = createClient(SUPABASE_URL, ANON_KEY);

// Use service role key to compare
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function diagnose() {
    console.log('\n=== DIAGNÓSTICO CON SERVICE ROLE KEY ===');
    const { data: periods } = await supabase.from('sche_sections').select('periodo');
    const uniquePeriods = [...new Set(periods?.map(p => p.periodo) || [])];
    console.log('Periodos en sche_sections:', uniquePeriods);

    const { count: totalSections } = await supabase.from('sche_sections').select('*', { count: 'exact', head: true }).eq('periodo', '2026-I');
    console.log('Total secciones 2026-I:', totalSections);
    
    const { data: mn035 } = await supabase.from('sche_sections').select('id, course_id, letter').eq('course_id', '1MN035');
    console.log('Secciones 1MN035:', mn035?.length, mn035?.map(s => s.id));

    const { data: course } = await supabase.from('sche_courses').select('*').eq('id', '1MN035').single();
    console.log('Curso 1MN035 en sche_courses:', course);

    console.log('\n=== DIAGNÓSTICO CON ANON KEY (lo que ve el browser) ===');
    const { data: anonPeriods, error: aErr } = await anonClient.from('sche_sections').select('periodo').limit(1);
    console.log('Anon puede leer sche_sections?', anonPeriods !== null, aErr?.message || '');
    
    const { data: anonCourse, error: aCErr } = await anonClient.from('sche_courses').select('*').eq('id', '1MN035').single();
    console.log('Anon puede ver 1MN035 en sche_courses?', !!anonCourse, aCErr?.message || '');

    const { data: anonSections, error: aSErr } = await anonClient.from('sche_sections').select('id').eq('course_id', '1MN035');
    console.log('Anon puede ver secciones de 1MN035?', anonSections?.length, aSErr?.message || '');
}

diagnose();
