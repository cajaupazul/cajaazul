import { Worker, Job } from 'bullmq';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { convertToPdf } from './lib/libreoffice';
import dotenv from 'dotenv';

dotenv.config();

// R2 Configuration
const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

const TMP_DIR = '/tmp/uploads';

// Ensure temp dir exists
fs.mkdir(TMP_DIR, { recursive: true }).catch(console.error);

export const conversionWorker = new Worker('conversion-queue', async (job: Job) => {
    const { filePath, originalName, jobId } = job.data;
    const jobDir = path.join(TMP_DIR, jobId);

    try {
        console.log(`Processing job ${jobId}: ${originalName}`);

        // Create isolated directory for this job
        await fs.mkdir(jobDir, { recursive: true });

        const inputPath = filePath; // Assumed to be already saved locally by API

        // Convert
        const outputPath = await convertToPdf(inputPath, jobDir);
        console.log(`Conversion successful: ${outputPath}`);

        // Upload to R2
        const fileStream = createReadStream(outputPath);
        const destinationKey = `converted/${jobId}/${path.basename(outputPath)}`;

        await s3Client.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: destinationKey,
            Body: fileStream,
            ContentType: 'application/pdf',
            // ACL: 'public-read' // Only if bucket is public, otherwise use signed URLs
        }));

        // Generate Public/Signed URL (Simplified public assumption or Worker proxy will handle)
        const publicUrl = `${process.env.PUBLIC_URL_BASE}/${destinationKey}`;

        return {
            success: true,
            url: publicUrl,
            key: destinationKey
        };

    } catch (error: any) {
        console.error(`Job ${jobId} failed:`, error);
        throw error;
    } finally {
        // Cleanup
        try {
            if (jobDir) await fs.rm(jobDir, { recursive: true, force: true });
            // Also remove the original input if it was in a temp location
            if (filePath && filePath.startsWith(TMP_DIR)) {
                // Check if it's outside jobDir before deleting? 
                // Logic: API saves to /tmp/uploads/ID/file ideally.
            }
        } catch (e) {
            console.error('Cleanup error:', e);
        }
    }
}, {
    connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    concurrency: 2 // Limit concurrent conversions
});

conversionWorker.on('completed', (job) => {
    console.log(`Job ${job.id} completed!`);
});

conversionWorker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with ${err.message}`);
});
