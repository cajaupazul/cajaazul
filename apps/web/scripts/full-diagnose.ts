import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: 'apps/web/.env.utf8' });

const supabase = createClient(
    'https://mevfhlhwrrkbhppgeyaj.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fullDiagnose() {
    // 1. How many courses in sche_courses?
    const { count: courseCount } = await supabase.from('sche_courses').select('*', { count: 'exact', head: true });
    console.log(`Total courses in sche_courses: ${courseCount}`);

    // 2. How many sections in 2026-I?
    const { count: sectionCount } = await supabase.from('sche_sections').select('*', { count: 'exact', head: true }).eq('periodo', '2026-I');
    console.log(`Total sections in 2026-I: ${sectionCount}`);

    // 3. How many distinct courses HAVE sections in 2026-I?
    const { data: sections } = await supabase.from('sche_sections').select('course_id').eq('periodo', '2026-I');
    const uniqueCourseIds = new Set(sections?.map(s => s.course_id) || []);
    console.log(`Distinct courses with sections in 2026-I: ${uniqueCourseIds.size}`);

    // 4. Check parsed_offer.json
    const parsed = JSON.parse(fs.readFileSync('parsed_offer.json', 'utf-8'));
    console.log(`\nTotal courses in parsed_offer.json: ${parsed.length}`);
    
    // Which parsed courses are NOT in DB sections?
    const missingFromDB = parsed.filter(c => !uniqueCourseIds.has(c.codigo));
    console.log(`\nParsed but NOT in sche_sections 2026-I: ${missingFromDB.length}`);
    missingFromDB.slice(0, 20).forEach(c => {
        console.log(`  ${c.codigo} - ${c.nombre} (${c.sections.length} sections in JSON)`);
    });

    // 5. Check 132641 specifically
    console.log('\n--- Economía General I (132641) ---');
    const eco = parsed.find(c => c.codigo === '132641');
    console.log('In parsed JSON?', !!eco);
    if (eco) console.log('Sections in JSON:', eco.sections.length);

    const { data: ecoSecs } = await supabase.from('sche_sections').select('*').eq('course_id', '132641');
    console.log('In sche_sections (any period)?', ecoSecs?.length, ecoSecs?.map(s => s.id));
}

fullDiagnose();
