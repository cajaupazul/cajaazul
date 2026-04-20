import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import { convertToPdf } from './lib/libreoffice';
import { generateImageThumbnail, generatePdfThumbnail } from './lib/thumbnails';
import { Readable, pipeline } from 'stream';
import util from 'util';
import dotenv from 'dotenv';
import os from 'os';

const pump = util.promisify(pipeline);

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

const TMP_DIR = path.join(os.tmpdir(), 'campus-link-uploads');

export async function processConversion(data: {
    filePath?: string;
    originalName?: string;
    jobId: string;
    key?: string;
    bucket?: string;
}) {
    const { filePath: initialPath, originalName, jobId, key, bucket } = data;
    console.log(`👷 Starting conversion job ${jobId} for key: ${key || originalName}`);
    const jobDir = path.join(TMP_DIR, jobId);
    let currentInputPath = initialPath;

    try {
        console.log(`🚀 Processing job ${jobId}: ${originalName || key}`);

        // 1. Setup Job Directory
        await fs.mkdir(jobDir, { recursive: true });

        // 2. If file is in R2, download it
        if (key) {
            console.log(`📥 Downloading original file from R2: ${key}`);
            currentInputPath = path.join(jobDir, path.basename(key));
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: bucket || process.env.R2_BUCKET_NAME,
                Key: key,
            }));
            
            if (response.Body instanceof Readable) {
                await pump(response.Body, createWriteStream(currentInputPath));
                console.log(`✅ Downloaded to: ${currentInputPath}`);
            } else {
                throw new Error('R2 Body is not a readable stream');
            }
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
                thumbnailPath = null;
            }
        } catch (thumbError: any) {
            console.error('Failed to generate thumbnail:', thumbError.message);
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
                Bucket: 'thumbnails',
                Key: thumbnailKey,
                Body: createReadStream(thumbnailPath),
                ContentType: 'image/webp',
            }));
            console.log(`📸 Thumbnail uploaded: ${thumbnailKey}`);
        }

        // 7. Update Supabase
        if (key) {
            const publicThumbnailUrl = `${process.env.PUBLIC_URL_BASE}/storage/secure-url?bucket=thumbnails&path=${thumbnailKey}`;

            const { data: materials, error: fetchError } = await supabase
                .from('materials')
                .select('id, url_archivo')
                .ilike('url_archivo', `%${key}%`);

            if (fetchError) {
                console.error('Error fetching material from Supabase:', fetchError);
            } else if (materials && materials.length > 0) {
                const updatePayload: any = { thumbnail_url: publicThumbnailUrl };
                
                // If we successfully converted to PDF, update the url_archivo so the frontend viewer
                // will render it as a native PDF (cascade view, like Blackboard) instead of PPT.
                // We preserve the original frontend url structure, just change the bucket path.
                if (destinationPdfKey) {
                    console.log(`📄 Updating url_archivo to point to PDF: ${destinationPdfKey}`);
                    const originalUrl = materials[0].url_archivo;
                    const urlObj = new URL(originalUrl);
                    urlObj.searchParams.set('path', destinationPdfKey);
                    updatePayload.url_archivo = urlObj.toString();
                }

                const { error: updateError } = await supabase
                    .from('materials')
                    .update(updatePayload)
                    .eq('id', materials[0].id);

                if (updateError) {
                    console.error('Error updating thumbnail_url and url_archivo:', updateError);
                } else {
                    console.log(`✨ Supabase updated for material ${materials[0].id}`);
                    
                    // IF update was successful, and we converted a file, delete the original from R2 to save space
                    if (destinationPdfKey && key) {
                        try {
                            await s3Client.send(new DeleteObjectCommand({
                                Bucket: bucket || process.env.R2_BUCKET_NAME,
                                Key: key
                            }));
                            console.log(`🗑️ Original file deleted from R2 to save space: ${key}`);
                        } catch (delError: any) {
                            console.error(`Failed to delete original file ${key}:`, delError.message);
                        }
                    }
                }
            }
        }

        return {
            success: true,
            pdfKey: destinationPdfKey,
            thumbnailKey: thumbnailKey
        };

    } catch (error: any) {
        console.error(`Error in conversion core:`, error);
        throw new Error(`Conversion failed: ${error.message}`);
    } finally {
        await fs.rm(jobDir, { recursive: true, force: true }).catch((err) => {
            console.error(`Failed to cleanup job directory ${jobDir}:`, err);
        });
    }
}
