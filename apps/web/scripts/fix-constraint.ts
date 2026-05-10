import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'apps/web/.env.utf8' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://mevfhlhwrrkbhppgeyaj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey!);

async function fixConstraint() {
    console.log("Intentando arreglar el constraint de sche_sections...");
    const { data, error } = await supabase.rpc('exec', { 
        sql: `
        ALTER TABLE public.sche_sections DROP CONSTRAINT IF EXISTS sche_sections_course_id_letter_key;
        ALTER TABLE public.sche_sections DROP CONSTRAINT IF EXISTS sche_sections_course_id_letter_periodo_key;
        ALTER TABLE public.sche_sections ADD CONSTRAINT sche_sections_course_id_letter_periodo_key UNIQUE (course_id, letter, periodo);
        `
    });
    
    if (error) console.error("Error arreglando constraint:", error.message);
    else console.log("Constraint arreglado exitosamente.");
}

fixConstraint();
