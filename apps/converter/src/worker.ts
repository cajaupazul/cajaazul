import { Worker, Job } from 'bullmq';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { convertToPdf } from './lib/libreoffice';
import { generateImageThumbnail, generatePdfThumbnail } from './lib/thumbnails';
import dotenv from 'dotenv';
import { Readable } from 'stream';

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

// Supabase Configuration
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TMP_DIR = '/tmp/uploads';

// Ensure temp dir exists
fs.mkdir(TMP_DIR, { recursive: true }).catch(console.error);

export const conversionWorker = new Worker('conversion-queue', async (job: Job) => {
    const { filePath: initialPath, originalName, jobId, key, bucket } = job.data;
    const jobDir = path.join(TMP_DIR, jobId);
    let currentInputPath = initialPath;

    try {
        console.log(`🚀 Processing job ${jobId}: ${originalName || key}`);

        // 1. Setup Job Directory
        await fs.mkdir(jobDir, { recursive: true });

        // 2. If file is in R2 (convert-stored-document), download it first
        if (key && bucket) {
            currentInputPath = path.join(jobDir, path.basename(key));
            const getObjectResponse = await s3Client.send(new GetObjectCommand({
                Bucket: bucket,
                Key: key,
            }));

            const fileStream = createWriteStream(currentInputPath);
            await new Promise((resolve, reject) => {
                if (getObjectResponse.Body instanceof Readable) {
                    getObjectResponse.Body.pipe(fileStream)
                        .on('finish', () => resolve(true))
                        .on('error', reject);
                } else {
                    reject(new Error('R2 Body is not a readable stream'));
                }
            });
        }

        if (!currentInputPath) throw new Error('No input file path available');

        const fileExt = path.extname(currentInputPath).toLowerCase();
        let pdfPath: string | null = null;
        let thumbnailPath: string | null = path.join(jobDir, 'thumb.webp');

        // 3. Conversion to PDF (if Office file)
        const officeExtensions = ['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];
        if (officeExtensions.includes(fileExt)) {
            pdfPath = await convertToPdf(currentInputPath, jobDir);
            console.log(`✅ Conversion successful: ${pdfPath}`);
        } else if (fileExt === '.pdf') {
            pdfPath = currentInputPath;
        }

        // 4. Generate Thumbnail
        try {
            if (pdfPath) {
                await generatePdfThumbnail(pdfPath, thumbnailPath);
            } else if (['.jpg', '.jpeg', '.png', '.webp'].includes(fileExt)) {
                await generateImageThumbnail(currentInputPath, thumbnailPath);
            } else {
                thumbnailPath = null; // No thumbnail for unknown types
            }
        } catch (thumbError) {
            console.error('Failed to generate thumbnail:', thumbError);
            thumbnailPath = null;
        }

        // 5. Upload Original PDF (if it was converted)
        let destinationPdfKey: string | null = null;
        if (pdfPath && pdfPath !== currentInputPath) {
            destinationPdfKey = `converted/${jobId}/${path.basename(pdfPath)}`;
            await s3Client.send(new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: destinationPdfKey,
                Body: createReadStream(pdfPath),
                ContentType: 'application/pdf',
            }));
        }

        // 6. Upload Thumbnail
        let thumbnailKey: string | null = null;
        if (thumbnailPath) {
            thumbnailKey = `materials/${jobId}.webp`;
            await s3Client.send(new PutObjectCommand({
                Bucket: 'thumbnails', // Use our dedicated thumbnails bucket
                Key: thumbnailKey,
                Body: createReadStream(thumbnailPath),
                ContentType: 'image/webp',
            }));
            console.log(`📸 Thumbnail uploaded: ${thumbnailKey}`);
        }

        // 7. Update Supabase
        if (key) {
            const publicThumbnailUrl = `${process.env.PUBLIC_URL_BASE}/storage/secure-url?bucket=thumbnails&path=${thumbnailKey}`;

            // Try to find the material record that matching this R2 key
            // Note: url_archivo stores something like "...?bucket=course-materials&path=FILENAME"
            const { data: materials, error: fetchError } = await supabase
                .from('materials')
                .select('id')
                .ilike('url_archivo', `%${key}%`);

            if (fetchError) {
                console.error('Error fetching material from Supabase:', fetchError);
            } else if (materials && materials.length > 0) {
                const { error: updateError } = await supabase
                    .from('materials')
                    .update({ thumbnail_url: publicThumbnailUrl })
                    .eq('id', materials[0].id);

                if (updateError) console.error('Error updating thumbnail_url:', updateError);
                else console.log(`✨ Supabase updated for material ${materials[0].id}`);
            }
        }

        return {
            success: true,
            pdfKey: destinationPdfKey,
            thumbnailKey: thumbnailKey
        };

    } catch (error: any) {
        console.error(`Job ${jobId} failed:`, error);
        throw error;
    } finally {
        // Cleanup Cleanup Cleanup
        try {
            await fs.rm(jobDir, { recursive: true, force: true });
        } catch (e) {
            console.error('Cleanup error:', e);
        }
    }
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
