const https = require('https');
const fs = require('fs');
const path = require('path');

// Extract key from .env.local (UTF-16LE)
const buf = fs.readFileSync(path.join(__dirname, 'apps/web/.env.local'));
let envContent;
if (buf[0] === 0xFF && buf[1] === 0xFE) {
    envContent = buf.toString('utf16le').replace(/^\uFEFF/, '');
} else if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    envContent = buf.toString('utf8').replace(/^\uFEFF/, '');
} else {
    envContent = buf.toString('utf8');
}

let key = '';
envContent.split(/\r?\n/).forEach(line => {
    const cleanLine = line.replace(/\0/g, '');
    const eqIdx = cleanLine.indexOf('=');
    if (eqIdx < 0) return;
    const k = cleanLine.substring(0, eqIdx).trim();
    const v = cleanLine.substring(eqIdx + 1).trim();
    if (k === 'SUPABASE_SERVICE_ROLE_KEY' && v) key = v;
});

const SUPABASE_URL = 'https://mevfhlhwrrkbhppgeyaj.supabase.co';
console.log('Key length:', key.length);

// The SQL to execute
const sql = `
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS thumbnail_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Read thumbnails" ON storage.objects;
CREATE POLICY "Public Read thumbnails"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'thumbnails');

DROP POLICY IF EXISTS "Auth Upload thumbnails" ON storage.objects;
CREATE POLICY "Auth Upload thumbnails"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'thumbnails');
`;

// Execute via Supabase REST API
function executeSQL(sql) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(SUPABASE_URL + '/rest/v1/rpc/exec_sql');

        const postData = JSON.stringify({ query: sql });
        const options = {
            hostname: urlObj.hostname,
            path: '/rest/v1/rpc/',
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': 'Bearer ' + key,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            }
        };

        // Use the PostgreSQL REST endpoint
        const postPath = '/rest/v1/rpc/exec_sql';
        options.path = postPath;

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Better approach: use the pg library or supabase-js rpc
// Actually, let's try using the management API

async function main() {
    const { createClient } = require('./apps/converter/node_modules/@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, key);

    console.log('Attempting to add thumbnail_url column...');

    // Try inserting a test to see if column exists
    const { error: checkError } = await supabase
        .from('materials')
        .select('thumbnail_url')
        .limit(1);

    if (checkError && checkError.code === '42703') {
        console.log('Column does not exist. Trying to create it via RPC...');

        // Try using raw query via RPC if available
        const { data, error } = await supabase.rpc('exec_sql', {
            query: 'ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS thumbnail_url text;'
        });

        if (error) {
            console.error('RPC exec_sql failed:', error.message);
            console.log('\n📋 MANUAL ACTION REQUIRED:');
            console.log('Please run this SQL in your Supabase dashboard:\n');
            console.log('ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS thumbnail_url text;');
            console.log('\nGo to: https://supabase.com/dashboard/project/mevfhlhwrrkbhppgeyaj/sql');
        } else {
            console.log('✅ Column added!', data);
        }
    } else if (!checkError) {
        console.log('✅ Column already exists!');

        // Check how many materials lack thumbnails
        const { data: mats } = await supabase
            .from('materials')
            .select('id, name, type, thumbnail_url, file_url')
            .is('thumbnail_url', null)
            .limit(20);

        console.log(`\n${mats?.length || 0} materials without thumbnails:`);
        mats?.forEach(m => console.log(`  - [${m.type}] ${m.name}: file=${m.file_url ? 'YES' : 'NO'}`));
    } else {
        console.error('Unexpected error:', checkError);
    }
}

main();
