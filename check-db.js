const { createClient } = require('./apps/converter/node_modules/@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function checkDb() {
    try {
        const envPath = path.join(__dirname, 'apps/web/.env.local');
        // Read as buffer, then decode as UTF-16LE (handles the BOM too)
        const buf = fs.readFileSync(envPath);

        // Detect encoding: UTF-16LE has BOM FF FE, UTF-8 has EF BB BF
        let envContent;
        if (buf[0] === 0xFF && buf[1] === 0xFE) {
            // UTF-16LE with BOM
            envContent = buf.toString('utf16le').replace(/^\uFEFF/, '');
        } else if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
            // UTF-8 with BOM
            envContent = buf.toString('utf8').replace(/^\uFEFF/, '');
        } else {
            envContent = buf.toString('utf8');
        }

        const lines = envContent.split(/\r?\n/);

        let url = '';
        let key = '';

        lines.forEach(line => {
            // Remove null chars that can appear in UTF-16 conversion
            const cleanLine = line.replace(/\0/g, '');
            const eqIdx = cleanLine.indexOf('=');
            if (eqIdx < 0) return;
            const k = cleanLine.substring(0, eqIdx).trim();
            const v = cleanLine.substring(eqIdx + 1).trim();

            if (k === 'NEXT_PUBLIC_SUPABASE_URL' && v) {
                url = v;
                console.log('Found URL:', url.substring(0, 30) + '...');
            }
            if (k === 'SUPABASE_SERVICE_ROLE_KEY' && v) {
                key = v;
                console.log('Found Key (length):', key.length);
            }
        });

        if (!url) {
            // Fallback: use known Supabase URL from project context
            url = 'https://mevfhlhwrrkbhppgeyaj.supabase.co';
            console.log('Using fallback URL:', url);
        }

        console.log('\nConnecting to Supabase...');
        const supabase = createClient(url, key);

        // Check if thumbnail_url column exists and has data
        const { data, error } = await supabase
            .from('materials')
            .select('id, name, type, thumbnail_url, file_url')
            .limit(10);

        if (error) {
            console.error('Error querying materials:', error.message, error.code);
            if (error.code === '42703') {
                console.log('\n❌ CRITICAL: Column thumbnail_url does NOT exist! Run the migration SQL first.');
            }
        } else {
            console.log('\n✅ Query successful. Sample materials:');
            data.forEach(m => {
                console.log(`  - [${m.type}] ${m.name}: thumbnail=${m.thumbnail_url ? '✅' : '❌'}, file=${m.file_url ? '✅' : '❌'}`);
            });

            const withThumb = data.filter(m => m.thumbnail_url).length;
            console.log(`\nSummary: ${data.length} materials checked, ${withThumb} have thumbnails.`);
        }
    } catch (err) {
        console.error('Unexpected error:', err.message);
    }
}

checkDb();
