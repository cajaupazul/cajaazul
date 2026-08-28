/**
 * Best-effort wakeup for the document converter.
 *
 * The upload API persists the actual job in Supabase before returning. This
 * browser call never carries an R2 key and is therefore safe to abandon when
 * the user navigates away or Render is still waking up.
 */
export async function triggerFileConversion(fileKey: string, bucket = 'course-materials') {
    const extension = fileKey.split('.').pop()?.toLowerCase();
    if (bucket.replace(/_/g, '-') !== 'course-materials') return null;
    if (!extension || !['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(extension)) return null;

    const converterUrl = process.env.NEXT_PUBLIC_CONVERTER_API_URL
        || 'https://campuslink-converter.onrender.com';

    try {
        await fetch(`${converterUrl}/drain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'campuslink-web' }),
            keepalive: true,
        });
        return { status: 'wake-requested' };
    } catch {
        // Supabase cron is the durable fallback, so a cold-start timeout here
        // must never turn an otherwise successful upload into a user error.
        return { status: 'queued-in-supabase' };
    }
}
