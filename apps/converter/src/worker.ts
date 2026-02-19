import { Worker, Job } from 'bullmq';
import { processConversion } from './processor';
import dotenv from 'dotenv';

dotenv.config();

export const conversionWorker = new Worker('conversion-queue', async (job: Job) => {
    return await processConversion(job.data);
}, {
    connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    concurrency: 2
});

conversionWorker.on('completed', (job) => {
    console.log(`Job ${job.id} completed!`);
});

conversionWorker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with ${err.message}`);
});
