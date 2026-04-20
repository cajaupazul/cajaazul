import { Worker, Job } from 'bullmq';
import { processConversion } from './processor';
import dotenv from 'dotenv';

dotenv.config();

const redisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
    ...(process.env.REDIS_TLS === 'true' ? { tls: {} } : {})
};

export const conversionWorker = new Worker('conversion-queue', async (job: Job) => {
    return await processConversion(job.data);
}, {
    connection: redisOptions,
    concurrency: 1
});

console.log('👷 [WORKER] Conversion worker engine is UP and LISTENING for jobs...');

conversionWorker.on('completed', (job) => {
    console.log(`Job ${job.id} completed!`);
});

conversionWorker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed!`);
    console.error(err.stack || err.message);
});
