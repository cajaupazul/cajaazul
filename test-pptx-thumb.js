const { createClient } = require('./apps/converter/node_modules/@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const AdmZip = require('./apps/converter/node_modules/adm-zip');

// Read keys from UTF-16LE env file
const buf = fs.readFileSync(path.join(__dirname, 'apps/web/.env.local'));
let env = buf[0] === 0xFF && buf[1] === 0xFE
    ? buf.toString('utf16le')
    : buf.toString('utf8');

let serviceKey = '';
let anonKey = '';
env.split(/\r?\n/).forEach(l => {
    const cl = l.replace(/\0/g, '');
    const eqIdx = cl.indexOf('=');
    if (eqIdx < 0) return;
    const k = cl.substring(0, eqIdx).trim();
    const v = cl.substring(eqIdx + 1).trim();
    if (k === 'SUPABASE_SERVICE_ROLE_KEY') serviceKey = v;
    if (k === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') anonKey = v;
});

const SUPABASE_URL = 'https://mevfhlhwrrkbhppgeyaj.supabase.co';
const supabase = createClient(SUPABASE_URL, serviceKey);

// HMAC-SHA256 logic to match Worker
function signToken(data, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(data);
    return hmac.digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function testExtraction() {
    console.log('--- PPTX Thumbnail Extraction Test (Signed) ---');

    // 1. Get a PPTX material
    const { data: material, error } = await supabase
        .from('materials')
        .select('id, titulo, url_archivo')
        .ilike('url_archivo', '%.pptx%')
        .limit(1)
        .single();

    if (error || !material) {
        console.error('❌ Could not find a PPTX material:', error);
        return;
    }

    // 2. Extract path and bucket from URL
    // Sample URL: https://.../storage/secure-url?bucket=course-materials&path=...
    const urlObj = new URL(material.url_archivo);
    const bucket = urlObj.searchParams.get('bucket') || 'course-materials';
    const filePath = urlObj.searchParams.get('path');

    if (!filePath) {
        console.error('❌ Could not extract path from URL');
        return;
    }

    console.log(`Processing: ${material.titulo}`);
    console.log(`Path: ${filePath}, Bucket: ${bucket}`);

    // 3. Generate Signed URL for public-stream
    const expiration = Math.floor(Date.now() / 1000) + (15 * 60);
    const payload = JSON.stringify({ p: filePath, b: bucket, e: expiration });
    const payloadB64 = Buffer.from(payload).toString('base64');
    const signature = signToken(payload, anonKey);

    const token = `${payloadB64}.${signature}`;
    const workerBase = 'https://campuslink-api.cajaupazul.workers.dev';
    const signedUrl = `${workerBase}/storage/public-stream?token=${encodeURIComponent(token)}`;

    console.log(`Signed URL: ${signedUrl}`);

    // 4. Download
    const tempFile = 'sample_test.pptx';
    const file = fs.createWriteStream(tempFile);

    https.get(signedUrl, (response) => {
        if (response.statusCode !== 200) {
            console.error(`❌ Download failed. Status: ${response.statusCode}`);
            let body = '';
            response.on('data', c => body += c);
            response.on('end', () => console.log('Error body:', body));
            return;
        }

        response.pipe(file);

        file.on('finish', () => {
            file.close();
            console.log('✅ Download complete.');

            try {
                const zip = new AdmZip(tempFile);
                const zipEntries = zip.getEntries();
                const thumbEntry = zipEntries.find(e => e.entryName.toLowerCase().includes('thumbnail'));

                if (thumbEntry) {
                    console.log(`\n🎉 FOUND NATIVE THUMBNAIL: ${thumbEntry.entryName}`);
                    zip.extractEntryTo(thumbEntry, '.', false, true);
                    console.log(`Extracted to: ${thumbEntry.name}`);
                } else {
                    console.log('\n❌ No thumbnail found in this PPTX.');
                }
            } catch (e) {
                console.error('❌ Zip error:', e.message);
            }
        });
    }).on('error', (err) => {
        console.error(`❌ Download error: ${err.message}`);
    });
}

testExtraction();
