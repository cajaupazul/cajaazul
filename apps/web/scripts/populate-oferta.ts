import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: 'apps/web/.env.utf8' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://mevfhlhwrrkbhppgeyaj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Faltan variables de entorno");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const PERIODO = '2026-I';

async function populateOfertaAcademica() {
    const { data, error } = await supabase.rpc('get_oferta_columns'); // Try simple query instead
    
    // Actually, just query 1 row to see keys
    const { data: rows } = await supabase.from('oferta_academica').select('*').limit(1);
    
    if (rows && rows.length > 0) {
        console.log("Columnas existentes:", Object.keys(rows[0]));
    } else {
        // If empty, insert a dummy row and rollback, or just use another method
        const { error: err } = await supabase.from('oferta_academica').insert({ 
            id: '123e4567-e89b-12d3-a456-426614174000',
            fake_col: 'test'
        });
        console.log("Error de insert:", err?.message);
    }
}

populateOfertaAcademica();
