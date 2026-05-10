import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'apps/web/.env.utf8' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://mevfhlhwrrkbhppgeyaj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey!);

async function check() {
    console.log("Checking Marketing Estratégico (1MN035)...");
    
    const { data: sections, error } = await supabase
        .from('sche_sections')
        .select('*, sche_schedule_blocks(*)')
        .eq('course_id', '1MN035')
        .eq('periodo', '2026-I');
        
    if (error) {
        console.error("Error fetching:", error.message);
        return;
    }
    
    console.log(`Found ${sections?.length || 0} sections for 1MN035 in 2026-I.`);
    
    if (sections) {
        for (const sec of sections) {
            const blocks = (sec as any).sche_schedule_blocks || [];
            console.log(`Section ${sec.letter}: ${blocks.length} blocks. Teacher: ${sec.teacher}`);
        }
    }
}

check();
