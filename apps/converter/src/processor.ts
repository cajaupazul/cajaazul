import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import os from 'os';
import { Readable, pipeline } from 'stream';
import util from 'util';
import dotenv from 'dotenv';
import { convertToPdf } from './lib/libreoffice';

dotenv.config();

const pump = util.promisify(pipeline);
const TMP_DIR = path.join(os.tmpdir(), 'campus-link-uploads');

const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
);

function destinationKeyFor(sourceKey: string, jobId: string) {
    const sourceDirectory = path.posix.dirname(sourceKey);
    const pdfName = `${path.posix.basename(sourceKey, path.posix.extname(sourceKey))}.pdf`;
    return sourceDirectory && sourceDirectory !== '.'
        ? `${sourceDirectory}/.converted/${jobId}-${pdfName}`
        : `converted/${jobId}/${pdfName}`;
}

async function updateDatabaseReferences(sourceKey: string, destinationKey: string) {
    const [{ data: exactMaterials, error: materialError }, { data: bbFiles, error: bbError }] = await Promise.all([
        supabase
            .from('materials')
            .select('id, url_archivo, storage_path')
            .eq('storage_path', sourceKey),
        supabase
            .from('bb_files')
            .select('id, name, relative_path')
            .eq('storage_path', sourceKey),
    ]);

    if (materialError) throw new Error(`Could not find material references: ${materialError.message}`);
    if (bbError) throw new Error(`Could not find Blackboard references: ${bbError.message}`);

    let materials = exactMaterials || [];
    if (materials.length === 0) {
        const encodedKey = encodeURIComponent(sourceKey);
        const { data: legacyMaterials, error: legacyError } = await supabase
            .from('materials')
            .select('id, url_archivo, storage_path')
            .ilike('url_archivo', `%path=${encodedKey}`);
        if (legacyError) throw new Error(`Could not find legacy material references: ${legacyError.message}`);
        materials = legacyMaterials || [];
    }

    if (materials.length === 0 && (!bbFiles || bbFiles.length === 0)) {
        // A restart may happen after the references were updated but before the
        // queue row was completed. Treat that state as an idempotent success.
        const [{ data: convertedMaterials, error: convertedMaterialError }, { data: convertedBbFiles, error: convertedBbError }] = await Promise.all([
            supabase
                .from('materials')
                .select('id')
                .eq('storage_path', destinationKey),
            supabase
                .from('bb_files')
                .select('id')
                .eq('storage_path', destinationKey),
        ]);

        if (convertedMaterialError) {
            throw new Error(`Could not verify converted material references: ${convertedMaterialError.message}`);
        }
        if (convertedBbError) {
            throw new Error(`Could not verify converted Blackboard references: ${convertedBbError.message}`);
        }

        if ((convertedMaterials?.length || 0) > 0 || (convertedBbFiles?.length || 0) > 0) {
            return {
                materialCount: convertedMaterials?.length || 0,
                blackboardFileCount: convertedBbFiles?.length || 0,
            };
        }

        throw new Error('Source metadata is not registered yet; conversion will be retried');
    }

    for (const material of materials) {
        let nextUrl = material.url_archivo;
        try {
            const url = new URL(material.url_archivo);
            url.searchParams.set('path', destinationKey);
            nextUrl = url.toString();
        } catch {
            // Keep non-URL legacy values usable by replacing their object key.
            nextUrl = material.url_archivo.replace(sourceKey, destinationKey);
        }

        const { error } = await supabase
            .from('materials')
            .update({
                url_archivo: nextUrl,
                storage_path: destinationKey,
            })
            .eq('id', material.id);
        if (error) throw new Error(`Could not update material ${material.id}: ${error.message}`);
    }

    for (const file of bbFiles || []) {
        const { error } = await supabase
            .from('bb_files')
            .update({
                storage_path: destinationKey,
                mime_type: 'application/pdf',
                name: `${file.name.replace(/\.[^/.]+$/, '')}.pdf`,
                relative_path: file.relative_path
                    ? file.relative_path.replace(/\.[^/.]+$/, '') + '.pdf'
                    : null,
            })
            .eq('id', file.id);
        if (error) throw new Error(`Could not update Blackboard file ${file.id}: ${error.message}`);
    }

    return { materialCount: materials.length, blackboardFileCount: bbFiles?.length || 0 };
}

async function isJobCancelled(jobId: string) {
    const { data, error } = await supabase
        .from('conversion_jobs')
        .select('status')
        .eq('id', jobId)
        .maybeSingle();

    if (error) throw new Error(`Could not verify conversion status: ${error.message}`);
    return !data || data.status === 'cancelled';
}

export async function processConversion(data: {
    jobId: string;
    key: string;
    bucket: string;
}) {
    const { jobId, key, bucket } = data;
    const jobDir = path.join(TMP_DIR, jobId);
    const sourcePath = path.join(jobDir, path.basename(key));
    const extension = path.extname(key).toLowerCase();
    const officeExtensions = new Set(['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx']);

    if (!officeExtensions.has(extension)) {
        throw new Error(`Unsupported conversion format: ${extension || 'unknown'}`);
    }

    const destinationKey = destinationKeyFor(key, jobId);

    try {
        await fs.mkdir(jobDir, { recursive: true });

        try {
            const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
            if (!(response.Body instanceof Readable)) throw new Error('R2 returned a non-streaming body');
            await pump(response.Body, createWriteStream(sourcePath));
        } catch (error: any) {
            const isMissing = error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404;
            if (!isMissing) throw error;

            // Idempotency recovery: a restart can happen after the PDF upload but
            // before the queue row was marked completed.
            await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: destinationKey }));
            const references = await updateDatabaseReferences(key, destinationKey);
            return { success: true, pdfKey: destinationKey, recovered: true, ...references };
        }

        const pdfPath = await convertToPdf(sourcePath, jobDir);
        if (await isJobCancelled(jobId)) {
            throw new Error('Conversion was cancelled before upload');
        }

        await s3Client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: destinationKey,
            Body: createReadStream(pdfPath),
            ContentType: 'application/pdf',
        }));

        // Deleting a material while LibreOffice is working must not recreate
        // it as a PDF. Remove the just-created object if the job was cancelled.
        if (await isJobCancelled(jobId)) {
            await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: destinationKey }));
            throw new Error('Conversion was cancelled during upload');
        }

        // Database references must be durable before deleting the original.
        const references = await updateDatabaseReferences(key, destinationKey);

        await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

        return {
            success: true,
            pdfKey: destinationKey,
            recovered: false,
            ...references,
        };
    } catch (error: any) {
        throw new Error(`Conversion failed: ${error?.message || String(error)}`);
    } finally {
        await fs.rm(jobDir, { recursive: true, force: true }).catch(() => undefined);
    }
}
