import { createClient } from '@supabase/supabase-js';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export type ConversionJob = {
    id: string;
    bucket: string;
    source_key: string;
    source_size_bytes: number | null;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    attempts: number;
    max_attempts: number;
    available_at: string;
};

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
);

export const workerId = [
    process.env.RENDER_INSTANCE_ID || os.hostname(),
    process.pid,
    uuidv4().slice(0, 8),
].join(':');

export async function claimNextJob(): Promise<ConversionJob | null> {
    const { data, error } = await supabase.rpc('claim_conversion_job', {
        p_worker_id: workerId,
    });

    if (error) throw new Error(`Could not claim conversion job: ${error.message}`);
    return (Array.isArray(data) ? data[0] : data) || null;
}

export async function completeJob(jobId: string, result: unknown) {
    const { data, error } = await supabase.rpc('complete_conversion_job', {
        p_job_id: jobId,
        p_worker_id: workerId,
        p_result: result || {},
    });

    if (error) throw new Error(`Could not complete conversion job: ${error.message}`);
    if (!data?.length) throw new Error(`Conversion job ${jobId} is no longer owned by this worker`);
    return data[0] as ConversionJob;
}

export async function failJob(jobId: string, message: string) {
    const { data, error } = await supabase.rpc('fail_conversion_job', {
        p_job_id: jobId,
        p_worker_id: workerId,
        p_error: message,
    });

    if (error) throw new Error(`Could not record conversion failure: ${error.message}`);
    return (data?.[0] || null) as ConversionJob | null;
}

export async function enqueueLegacyJob(key: string, bucket: string) {
    const [{ data: bbFile }, { data: material }] = await Promise.all([
        supabase.from('bb_files').select('id').eq('storage_path', key).limit(1).maybeSingle(),
        supabase.from('materials').select('id').eq('storage_path', key).limit(1).maybeSingle(),
    ]);

    if (!bbFile && !material) {
        const encodedKey = encodeURIComponent(key);
        const { data: legacyMaterial } = await supabase
            .from('materials')
            .select('id')
            .ilike('url_archivo', `%path=${encodedKey}`)
            .limit(1)
            .maybeSingle();
        if (!legacyMaterial) return null;
    }

    const { data, error } = await supabase
        .from('conversion_jobs')
        .insert({ bucket, source_key: key })
        .select('id, status')
        .single();

    if (!error) return data;
    if (error.code !== '23505') throw new Error(`Could not enqueue conversion: ${error.message}`);

    const { data: existing, error: existingError } = await supabase
        .from('conversion_jobs')
        .select('id, status')
        .eq('bucket', bucket)
        .eq('source_key', key)
        .in('status', ['pending', 'processing'])
        .limit(1)
        .maybeSingle();

    if (existingError) throw new Error(`Could not read queued conversion: ${existingError.message}`);
    return existing;
}

export async function getJobStatus(jobId: string) {
    const { data, error } = await supabase
        .from('conversion_jobs')
        .select('id, status, attempts, max_attempts, available_at, completed_at, last_error, result')
        .eq('id', jobId)
        .maybeSingle();
    if (error) throw error;
    return data;
}

export async function getQueueSummary() {
    const [pending, processing] = await Promise.all([
        supabase
            .from('conversion_jobs')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
        supabase
            .from('conversion_jobs')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'processing'),
    ]);

    if (pending.error) throw pending.error;
    if (processing.error) throw processing.error;
    return {
        pending: pending.count || 0,
        processing: processing.count || 0,
    };
}
