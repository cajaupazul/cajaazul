/**
 * Triggers file conversion to PDF via the campuslink-converter service on Render.
 *
 * Resilient to cold starts: sends a warmup ping first, then uses keepalive + long timeout
 * so the request survives even if the user navigates away before Render wakes up.
 */
export async function triggerFileConversion(fileKey: string, bucket: string = 'course-materials') {
    const getConverterUrl = () => {
        if (process.env.NEXT_PUBLIC_CONVERTER_API_URL) return process.env.NEXT_PUBLIC_CONVERTER_API_URL;
        if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
            return 'https://campuslink-converter.onrender.com';
        }
        return 'http://localhost:3000';
    };

    const converterApiUrl = getConverterUrl();

    // 1. Fire a warmup GET ping (fire and forget — wakes Render up in background)
    //    We don't await this — its only purpose is to trigger the cold start early.
    if (typeof window !== 'undefined') {
        fetch(`${converterApiUrl}/`, {
            method: 'GET',
            keepalive: true,
        }).catch(() => { /* ignore warmup errors */ });
    }

    // 2. Small delay to give Render a head start on waking up
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. Send the actual conversion job with a long timeout and keepalive
    const controller = new AbortController();
    // 90 seconds: more than enough time for Render free tier to cold-start
    const timeoutId = setTimeout(() => controller.abort(), 90_000);

    try {
        console.log(`[CONVERTER] Triggering conversion for "${fileKey}" via ${converterApiUrl}`);

        const response = await fetch(`${converterApiUrl}/convert-stored`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: fileKey, bucket }),
            keepalive: true,   // Survives page navigation / modal close
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('[CONVERTER] Job creation failed:', errBody);
            return null;
        }

        const data = await response.json();
        console.log('[CONVERTER] Job queued successfully. jobId:', data.jobId);
        return data;

    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.warn('[CONVERTER] Request timed out (90s). Render may still wake up and process if keepalive worked.');
        } else {
            console.error('[CONVERTER] Fetch error:', error.message);
        }
        return null;
    }
}
