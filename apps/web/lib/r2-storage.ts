import { createBrowserClient } from '@supabase/ssr'

const WORKER_URL = process.env.NEXT_PUBLIC_API_URL || 'https://campuslink-api.cajaupazul.workers.dev'

export async function getFileFromR2(bucket: string, path: string): Promise<Blob> {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) throw new Error('No autenticado')

    const response = await fetch(
        `${WORKER_URL}/storage/secure-url?bucket=${bucket}&path=${encodeURIComponent(path)}`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
    )

    if (!response.ok) throw new Error(`Error: ${response.status}`)
    return response.blob()
}

export async function getTemporaryFileUrl(bucket: string, path: string): Promise<string> {
    const blob = await getFileFromR2(bucket, path)
    return URL.createObjectURL(blob)
}

return `${WORKER_URL}/storage/secure-url?bucket=${bucket}&path=${encodeURIComponent(path)}`
}

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

    return getPublicFileUrl(bucket, path)
}
