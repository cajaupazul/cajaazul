export async function triggerFileConversion(fileKey: string, bucket: string = 'course-materials') {
    try {
        const converterApiUrl = process.env.NEXT_PUBLIC_CONVERTER_API_URL || 'http://localhost:3000';

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
            const error = await response.json();
            console.error('Conversion trigger failed:', error);
            // Non-blocking error for now, user can still download original if we allow it later
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error triggering conversion:', error);
        return null;
    }
}
