type StorageClient = {
    storage: {
        from: (bucket: string) => {
            remove: (paths: string[]) => Promise<{ error: { message?: string } | null }>;
        };
    };
};

export function extractSupabaseStoragePath(value: string | null | undefined, bucket: string): string {
    if (!value) return '';
    if (!value.startsWith('http')) return value.replace(/^\/+/, '');

    try {
        const url = new URL(value);
        const encodedBucket = encodeURIComponent(bucket);
        const markers = [
            `/storage/v1/object/public/${encodedBucket}/`,
            `/storage/v1/object/sign/${encodedBucket}/`,
            `/storage/v1/object/authenticated/${encodedBucket}/`,
        ];
        for (const marker of markers) {
            const index = url.pathname.indexOf(marker);
            if (index >= 0) return decodeURIComponent(url.pathname.slice(index + marker.length));
        }
    } catch {
        return '';
    }
    return '';
}

export async function removeSupabaseStorageUrl(
    client: StorageClient,
    bucket: string,
    value: string | null | undefined,
): Promise<void> {
    const path = extractSupabaseStoragePath(value, bucket);
    if (!path) return;
    const { error } = await client.storage.from(bucket).remove([path]);
    if (error) throw new Error(error.message || `No se pudo eliminar el objeto de ${bucket}.`);
}
