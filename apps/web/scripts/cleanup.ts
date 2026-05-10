import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'apps/web/.env.utf8' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://mevfhlhwrrkbhppgeyaj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey!);

async function cleanup() {
    console.log("Limpiando sections 2026-I con IDs corruptos...");
    const { error } = await supabase.from('sche_sections').delete().eq('periodo', '2026-I');
    if (error) console.error("Error:", error);
    else console.log("Limpieza exitosa.");
}

cleanup();
