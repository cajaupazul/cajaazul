import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { processConversion } from './processor';
import {
    claimNextJob,
    completeJob,
    enqueueLegacyJob,
    failJob,
    getJobStatus,
    getQueueSummary,
    workerId,
} from './queue';

dotenv.config();

const fastify = Fastify({ logger: true });
let isDraining = false;
let retryTimer: NodeJS.Timeout | null = null;

function normalizeObjectKey(value: unknown) {
    if (typeof value !== 'string') return null;
    const key = value.trim().replace(/^\/+/, '');
    const segments = key.split('/');
    if (
        !key ||
        key.length > 1024 ||
        key.includes('\\') ||
        /[\u0000-\u001F\u007F]/.test(key) ||
        segments.some((segment) => !segment || segment === '.' || segment === '..')
    ) return null;
    return key;
}

function scheduleDrain(delayMs = 0) {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
        retryTimer = null;
        void drainQueue();
    }, delayMs);
}

async function drainQueue() {
    if (isDraining) return;
    isDraining = true;

    try {
        while (true) {
            const job = await claimNextJob();
            if (!job) break;

            fastify.log.info({ jobId: job.id, key: job.source_key, attempt: job.attempts }, 'Processing conversion');
            try {
                const result = await processConversion({
                    key: job.source_key,
                    bucket: job.bucket,
                    jobId: job.id,
                });
                await completeJob(job.id, result);
                fastify.log.info({ jobId: job.id }, 'Conversion completed');
            } catch (error: any) {
                const message = error instanceof Error ? error.message : String(error);
                const nextState = await failJob(job.id, message);
                fastify.log.error({
                    jobId: job.id,
                    attempt: job.attempts,
                    nextStatus: nextState?.status,
                    error: message,
                }, 'Conversion failed');

                if (nextState?.status === 'pending') {
                    const delay = Math.max(1_000, new Date(nextState.available_at).getTime() - Date.now());
                    scheduleDrain(Math.min(delay + 250, 15 * 60_000));
                }
            }
        }
    } catch (error) {
        fastify.log.error(error, 'Queue drain crashed');
        scheduleDrain(30_000);
    } finally {
        isDraining = false;
    }
}

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
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
});

// Lightweight Render health check. It deliberately avoids database work.
fastify.get('/healthz', async () => ({ status: 'ok', service: 'campuslink-converter' }));

// Warmup also asks the worker to consume any durable jobs waiting in Supabase.
fastify.get('/', async () => {
    scheduleDrain();
    return { status: 'ok', service: 'campuslink-converter', workerId, draining: isDraining };
});

fastify.post('/drain', async (_req, reply) => {
    scheduleDrain();
    return reply.code(202).send({ status: 'accepted', draining: isDraining });
});

// Compatibility endpoint for clients deployed before the durable queue.
// It only accepts keys already registered in materials/bb_files.
fastify.post('/convert-stored', async (req, reply) => {
    const body = req.body as { key?: string; bucket?: string };
    const key = normalizeObjectKey(body?.key);
    const bucket = body?.bucket?.replace(/_/g, '-');

    if (!key || bucket !== 'course-materials') {
        return reply.code(400).send({ error: 'Invalid source key or bucket' });
    }

    const job = await enqueueLegacyJob(key, bucket);
    if (!job) {
        return reply.code(404).send({ error: 'The source file is not registered in CampusLink' });
    }

    scheduleDrain();
    return reply.code(202).send({ jobId: job.id, status: job.status });
});

fastify.get('/status/:id', async (req: any, reply) => {
    const status = await getJobStatus(req.params.id);
    if (!status) return reply.code(404).send({ error: 'Job not found' });
    return status;
});

fastify.get('/status', async () => {
    const queue = await getQueueSummary();
    return {
        service: 'campuslink-converter',
        workerId,
        draining: isDraining,
        queue,
        environment: {
            hasR2Credentials: Boolean(process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY),
            hasSupabaseCredentials: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
            nodeEnv: process.env.NODE_ENV,
        },
    };
});

const start = async () => {
    try {
        const port = Number.parseInt(process.env.PORT || '3000', 10);
        await fastify.listen({ port, host: '0.0.0.0' });
        fastify.log.info({ port, workerId }, 'Converter started with durable Supabase queue');
        scheduleDrain();
    } catch (error) {
        fastify.log.error(error);
        process.exit(1);
    }
};

void start();
