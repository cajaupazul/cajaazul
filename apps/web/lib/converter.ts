export async function triggerFileConversion(fileKey: string, bucket: string = 'course-materials') {
    // Determine the API URL: Priority to Env Var, then detection, finally localhost
    const getConverterUrl = () => {
        if (process.env.NEXT_PUBLIC_CONVERTER_API_URL) return process.env.NEXT_PUBLIC_CONVERTER_API_URL;

        // If we are in production (cajaazul.pages.dev) but no env var is set, 
        // we fallback to a likely worker/service URL based on the project naming
        if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
            return 'https://campuslink-converter.cajaupazul.workers.dev';
        }

        return 'http://localhost:3000';
    };

    const converterApiUrl = getConverterUrl();

    try {
        console.log(`[CONVERTER] Triggering conversion for ${fileKey} in ${bucket} via ${converterApiUrl}`);

        const response = await fetch(`${converterApiUrl}/convert-stored`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key: fileKey,
                bucket: bucket
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('[CONVERTER] Conversion trigger failed:', error);
            return null;
        }

        const data = await response.json();
        console.log('[CONVERTER] Job created:', data.jobId);
        return data;
    } catch (error) {
        console.error('[CONVERTER] Error triggering conversion:', error);
        // Important: check if it's a fetch failure (likely URL issue)
        if (error instanceof TypeError && error.message.includes('fetch')) {
            console.warn('[CONVERTER] Failed to reach converter API. Ensure NEXT_PUBLIC_CONVERTER_API_URL is set correctly.');
        }
        return null;
    }
}
