import Fastify from 'fastify';
import cors from '@fastify/cors';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { processConversion } from './processor';

dotenv.config();

const fastify = Fastify({ logger: true });

// Supabase (solo para el health check de /status)
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── In-Memory Job Queue (sin Redis, sin BullMQ) ──────────────────────────────
// Un proceso único en Render no necesita Redis para coordinarse.
// BullMQ con el plan gratuito de Render Valkey usa allkeys-lru (no noeviction),
// lo que hace que los jobs se eliminen antes de procesarse. Esta solución es
// más simple, confiable y no depende de ningún servicio externo adicional.

interface ConversionJob {
    jobId: string;
    key: string;
    bucket: string;
    createdAt: number;
}

const jobQueue: ConversionJob[] = [];
const jobStatus: Map<string, { state: string; error?: string; result?: any }> = new Map();
let isProcessing = false;

async function runQueue() {
    if (isProcessing) return;
    isProcessing = true;

    while (jobQueue.length > 0) {
        const job = jobQueue.shift()!;
        jobStatus.set(job.jobId, { state: 'active' });
        console.log(`[QUEUE] Processing job ${job.jobId} — key: ${job.key}`);

        try {
            const result = await processConversion({
                key: job.key,
                bucket: job.bucket,
                jobId: job.jobId,
            });
            jobStatus.set(job.jobId, { state: 'completed', result });
            console.log(`[QUEUE] ✅ Job ${job.jobId} completed`);
        } catch (err: any) {
            jobStatus.set(job.jobId, { state: 'failed', error: err.message });
            console.error(`[QUEUE] ❌ Job ${job.jobId} failed:`, err.message);
        }
    }

    isProcessing = false;
}

// ─── Register plugins ─────────────────────────────────────────────────────────
fastify.register(cors, {
    origin: (origin, cb) => {
        if (
            !origin ||
            origin.includes('localhost') ||
            origin.includes('127.0.0.1') ||
            origin.endsWith('.pages.dev')
        ) {
            cb(null, true);
            return;
        }
        cb(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
    credentials: true,
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check / warmup ping
fastify.get('/', async () => ({
    status: 'ok',
    service: 'campus-link-converter',
    queue: { pending: jobQueue.length, processing: isProcessing },
}));

// Trigger conversion for file already stored in R2
fastify.post('/convert-stored', async (req, reply) => {
    const { key, bucket } = req.body as { key: string; bucket: string };

    if (!key || !bucket) {
        return reply.code(400).send({ error: 'Missing key or bucket in request body' });
    }

    const jobId = uuidv4();
    const job: ConversionJob = { jobId, key, bucket, createdAt: Date.now() };

    jobQueue.push(job);
    jobStatus.set(jobId, { state: 'waiting' });

    console.log(`[CONVERTER] Job ${jobId} queued for key: ${key}`);

    // Start processing in the background (non-blocking)
    setImmediate(() => runQueue().catch(console.error));

    return reply.code(202).send({
        jobId,
        status: 'queued',
        message: 'Conversion job queued successfully',
    });
});

// Job status endpoint
fastify.get('/status/:id', async (req: any, reply) => {
    const { id } = req.params as { id: string };
    const status = jobStatus.get(id);

    if (!status) {
        return reply.code(404).send({ error: 'Job not found' });
    }

    return { jobId: id, ...status };
});

// Queue + service health status
fastify.get('/status', async () => {
    let supabaseStatus = 'unknown';
    try {
        const { error } = await supabase
            .from('materials')
            .select('id', { count: 'exact', head: true })
            .limit(1);
        supabaseStatus = error ? `Error: ${error.message}` : 'OK';
    } catch (e: any) {
        supabaseStatus = `Exception: ${e.message}`;
    }

    return {
        service: 'campus-link-converter',
        queue: {
            pending: jobQueue.length,
            processing: isProcessing,
        },
        connectivity: {
            supabase: supabaseStatus,
            env: {
                has_r2_key: !!process.env.R2_ACCESS_KEY_ID,
                has_supabase_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
                node_env: process.env.NODE_ENV,
            },
        },
    };
});

// ─── Start ────────────────────────────────────────────────────────────────────
const start = async () => {
    try {
        const port = parseInt(process.env.PORT || '3000');
        await fastify.listen({ port, host: '0.0.0.0' });
        console.log(`🚀 Converter running on port ${port} (no Redis required)`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
