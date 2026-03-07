import { createBrowserClient } from '@supabase/ssr'

const WORKER_URL = process.env.NEXT_PUBLIC_API_URL || 'https://campuslink-api.cajaupazul.workers.dev'

/**
 * Generates a secure URL for accessing a file in R2 via the Cloudflare Worker proxy.
 * This URL expects the request to include a valid Authorization header if the bucket is private.
 * For public-read buckets (like profile-avatars), this URL works directly.
 */
export function getSecureFileUrl(bucket: string, path: string): string {
    if (!path) return '';
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${WORKER_URL}/storage/secure-url?bucket=${bucket}&path=${encodeURIComponent(cleanPath)}`
}

/**
 * Alias for getSecureFileUrl to maintain compatibility with existing code.
 * In the R2 architecture, "public" URLs are served via the secure proxy.
 */
export function getPublicFileUrl(bucket: string, path: string): string {
    return getSecureFileUrl(bucket, path);
}

/**
 * Fetches a private file from R2 using the current user's Supabase session.
 */
export async function getFileFromR2(bucket: string, path: string): Promise<Blob> {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) throw new Error('No autenticado')

    const url = getSecureFileUrl(bucket, path);

    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
    })

    if (!response.ok) throw new Error(`Error: ${response.status}`)
    return response.blob()
}

/**
 * Creates a temporary object URL for a private file.
 * Useful for previewing images that require auth headers.
 */
export async function getTemporaryFileUrl(bucket: string, path: string): Promise<string> {
    const blob = await getFileFromR2(bucket, path)
    return URL.createObjectURL(blob)
}

/**
 * Uploads a file to R2 via the Cloudflare Worker proxy.
 */
export async function uploadFileToR2(bucket: string, path: string, file: File): Promise<string> {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) throw new Error('No autenticado')

    const response = await fetch(
        `${WORKER_URL}/storage/upload?bucket=${bucket}&path=${encodeURIComponent(path)}`,
        {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': file.type
            },
            body: file
        }
    )

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any
        throw new Error(`Error subiendo archivo: ${errorData.error || response.statusText}`)
    }

    return getSecureFileUrl(bucket, path)
}

/**
 * Deletes a file from R2 via the Cloudflare Worker proxy.
 */
export async function deleteFileFromR2(bucket: string, path: string): Promise<boolean> {
    if (!path) return false;

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        console.warn('Usuario no autenticado, no se puede eliminar archivo.')
        return false
    }

    let cleanPath = path;
    if (path.startsWith('http')) {
        try {
            const urlObj = new URL(path);
            // Case 1: Proxy URL with ?path=...
            const params = new URLSearchParams(urlObj.search);
            const pathParam = params.get('path');

            if (pathParam) {
                cleanPath = pathParam;
            } else {
                // Case 2: Direct-ish URL like .../bucket-name/actual/path
                // Or .../storage/v1/object/public/bucket-name/actual/path
                const parts = urlObj.pathname.split(`/${bucket}/`);
                if (parts.length > 1) {
                    cleanPath = parts[1];
                } else {
                    // Fallback to basename if nothing else works
                    cleanPath = urlObj.pathname.split('/').pop() || path;
                }
            }
        } catch (e) {
            console.warn('Error parsing URL in deleteFileFromR2:', e);
        }
    }

    try {
        const response = await fetch(
            `${WORKER_URL}/storage/delete?bucket=${bucket}&path=${encodeURIComponent(cleanPath)}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            }
        )

        if (!response.ok) {
            // Si es 404, el archivo ya no existe, por lo que la eliminación fue "exitosa" en la práctica.
            if (response.status === 404) {
                return true;
            }
            console.warn(`Advertencia eliminando archivo (${response.status}):`, response.statusText)
            return false
        }

        return true;
    } catch (error) {
        console.error('Excepción eliminando archivo:', error)
        return false;
    }
}
