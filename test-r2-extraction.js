const { S3Client, GetObjectCommand } = require('./apps/converter/node_modules/@aws-sdk/client-s3');
const { createClient } = require('./apps/converter/node_modules/@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const AdmZip = require('./apps/converter/node_modules/adm-zip');

// Read config from apps/converter/.env
const envText = fs.readFileSync('apps/converter/.env', 'utf8');
const config = {};
envText.split(/\r?\n/).forEach(line => {
    const eq = line.indexOf('=');
    if (eq > 0) config[line.substring(0, eq).trim()] = line.substring(eq + 1).trim();
});

const s3 = new S3Client({
    endpoint: config.R2_ENDPOINT,
    credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
    },
    region: 'auto',
});

// Use confirmed working key from web/.env.local (UTF-16LE handle)
const webEnvBuf = fs.readFileSync(path.join(__dirname, 'apps/web/.env.local'));
const webEnv = webEnvBuf[0] === 0xFF && webEnvBuf[1] === 0xFE
    ? webEnvBuf.toString('utf16le').replace(/^\uFEFF/, '')
    : webEnvBuf.toString('utf8').replace(/^\uFEFF/, '');

let realServiceKey = '';
webEnv.split(/\r?\n/).forEach(l => {
    const cl = l.replace(/\0/g, '');
    if (cl.includes('SUPABASE_SERVICE_ROLE_KEY')) realServiceKey = cl.split('=')[1].trim();
});

const supabase = createClient(config.SUPABASE_URL, realServiceKey);

async function testR2Download() {
    console.log('--- R2 Direct Download & Extraction Test ---');

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

    // Extract path from URL
    const urlObj = new URL(material.url_archivo);
    const filePath = urlObj.searchParams.get('path');
    const bucket = urlObj.searchParams.get('bucket') || config.R2_BUCKET_NAME;

    console.log(`Downloading: ${filePath} from bucket: ${bucket}`);

    try {
        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: filePath,
        });

        const response = await s3.send(command);
        const tempFile = 'sample_r2.pptx';
        const writeStream = fs.createWriteStream(tempFile);

        // Convert web stream to node stream
        const body = response.Body;
        if (body.pipe) {
            body.pipe(writeStream);
        } else {
            // For newer SDKs it might be different, but usually it works
            const reader = body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                writeStream.write(value);
            }
            writeStream.end();
        }

        await new Promise((resolve) => writeStream.on('finish', resolve));
        console.log('✅ Download successful.');

        // 2. Extract
        const zip = new AdmZip(tempFile);
        const thumbEntry = zip.getEntries().find(e => e.entryName.toLowerCase().includes('thumbnail'));

        if (thumbEntry) {
            console.log(`\n🎉 FOUND NATIVE THUMBNAIL: ${thumbEntry.entryName}`);
            zip.extractEntryTo(thumbEntry, '.', false, true);
            console.log(`Extracted: ${thumbEntry.name}`);
        } else {
            console.log('\n❌ No thumbnail in this PPTX.');
        }

    } catch (e) {
        console.error(`❌ Error: ${e.message}`);
    }
}

testR2Download();
