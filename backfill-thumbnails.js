/**
 * Backfill script - generates and assigns thumbnail_url for all materials.
 * Strategy: Jimp PNG thumbnails -> Supabase Storage -> Update DB thumbnail_url
 * Run: node backfill-thumbnails.js (from project root)
 */
const { createClient } = require('./apps/converter/node_modules/@supabase/supabase-js');
const { Jimp } = require('./apps/converter/node_modules/jimp');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('./apps/converter/node_modules/uuid');

// Read key from UTF-16LE env file
const buf = fs.readFileSync(path.join(__dirname, 'apps/web/.env.local'));
let env = buf[0] === 0xFF && buf[1] === 0xFE
    ? buf.toString('utf16le').replace(/^\uFEFF/, '')
    : buf.toString('utf8').replace(/^\uFEFF/, '');

let key = '';
env.split(/\r?\n/).forEach(l => {
    const cl = l.replace(/\0/g, '');
    const eqIdx = cl.indexOf('=');
    if (eqIdx < 0) return;
    const k = cl.substring(0, eqIdx).trim();
    const v = cl.substring(eqIdx + 1).trim();
    if (k === 'SUPABASE_SERVICE_ROLE_KEY') key = v;
});

const SUPABASE_URL = 'https://mevfhlhwrrkbhppgeyaj.supabase.co';
const supabase = createClient(SUPABASE_URL, key);

// Color palettes per type (RGBA arrays)
const TYPE_COLORS = {
    ppt: { bg: [140, 60, 20, 255], accent: [200, 100, 40, 255] },
    presentacion: { bg: [140, 60, 20, 255], accent: [200, 100, 40, 255] },
    examen: { bg: [120, 20, 20, 255], accent: [180, 40, 40, 255] },
    syllabus: { bg: [20, 100, 90, 255], accent: [40, 160, 140, 255] },
    enlace: { bg: [20, 40, 120, 255], accent: [50, 80, 200, 255] },
    xls: { bg: [20, 90, 20, 255], accent: [40, 150, 40, 255] },
    excel: { bg: [20, 90, 20, 255], accent: [40, 150, 40, 255] },
    default: { bg: [30, 50, 110, 255], accent: [60, 90, 180, 255] },
};

function getColors(tipo) {
    const t = (tipo || '').toLowerCase();
    for (const [k, colors] of Object.entries(TYPE_COLORS)) {
        if (k !== 'default' && t.includes(k)) return colors;
    }
    return TYPE_COLORS.default;
}

async function generatePlaceholderThumbnail(tipo) {
    const W = 400, H = 280;
    const { bg, accent } = getColors(tipo);

    const img = new Jimp({ width: W, height: H });

    // Apply gradient using scan (Jimp v1 compatible)
    img.scan(0, 0, W, H, function (x, y, idx) {
        const t = y / H;
        this.bitmap.data[idx] = Math.round(bg[0] + (accent[0] - bg[0]) * t * 0.5); // R
        this.bitmap.data[idx + 1] = Math.round(bg[1] + (accent[1] - bg[1]) * t * 0.5); // G
        this.bitmap.data[idx + 2] = Math.round(bg[2] + (accent[2] - bg[2]) * t * 0.5); // B
        this.bitmap.data[idx + 3] = 255;                                                // A
    });

    // Left accent bar (8px)
    img.scan(0, 0, 8, H, function (x, y, idx) {
        this.bitmap.data[idx] = accent[0];
        this.bitmap.data[idx + 1] = accent[1];
        this.bitmap.data[idx + 2] = accent[2];
        this.bitmap.data[idx + 3] = 255;
    });

    // Brighter header band (top 60px)
    img.scan(8, 0, W - 8, 60, function (x, y, idx) {
        this.bitmap.data[idx] = Math.min(255, this.bitmap.data[idx] + 30);
        this.bitmap.data[idx + 1] = Math.min(255, this.bitmap.data[idx + 1] + 30);
        this.bitmap.data[idx + 2] = Math.min(255, this.bitmap.data[idx + 2] + 30);
    });

    return await img.getBuffer('image/png');
}

async function backfill() {
    console.log('🔄 Starting thumbnail backfill...');
    console.log(`Key length: ${key.length}`);

    const { data: materials, error } = await supabase
        .from('materials')
        .select('id, titulo, tipo')
        .is('thumbnail_url', null);

    if (error) {
        console.error('❌ Error fetching materials:', error.message, error.code);
        return;
    }

    console.log(`Found ${materials.length} materials without thumbnails.\n`);

    let successCount = 0;
    let failCount = 0;

    for (const material of materials) {
        try {
            process.stdout.write(`[${material.tipo}] ${material.titulo}... `);

            const pngBuffer = await generatePlaceholderThumbnail(material.tipo);
            const fileName = `thumb_${material.id}.png`;

            const { error: uploadError } = await supabase
                .storage
                .from('thumbnails')
                .upload(fileName, pngBuffer, { contentType: 'image/png', upsert: true });

            if (uploadError) {
                console.log(`❌ Upload: ${uploadError.message}`);
                failCount++;
                continue;
            }

            const { data: urlData } = supabase.storage.from('thumbnails').getPublicUrl(fileName);

            const { error: updateError } = await supabase
                .from('materials')
                .update({ thumbnail_url: urlData.publicUrl })
                .eq('id', material.id);

            if (updateError) {
                console.log(`❌ DB: ${updateError.message}`);
                failCount++;
                continue;
            }

            console.log('✅');
            successCount++;
        } catch (e) {
            console.log(`❌ ${e.message}`);
            failCount++;
        }
    }

    console.log(`\n✨ Done: ${successCount} success, ${failCount} failed`);
}

backfill().catch(console.error);
