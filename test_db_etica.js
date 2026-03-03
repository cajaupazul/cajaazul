require('dotenv').config({ path: './apps/web/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
    const { data: sections } = await supabase
        .from('sche_sections')
        .select('id, course_id, letter, teacher, periodo')
        .eq('course_id', '120133')
        .eq('letter', 'A');

    console.log('--- SECTIONS (Etica A) ---');
    console.log(JSON.stringify(sections, null, 2));

    if (sections && sections.length > 0) {
        const sectionIds = sections.map(s => s.id);
        const { data: blocks } = await supabase
            .from('sche_schedule_blocks')
            .select('*')
            .in('section_id', sectionIds);

        console.log('\\n--- BLOCKS (Etica A) ---');
        console.log(JSON.stringify(blocks, null, 2));
    }
}

check().catch(console.error);
