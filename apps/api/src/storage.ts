import { Hono } from 'hono'
import { authMiddleware } from './auth'

type Bindings = {
    SUPABASE_URL: string
    SUPABASE_ANON_KEY: string
    ALLOWED_ORIGIN: string
    COURSE_MATERIALS: R2Bucket
    PROFILE_AVATARS: R2Bucket
    PROFILE_FRAMES: R2Bucket
    GRUPOS: R2Bucket
    COURSE_IMAGES: R2Bucket
    THUMBNAILS: R2Bucket
    ANNOUNCEMENTS: R2Bucket
    LIBRARY: R2Bucket
    // NO R2_ACCESS_KEYS required (Native Bindings)
}

const storageRouter = new Hono<{ Bindings: Bindings }>()

function normalizeObjectPath(value: string) {
    const cleanPath = value.trim().replace(/^\/+/, '')
    const segments = cleanPath.split('/')
    const hasUnsafeSegment = segments.some((segment) => !segment || segment === '.' || segment === '..')
    if (
        !cleanPath ||
        cleanPath.length > 1024 ||
        cleanPath.includes('\\') ||
        /[\u0000-\u001F\u007F]/.test(cleanPath) ||
        hasUnsafeSegment
    ) {
        return null
    }
    return cleanPath
}

// Middleware de autenticación solo para buckets privados
const privateAuthMiddleware = async (c: any, next: any) => {
    // EXCEPTION: Public stream endpoint validates its own token
    if (c.req.path.endsWith('/public-stream')) {
        await next()
        return
    }

    const bucketName = c.req.query('bucket') || 'course-materials'
    const method = c.req.method

    // REQUIRE AUTH for all mutations (Upload/Delete) regardless of bucket
    if (method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
        return authMiddleware(c, next)
    }

    // REQUIRE AUTH for course-materials bucket even for GET
    if (bucketName === 'course-materials' || bucketName === 'course_materials') {
        return authMiddleware(c, next)
    }

    // For other GET requests (avatars, frames, etc.), continue without auth for performance
    await next()
}

storageRouter.use('/*', privateAuthMiddleware)

// Helper Crypto nativo para firmar tokens (HMAC-SHA256)
async function signToken(data: string, secret: string) {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(data)
    )
    // Convertir a base64url para URL safety
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
}

async function verifyToken(data: string, signature: string, secret: string) {
    const expected = await signToken(data, secret)
    return expected === signature
}


// PUT /storage/upload?bucket=...&path=...
// Sube un archivo a R2
storageRouter.put('/upload', async (c) => {
    const path = c.req.query('path')
    const bucketName = c.req.query('bucket') || 'course-materials'
    const contentType = c.req.header('Content-Type') || 'application/octet-stream'

    console.log(`📤 Upload request: bucket=${bucketName}, path=${path}`)

    if (!path) {
        return c.json({ error: 'Falta el parámetro "path"' }, 400)
    }
    const cleanPath = normalizeObjectPath(path)
    if (!cleanPath) return c.json({ error: 'Ruta de archivo inválida' }, 400)

    // Seleccionar el bucket correcto
    let bucket: R2Bucket | undefined
    const normalizedBucket = bucketName.replace(/_/g, '-')

    switch (normalizedBucket) {
        case 'course-materials': bucket = c.env.COURSE_MATERIALS; break;
        case 'course-images': bucket = c.env.COURSE_IMAGES; break;
        case 'profile-avatars': bucket = c.env.PROFILE_AVATARS; break;
        case 'profile-frames': bucket = c.env.PROFILE_FRAMES; break;
        case 'grupos': bucket = c.env.GRUPOS; break;
        case 'thumbnails': bucket = c.env.THUMBNAILS; break;
        case 'announcements': bucket = c.env.ANNOUNCEMENTS; break;
        case 'library': bucket = c.env.LIBRARY; break;
        default:
            return c.json({ error: `Bucket inválido: ${bucketName}` }, 400)
    }

    if (!bucket) {
        return c.json({ error: 'Bucket no configurado' }, 500)
    }

    try {
        // V6.1: Use direct stream (c.req.raw.body) instead of arrayBuffer() to avoid 128MB Worker memory limit (Error 10001)
        const body = c.req.raw.body;

        if (!body) {
            return c.json({ error: 'Cuerpo de la petición vacío' }, 400)
        }

        const authenticatedUser = (c as any).get('user')
        await bucket.put(cleanPath, body, {
            httpMetadata: {
                contentType: contentType,
            },
            customMetadata: authenticatedUser?.id ? { uploadedBy: authenticatedUser.id } : undefined,
        })

        console.log(`✅ Archivo subido exitosamente: ${cleanPath}`)

        // Trigger automatic conversion to PDF in background via Cloudflare Worker
        const fileExt = cleanPath.split('.').pop()?.toLowerCase() || ''
        const triggerExtensions = ['doc', 'docx', 'ppt', 'pptx']

        if (normalizedBucket === 'course-materials' && triggerExtensions.includes(fileExt)) {
            const converterUrl = (c.env as any).CONVERTER_API_URL || 'https://campuslink-converter.onrender.com'
            c.executionCtx.waitUntil((async () => {
                try {
                    console.log(`[WORKER BACKGROUND] Triggering conversion for ${cleanPath} via ${converterUrl}`)
                    
                    // Warmup ping first in case Render is cold-starting
                    await fetch(`${converterUrl}/`, { method: 'GET' }).catch(() => {})
                    
                    // Send conversion request
                    const res = await fetch(`${converterUrl}/convert-stored`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: cleanPath, bucket: normalizedBucket })
                    })
                    
                    if (res.ok) {
                        const data: any = await res.json().catch(() => ({}))
                        console.log(`[WORKER BACKGROUND] Conversion job queued successfully on Render! JobId: ${data?.jobId}`)
                    } else {
                        console.error(`[WORKER BACKGROUND] Render returned status ${res.status}`)
                    }
                } catch (err: any) {
                    console.error(`[WORKER BACKGROUND] Error calling converter: ${err.message}`)
                }
            })())
        }

        return c.json({
            success: true,
            path: cleanPath,
            bucket: normalizedBucket,
            url: `${c.env.ALLOWED_ORIGIN}/storage/secure-url?bucket=${normalizedBucket}&path=${encodeURIComponent(cleanPath)}`
        })

    } catch (e: any) {
        console.error(`❌ Error subiendo archivo:`, e)
        return c.json({ error: e.message }, 500)
    }
})


// DELETE /storage/delete?bucket=...&path=...
// Elimina un archivo de R2
storageRouter.delete('/delete', async (c) => {
    const path = c.req.query('path')
    const bucketName = c.req.query('bucket') || 'course-materials'
    const secret = c.req.query('secret')

    console.log(`🗑️ Delete request: bucket=${bucketName}, path=${path}`)

    // Allow deletion via maintenance secret OR standard auth
    const authHeader = c.req.header('Authorization')
    if (secret && secret !== c.env.SUPABASE_ANON_KEY) {
        return c.json({ error: 'Secret de mantenimiento inválido' }, 401)
    }

    if (!secret && !authHeader) {
        return c.json({ error: 'No autorizado (Falta header o secret)' }, 401)
    }

    if (!path) {
        return c.json({ error: 'Falta el parámetro "path"' }, 400)
    }

    // Robust path extraction from full URLs if needed
    let cleanPath = path;
    if (path.startsWith('http')) {
        try {
            const urlObj = new URL(path);
            const params = new URLSearchParams(urlObj.search);
            const pathParam = params.get('path');
            if (pathParam) {
                cleanPath = pathParam;
            } else {
                const parts = urlObj.pathname.split(`/${bucketName.replace(/_/g, '-')}/`);
                if (parts.length > 1) {
                    cleanPath = parts[1];
                } else {
                    cleanPath = urlObj.pathname.split('/').pop() || path;
                }
            }
        } catch (e) {
            console.warn('Worker: Error parsing URL for deletion:', e);
        }
    }
    cleanPath = normalizeObjectPath(cleanPath) || ''
    if (!cleanPath) return c.json({ error: 'Ruta de archivo inválida' }, 400)

    // Seleccionar el bucket correcto
    let bucket: R2Bucket | undefined
    const normalizedBucket = bucketName.replace(/_/g, '-')

    switch (normalizedBucket) {
        case 'course-materials': bucket = c.env.COURSE_MATERIALS; break;
        case 'course-images': bucket = c.env.COURSE_IMAGES; break;
        case 'profile-avatars': bucket = c.env.PROFILE_AVATARS; break;
        case 'profile-frames': bucket = c.env.PROFILE_FRAMES; break;
        case 'grupos': bucket = c.env.GRUPOS; break;
        case 'thumbnails': bucket = c.env.THUMBNAILS; break;
        case 'announcements': bucket = c.env.ANNOUNCEMENTS; break;
        case 'library': bucket = c.env.LIBRARY; break;
        default:
            return c.json({ error: `Bucket inválido: ${bucketName}` }, 400)
    }

    if (!bucket) {
        return c.json({ error: 'Bucket no configurado' }, 500)
    }

    try {
        await bucket.delete(cleanPath)
        console.log(`✅ Archivo eliminado exitosamente: ${cleanPath}`)
        return c.json({ success: true })
    } catch (e: any) {
        console.error(`❌ Error eliminando archivo:`, e)
        return c.json({ error: e.message }, 500)
    }
})


// GET /storage/preview-url?bucket=...&path=...
// Genera una URL Firmada (Tokenizada) que apunta al worker
// Esta URL es pública (temporalmente) y compatible con Microsoft Viewer
storageRouter.get('/preview-url', async (c) => {
    const path = c.req.query('path')
    const bucketName = c.req.query('bucket') || 'course-materials'

    console.log(`🔗 Preview URL request: bucket=${bucketName}, path=${path}`)

    if (!path) return c.json({ error: 'Falta path' }, 400)

    // 1. Generar Token
    // Payload minimalista: path + bucket + expiration
    // Expiración: 15 minutos (900s)
    const expiration = Math.floor(Date.now() / 1000) + (15 * 60)
    const payload = JSON.stringify({ p: path, b: bucketName, e: expiration })

    // Usar una clave secreta del entorno (Supabase Anon Key o una dedicada)
    const secret = c.env.SUPABASE_ANON_KEY
    const signature = await signToken(payload, secret)

    // El token incluye payload (base64) + firma
    const token = `${btoa(payload)}.${signature}`

    // 2. Construir URL pública apuntando a este mismo worker
    const url = new URL(c.req.url)
    const publicStreamUrl = `${url.origin}/storage/public-stream?token=${encodeURIComponent(token)}`

    return c.json({
        url: publicStreamUrl,
        expires_in: 900
    })
})


// GET /storage/public-stream?token=...
// Endpoint PÚBLICO (sin auth header) pero protegido por TOKEN FIRMADO
// Sirve el archivo desde R2 como un stream eficiente
storageRouter.get('/public-stream', async (c) => {
    const token = c.req.query('token')
    if (!token) return c.json({ error: 'Token requerido' }, 401)

    try {
        const [payloadB64, signature] = token.split('.')
        if (!payloadB64 || !signature) return c.json({ error: 'Token malformado' }, 401)

        // 1. Verificar Firma
        const secret = c.env.SUPABASE_ANON_KEY
        const isValid = await verifyToken(atob(payloadB64), signature, secret)
        if (!isValid) return c.json({ error: 'Firma inválida' }, 403)

        // 2. Verificar Expiración
        const payload = JSON.parse(atob(payloadB64)) // { p: path, b: bucket, e: expiration }
        if (Date.now() / 1000 > payload.e) {
            return c.json({ error: 'URL expirada', expired: true }, 410)
        }

        // 3. Obtener Bucket
        let bucket: R2Bucket | undefined
        const normalizedBucket = payload.b.replace(/_/g, '-')
        switch (normalizedBucket) {
            case 'course-materials': bucket = c.env.COURSE_MATERIALS; break;
            case 'course-images': bucket = c.env.COURSE_IMAGES; break;
            case 'profile-avatars': bucket = c.env.PROFILE_AVATARS; break;
            case 'profile-frames': bucket = c.env.PROFILE_FRAMES; break;
            case 'grupos': bucket = c.env.GRUPOS; break;
            case 'thumbnails': bucket = c.env.THUMBNAILS; break;
            case 'announcements': bucket = c.env.ANNOUNCEMENTS; break;
            case 'library': bucket = c.env.LIBRARY; break;
            default: return c.json({ error: 'Bucket inválido' }, 400);
        }

        if (!bucket) return c.json({ error: 'Bucket no encontrado' }, 500)

        // 4. Stream desde R2 Native Binding
        const object = await bucket.get(payload.p)

        if (!object) return c.json({ error: 'Archivo no encontrado' }, 404)

        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)

        // Headers críticos para Microsoft Viewer
        // Microsoft necesita saber el tamaño y tipo para renderizar correctamente
        // Cache corto para permitir range-requests eficientes
        // V5.6: Cache más agresivo (3600s = 1h) para evitar re-descargas en móviles
        headers.set('Cache-Control', 'public, max-age=3600')
        headers.set('Content-Disposition', `inline; filename="${payload.p.split('/').pop()}"`)
        headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")

        return new Response(object.body, { headers })

    } catch (e: any) {
        console.error("Stream Error:", e)
        return c.json({ error: 'Token inválido o expirado' }, 400)
    }
})


// GET /storage/secure-url?bucket=...&path=...
// Sirve el archivo directamente desde R2 (Para el frontend autenticado, imagenes pequeñas, etc.)
storageRouter.get('/secure-url', async (c) => {
    const path = c.req.query('path')
    const bucketName = c.req.query('bucket') || 'course-materials'
    const rangeHeader = c.req.header('Range')

    if (!path) return c.json({ error: 'Falta path' }, 400)

    let bucket: R2Bucket | undefined
    const normalizedBucket = bucketName.replace(/_/g, '-')

    switch (normalizedBucket) {
        case 'course-materials': bucket = c.env.COURSE_MATERIALS; break;
        case 'course-images': bucket = c.env.COURSE_IMAGES; break;
        case 'profile-avatars': bucket = c.env.PROFILE_AVATARS; break;
        case 'profile-frames': bucket = c.env.PROFILE_FRAMES; break;
        case 'grupos': bucket = c.env.GRUPOS; break;
        case 'thumbnails': bucket = c.env.THUMBNAILS; break;
        case 'announcements': bucket = c.env.ANNOUNCEMENTS; break;
        case 'library': bucket = c.env.LIBRARY; break;
        default: return c.json({ error: `Bucket inválido: ${bucketName}` }, 400)
    }

    if (!bucket) return c.json({ error: 'Bucket no configurado' }, 500)

    try {
        let r2Range: any = undefined;
        if (rangeHeader) {
            // Soporta "bytes=0-100", "bytes=500-", y "bytes=-100" (suffix)
            const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
            if (match && (match[1] || match[2])) {
                if (!match[1] && match[2]) {
                    // Suffix range: bytes=-100 (last 100 bytes)
                    r2Range = { suffix: parseInt(match[2], 10) };
                } else if (match[1]) {
                    const offset = parseInt(match[1], 10);
                    if (match[2]) {
                        const end = parseInt(match[2], 10);
                        r2Range = { offset, length: end - offset + 1 };
                    } else {
                        r2Range = { offset };
                    }
                }
            }
        }

        // Soporte de Range Requests para PDF.js y optimización de grandes archivos
        const object = await bucket.get(path, {
            range: r2Range,
        })

        if (object === null) {
            console.warn(`⚠️ Archivo no encontrado en R2: ${path}`)
            return c.json({ error: 'Archivo no encontrado' }, 404)
        }

        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)
        headers.set('Accept-Ranges', 'bytes')
        headers.set('Content-Disposition', 'inline')

        let status = 200
        // Cloudflare R2: Si se pidió un rango y se obtuvo un objeto parcial, objeto.range tendrá los datos
        if (rangeHeader && object.range) {
            const r = object.range as any;
            if (r.offset !== undefined) {
                const length = r.length || (object.size - r.offset);
                headers.set('Content-Range', `bytes ${r.offset}-${r.offset + length - 1}/${object.size}`)
                status = 206
            } else if (r.suffix !== undefined) {
                // R2 API returns { suffix: number } sometimes for suffix ranges. We calculate offset manually.
                const offset = Math.max(0, object.size - r.suffix);
                headers.set('Content-Range', `bytes ${offset}-${object.size - 1}/${object.size}`)
                status = 206
            }
        }

        // V5.6: Cache consistente de 1 hora
        headers.set('Cache-Control', 'public, max-age=3600')

        // Dejar que Hono maneje el CORS global, pero asegurar headers críticos para PDF.js
        headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Content-Range, Accept-Ranges')

        return new Response(object.body, {
            headers,
            status
        })

    } catch (e: any) {
        console.error(`❌ CRITICAL ERROR en secure-url [${path}]:`, e)
        return c.json({
            error: 'Internal Server Error',
            details: e.message,
            path: path
        }, 500)
    }
})
export default storageRouter
