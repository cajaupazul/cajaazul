import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import { Queue } from 'bullmq';
import path from 'path';
import fs from 'fs';
import util from 'util';
import { pipeline } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import './worker'; // Initialize worker

dotenv.config();

const pump = util.promisify(pipeline);
const fastify = Fastify({ logger: true });

// Setup Queue
const redisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
    ...(process.env.REDIS_TLS === 'true' ? { tls: {} } : {})
};

const conversionQueue = new Queue('conversion-queue', {
    connection: redisOptions
});

// Register plugins
fastify.register(cors, {
    origin: (origin, cb) => {
        // Permitir localhost, el dominio oficial y subdominios de cloudflare pages
        if (!origin ||
            origin.includes('localhost') ||
            origin.includes('127.0.0.1') ||
            origin.endsWith('.pages.dev')) {
            cb(null, true);
            return;
        }
        cb(new Error("Not allowed by CORS"), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
    credentials: true
});
fastify.register(multipart, {
    limits: {
        fileSize: 25 * 1024 * 1024, // 25MB
    }
});

const ALLOWED_MIME_TYPES = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/msword', // .doc
    'application/vnd.ms-excel', // .xls
    'application/vnd.ms-powerpoint' // .ppt
];

// Routes
fastify.post('/convert', async (req: any, reply: any) => {
    const data = await req.file();

    if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
    }

    if (!ALLOWED_MIME_TYPES.includes(data.mimetype)) {
        return reply.code(400).send({ error: 'Invalid file type. Only Office documents allowed.' });
    }

    const jobId = uuidv4();
    const tempDir = path.join('/tmp/uploads', jobId);

    // Create temp dir
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, data.filename);

    // Save file locally
    await pump(data.file, fs.createWriteStream(filePath));

    // Add to Queue
    console.log(`[CONVERTER] Adding manual job for: ${data.filename}`);
    await conversionQueue.add('convert-document', {
        filePath,
        originalName: data.filename,
        jobId
    }, {
        jobId // Use same ID for job
    });

    return {
        startTime: Date.now(),
        jobId,
        status: 'processing',
        message: 'File queued for conversion'
    };
});

// New Endpoint: Trigger conversion for file already in R2
fastify.post('/convert-stored', async (req: FastifyRequest, reply: FastifyReply) => {
    const { key, bucket } = req.body as { key: string; bucket: string };

    if (!key || !bucket) {
        return reply.code(400).send({ error: 'Missing key or bucket in request body' });
    }

    const jobId = uuidv4();

    // Add to Queue
    console.log(`[CONVERTER] Adding R2 job for key: ${key}`);
    await conversionQueue.add('convert-stored-document', {
        key,
        bucket,
        jobId
    }, {
        jobId // Use same ID for job
    });

    return {
        startTime: Date.now(),
        jobId,
        status: 'processing',
        message: 'File queued for conversion from R2'
    };
});

fastify.get('/status/:id', async (req: any, reply: any) => {
    const { id } = req.params as { id: string };
    const job = await conversionQueue.getJob(id);

    if (!job) {
        return reply.code(404).send({ error: 'Job not found' });
    }

    const state = await job.getState();
    const result = job.returnvalue;
    const isFailed = await job.isFailed();
    const failureReason = job.failedReason;

    return {
        jobId: id,
        state,
        result, // Will contain { url: ... } if completed
        error: isFailed ? failureReason : null
    };
});



// Health check
fastify.get('/', async () => {
    return { status: 'ok', service: 'campus-link-converter' };
});

// Queue Status monitor
    fastify.get('/status', async (request, reply) => {
        const [waiting, active, completed, failed] = await Promise.all([
            conversionQueue.getWaitingCount(),
            conversionQueue.getActiveCount(),
            conversionQueue.getCompletedCount(),
            conversionQueue.getFailedCount()
        ]);

        // Probar conexión a Supabase
        let supabaseStatus = 'unknown';
        try {
            const { error } = await supabase.from('materials').select('id', { count: 'exact', head: true }).limit(1);
            supabaseStatus = error ? `Error: ${error.message}` : 'OK';
        } catch (e: any) {
            supabaseStatus = `Exception: ${e.message}`;
        }

        return {
            queue: 'conversion-queue',
            status: { waiting, active, completed, failed },
            connectivity: {
                supabase: supabaseStatus,
                env: {
                    has_r2_key: !!process.env.R2_ACCESS_KEY_ID,
                    has_supabase_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
                    node_env: process.env.NODE_ENV
                }
            }
        };
    });

// Start server
const start = async () => {
    try {
        await fastify.listen({ port: 3000, host: '0.0.0.0' });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
