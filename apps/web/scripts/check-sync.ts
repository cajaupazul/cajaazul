import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: 'apps/web/.env.utf8' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://mevfhlhwrrkbhppgeyaj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey!);

async function check() {
    const { count, error } = await supabase
        .from('oferta_academica')
        .select('*', { count: 'exact', head: true })
        .eq('periodo', '2026-I');
    
    if (error) console.error(error);
    console.log(`Registros en oferta_academica para 2026-I: ${count}`);
}

check();
