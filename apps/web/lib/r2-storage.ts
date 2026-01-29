import { createBrowserClient } from '@supabase/ssr'

const WORKER_URL = process.env.NEXT_PUBLIC_API_URL || 'https://campuslink-api.cajaupazul.workers.dev'

/**
 * Generates a secure URL for accessing a file in R2 via the Cloudflare Worker proxy.
 * This URL expects the request to include a valid Authorization header if the bucket is private.
 */
export function getSecureFileUrl(bucket: string, path: string): string {
    if (!path) return '';
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${WORKER_URL}/storage/secure-url?bucket=${bucket}&path=${encodeURIComponent(cleanPath)}`
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
