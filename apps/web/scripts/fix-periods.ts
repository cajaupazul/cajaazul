import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'apps/web/.env.utf8' });

const supabase = createClient(
    'https://mevfhlhwrrkbhppgeyaj.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fix() {
    console.log('1. Borrando secciones con "Periodo sin identificar"...');
    const { error: delErr } = await supabase
        .from('sche_sections')
        .delete()
        .eq('periodo', 'Periodo sin identificar');
    if (delErr) console.error('Error borrando:', delErr.message);
    else console.log('✓ Secciones corruptas borradas.');

    console.log('\n2. Verificando periodos ahora...');
    const { data: periods } = await supabase.from('sche_sections').select('periodo');
    const unique = [...new Set(periods?.map(p => p.periodo))];
    console.log('Periodos en la BD:', unique);

    console.log('\n3. Arreglando RLS policies para que usuarios autenticados puedan leer...');
    // We'll print the SQL to run manually
    console.log(`
Por favor, ejecuta en Supabase SQL Editor:

DROP POLICY IF EXISTS "sche_courses_select" ON public.sche_courses;
CREATE POLICY "sche_courses_select" ON public.sche_courses 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "sche_sections_select" ON public.sche_sections;
CREATE POLICY "sche_sections_select" ON public.sche_sections 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "sche_schedule_blocks_select" ON public.sche_schedule_blocks;
CREATE POLICY "sche_schedule_blocks_select" ON public.sche_schedule_blocks 
  FOR SELECT USING (true);
`);
}

fix();
