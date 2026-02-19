/**
 * BACKFILL PREMIUM - Generates high-quality thumbnails with real titles.
 * Uses 'canvas' for professional typography and gradients.
 */
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('./apps/converter/node_modules/canvas');
const { createClient } = require('./apps/converter/node_modules/@supabase/supabase-js');

// 1. Setup credentials
const rootDir = __dirname;
const webEnvBuf = fs.readFileSync(path.join(rootDir, 'apps/web/.env.local'));
const webEnv = webEnvBuf[0] === 0xFF && webEnvBuf[1] === 0xFE ? webEnvBuf.toString('utf16le') : webEnvBuf.toString('utf8');
let serviceKey = '';
webEnv.split(/\r?\n/).forEach(l => {
    const cl = l.replace(/\0/g, '');
    if (cl.includes('SUPABASE_SERVICE_ROLE_KEY')) serviceKey = cl.split('=')[1].trim();
});

const SUPABASE_URL = 'https://mevfhlhwrrkbhppgeyaj.supabase.co';
const supabase = createClient(SUPABASE_URL, serviceKey);

// 2. Design configurations
const TYPE_CONFIG = {
    ppt: { bg: ['#46200B', '#92400E'], accent: '#F59E0B', label: 'PRESENTACIÓN' },
    presentacion: { bg: ['#46200B', '#92400E'], accent: '#F59E0B', label: 'PRESENTACIÓN' },
    examen: { bg: ['#450A0A', '#991B1B'], accent: '#EF4444', label: 'EXAMEN' },
    syllabus: { bg: ['#062D2D', '#115E59'], accent: '#14B8A6', label: 'SÍLABO' },
    enlace: { bg: ['#172554', '#1E40AF'], accent: '#3B82F6', label: 'ENLACE' },
    xls: { bg: ['#063D1F', '#166534'], accent: '#22C55E', label: 'EXCEL' },
    default: { bg: ['#171717', '#262626'], accent: '#3B82F6', label: 'MATERIAL' }
};

function getConfig(tipo) {
    const t = (tipo || '').toLowerCase();
    for (const [k, conf] of Object.entries(TYPE_CONFIG)) {
        if (k !== 'default' && t.includes(k)) return conf;
    }
    return TYPE_CONFIG.default;
}

async function generatePremiumThumbnail(titulo, tipo) {
    const W = 600, H = 400;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    const conf = getConfig(tipo);

    // Background Gradient
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, conf.bg[0]);
    grad.addColorStop(1, conf.bg[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Dynamic Patterns based on type
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#FFFFFF';
    const isExamen = tipo.toLowerCase().includes('examen');

    if (isExamen) {
        // Subtle diagonal stripes for Exams (more subtle and vertical)
        for (let i = -W; i < W + H; i += 60) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + 15, 0);
            ctx.lineTo(i + 15 - H * 0.5, H);
            ctx.lineTo(i - H * 0.5, H);
            ctx.fill();
        }
    } else {
        // Subtle circles for other types
        ctx.beginPath(); ctx.arc(W * 0.9, H * 0.1, 200, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(W * 0.1, H * 0.9, 100, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Accent Bar
    ctx.fillStyle = conf.accent;
    ctx.fillRect(0, 0, 15, H);

    // Responsive Title Text
    ctx.fillStyle = '#FFFFFF';

    // Auto-scaling font size based on title length
    let fontSize = 42;
    if (titulo.length > 25) fontSize = 36;
    if (titulo.length > 50) fontSize = 30;
    if (titulo.length > 80) fontSize = 24;
    ctx.font = `bold ${fontSize}px sans-serif`;

    const maxWidth = W - 120;
    const words = titulo.split(' ');
    let line = '';
    let lines = [];

    for (const word of words) {
        let testLine = line + word + ' ';
        if (ctx.measureText(testLine).width > maxWidth && line !== '') {
            lines.push(line);
            line = word + ' ';
        } else {
            line = testLine;
        }
    }
    lines.push(line);

    // Center text vertically (no badge anymore, so we take more space)
    const totalHeight = lines.length * fontSize * 1.2;
    let y = (H / 2) - (totalHeight / 2) + fontSize * 0.8;

    for (const l of lines) {
        ctx.fillText(l.trim(), 60, y);
        y += fontSize * 1.2;
    }

    // Modern footer
    ctx.globalAlpha = 0.3;
    ctx.font = '10px sans-serif';
    ctx.fillText('PREVISUALIZACIÓN OPTIMIZADA', 60, H - 25);

    return canvas.toBuffer('image/png');
}

async function start() {
    console.log('🚀 Finalizing Premium Backfill...');

    const { data: materials, error } = await supabase
        .from('materials')
        .select('id, titulo, tipo');

    if (error) {
        console.error('Error fetching:', error);
        return;
    }

    console.log(`Processing ${materials.length} materials...`);

    for (const m of materials) {
        try {
            process.stdout.write(`Rendering ${m.titulo}... `);
            const png = await generatePremiumThumbnail(m.titulo, m.tipo);
            const fName = `thumb_premium_${m.id}.png`;

            const { error: upErr } = await supabase.storage
                .from('thumbnails')
                .upload(fName, png, { contentType: 'image/png', upsert: true });

            if (upErr) throw upErr;

            const { data: urlData } = supabase.storage.from('thumbnails').getPublicUrl(fName);

            await supabase
                .from('materials')
                .update({ thumbnail_url: urlData.publicUrl })
                .eq('id', m.id);

            console.log('✅');
        } catch (e) {
            console.log(`❌ ${e.message}`);
        }
    }

    console.log('\n✨ Premium conversion completed.');
    process.exit(0);
}

start();
