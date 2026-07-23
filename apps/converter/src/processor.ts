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

        // 3. Conversion to PDF (if Office file: Word or PowerPoint)
        const officeExtensions = ['.doc', '.docx', '.ppt', '.pptx'];
        if (officeExtensions.includes(fileExt)) {
            pdfPath = await convertToPdf(currentInputPath, jobDir);
            console.log(`✅ Conversion successful: ${pdfPath}`);
        } else if (fileExt === '.pdf') {
            pdfPath = currentInputPath;
        }

        // 4. Upload PDF immediately after conversion (High Priority)
        let destinationPdfKey: string | null = null;
        if (pdfPath && pdfPath !== currentInputPath) {
            destinationPdfKey = `converted/${jobId}/${path.basename(pdfPath)}`;
            await s3Client.send(new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: destinationPdfKey,
                Body: createReadStream(pdfPath),
                ContentType: 'application/pdf',
            }));
            console.log(`📄 PDF uploaded to R2: ${destinationPdfKey}`);

            // 5. Update Supabase URL IMMEDIATELY (Priority #1)
            // We do this BEFORE potentially memory-heavy thumbnailing to ensure the PDF state is saved.
            if (key) {
                // Update `materials` table
                const { data: materials, error: fetchError } = await supabase
                    .from('materials')
                    .select('id, url_archivo')
                    .ilike('url_archivo', `%${key}%`);

                if (!fetchError && materials && materials.length > 0) {
                    const originalUrl = materials[0].url_archivo;
                    try {
                        const urlObj = new URL(originalUrl);
                        urlObj.searchParams.set('path', destinationPdfKey);
                        
                        const { error: updateError } = await supabase
                            .from('materials')
                            .update({ url_archivo: urlObj.toString() })
                            .eq('id', materials[0].id);

                        if (updateError) console.error('Error updating Supabase URL:', updateError);
                        else console.log(`✨ Supabase URL updated to PDF for ${materials[0].id}`);
                    } catch (urlErr) {
                        console.error('Failed to parse original URL:', originalUrl);
                    }
                }

                // Update `bb_files` table (for folder uploads)
                const { data: bbFiles, error: fetchBbError } = await supabase
                    .from('bb_files')
                    .select('id, storage_path, name')
                    .eq('storage_path', key);

                if (!fetchBbError && bbFiles && bbFiles.length > 0) {
                    for (const file of bbFiles) {
                        // For bb_files, we just update the storage_path directly and set mime_type to PDF
                        const { error: updateBbError } = await supabase
                            .from('bb_files')
                            .update({ 
                                storage_path: destinationPdfKey,
                                mime_type: 'application/pdf',
                                name: file.name ? file.name.replace(/\.[^/.]+$/, "") + ".pdf" : undefined
                            })
                            .eq('id', file.id);
                            
                        if (updateBbError) console.error('Error updating bb_files:', updateBbError);
                        else console.log(`✨ Supabase bb_files updated to PDF for ${file.id}`);
                    }
                }
            }
        }

        // 6. Generate and Upload Thumbnail (DISABLED to save memory)
        let thumbnailKey: string | null = null;
        /* 
        try {
            // Thumbnail logic removed per user request to prioritize file conversion
        } catch (thumbError: any) {
            console.error('Non-fatal: Failed to process thumbnail:', thumbError.message);
        }
        */

        // 7. Cleanup Original from R2 (only if we have a PDF now)
        if (destinationPdfKey && key) {
            try {
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: bucket || process.env.R2_BUCKET_NAME,
                    Key: key
                }));
                console.log(`🗑️ Original file deleted from R2: ${key}`);
            } catch (delError: any) {
                console.warn(`Failed to delete original file ${key}:`, delError.message);
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
        // Essential cleanup
        await fs.rm(jobDir, { recursive: true, force: true }).catch((err) => {
            console.error(`Failed to cleanup job directory ${jobDir}:`, err);
        });
    }
}
