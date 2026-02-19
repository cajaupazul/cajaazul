const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const converterDir = path.join(rootDir, 'apps/converter');
const nodeModules = path.join(converterDir, 'node_modules');

const cRequire = (mod) => require(path.join(nodeModules, mod));

const { S3Client, GetObjectCommand } = cRequire('@aws-sdk/client-s3');
const { createClient } = cRequire('@supabase/supabase-js');
const { createCanvas } = cRequire('canvas');
const pdfjs = cRequire('pdfjs-dist/legacy/build/pdf');

// Read config
const envText = fs.readFileSync(path.join(converterDir, '.env'), 'utf8');
const config = {};
envText.split(/\r?\n/).forEach(line => {
    const eq = line.indexOf('=');
    if (eq > 0) config[line.substring(0, eq).trim()] = line.substring(eq + 1).trim();
});

// Read service role key
const webEnvBuf = fs.readFileSync(path.join(rootDir, 'apps/web/.env.local'));
const webEnv = webEnvBuf[0] === 0xFF && webEnvBuf[1] === 0xFE ? webEnvBuf.toString('utf16le') : webEnvBuf.toString('utf8');
let serviceKey = '';
webEnv.split(/\r?\n/).forEach(l => {
    const cl = l.replace(/\0/g, '');
    const eqIdx = cl.indexOf('=');
    if (eqIdx > 0 && cl.substring(0, eqIdx).trim() === 'SUPABASE_SERVICE_ROLE_KEY') {
        serviceKey = cl.substring(eqIdx + 1).trim();
    }
});

const s3 = new S3Client({
    endpoint: config.R2_ENDPOINT,
    credentials: { accessKeyId: config.R2_ACCESS_KEY_ID, secretAccessKey: config.R2_SECRET_ACCESS_KEY },
    region: 'auto',
});
const supabase = createClient(config.SUPABASE_URL, serviceKey);

async function processPdf(material) {
    console.log(`\n📄 Processing PDF: ${material.titulo}`);

    const urlObj = new URL(material.url_archivo);
    const filePath = urlObj.searchParams.get('path');
    const bucket = urlObj.searchParams.get('bucket') || 'course-materials';

    try {
        const command = new GetObjectCommand({ Bucket: bucket, Key: filePath });
        const response = await s3.send(command);
        const chunks = [];
        for await (const chunk of response.Body) chunks.push(chunk);
        const pdfBuffer = Buffer.concat(chunks);

        const loadingTask = pdfjs.getDocument({
            data: new Uint8Array(pdfBuffer),
            disableFontFace: true,
            useSystemFonts: false
        });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        const scale = 1.0;
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        const pngBuffer = canvas.toBuffer('image/png');

        const fileName = `thumb_real_${material.id}.png`;
        const { error: uploadError } = await supabase.storage
            .from('thumbnails')
            .upload(fileName, pngBuffer, { contentType: 'image/png', upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('thumbnails').getPublicUrl(fileName);

        const { error: updateError } = await supabase
            .from('materials')
            .update({ thumbnail_url: urlData.publicUrl })
            .eq('id', material.id);

        if (updateError) throw updateError;

        console.log(`✅ Success: ${urlData.publicUrl}`);
    } catch (e) {
        console.error(`❌ Failed: ${e.message}`);
    }
}

async function main() {
    const { data: materials } = await supabase
        .from('materials')
        .select('*')
        .eq('tipo', 'syllabus');

    console.log(`Found ${materials.length} syllabus files.`);
    for (const m of materials) await processPdf(m);
    console.log('\n✨ Finished PDF previews.');
    process.exit(0);
}

main();
