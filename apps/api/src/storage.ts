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
    // NO R2_ACCESS_KEYS required (Native Bindings)
}

const storageRouter = new Hono<{ Bindings: Bindings }>()

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
    if (method === 'PUT' || method === 'DELETE') {
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
        default:
            return c.json({ error: `Bucket inválido: ${bucketName}` }, 400)
    }

    if (!bucket) {
        return c.json({ error: 'Bucket no configurado' }, 500)
    }

    try {
        const body = await c.req.arrayBuffer()

        await bucket.put(path, body, {
            httpMetadata: {
                contentType: contentType,
            }
        })

        console.log(`✅ Archivo subido exitosamente: ${path}`)

        return c.json({
            success: true,
            path: path,
            bucket: normalizedBucket,
            url: `${c.env.ALLOWED_ORIGIN}/storage/secure-url?bucket=${normalizedBucket}&path=${encodeURIComponent(path)}`
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
    if (secret && secret !== c.env.SUPABASE_ANON_KEY) {
        return c.json({ error: 'Secret de mantenimiento inválido' }, 401)
    }

    if (!secret && !c.req.header('Authorization')) {
        return c.json({ error: 'No autorizado (Falta header o secret)' }, 401)
    }

    if (!path) {
        return c.json({ error: 'Falta el parámetro "path"' }, 400)
    }

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
        default:
            return c.json({ error: `Bucket inválido: ${bucketName}` }, 400)
    }

    if (!bucket) {
        return c.json({ error: 'Bucket no configurado' }, 500)
    }

    try {
        await bucket.delete(path)
        console.log(`✅ Archivo eliminado exitosamente: ${path}`)
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
        headers.set('Cache-Control', 'public, max-age=1800')
        headers.set('Content-Disposition', `attachment; filename="${payload.p.split('/').pop()}"`)
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

    // console.log(`📂 Storage request: bucket=${bucketName}, path=${path}`)

    if (!path) {
        return c.json({ error: 'Falta el parámetro "path"' }, 400)
    }

    // Seleccionar el bucket correcto
    let bucket: R2Bucket | undefined

    // Normalizar nombres de bucket (aceptar con guion bajo o guion)
    const normalizedBucket = bucketName.replace(/_/g, '-')

    switch (normalizedBucket) {
        case 'course-materials': bucket = c.env.COURSE_MATERIALS; break;
        case 'course-images': bucket = c.env.COURSE_IMAGES; break;
        case 'profile-avatars': bucket = c.env.PROFILE_AVATARS; break;
        case 'profile-frames': bucket = c.env.PROFILE_FRAMES; break;
        case 'grupos': bucket = c.env.GRUPOS; break;
        case 'thumbnails': bucket = c.env.THUMBNAILS; break;
        default:
            // console.log(`❌ Bucket inválido: ${bucketName}`)
            return c.json({ error: `Bucket inválido: ${bucketName}` }, 400)
    }

    if (!bucket) {
        return c.json({ error: 'Bucket no configurado' }, 500)
    }

    try {
        const object = await bucket.get(path)

        if (object === null) {
            return c.json({ error: 'Archivo no encontrado' }, 404)
        }

        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)

        // CORS headers
        const origin = c.req.header('Origin')
        let allowedOrigin = c.env.ALLOWED_ORIGIN

        if (origin) {
            if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.endsWith('.pages.dev') || origin === c.env.ALLOWED_ORIGIN) {
                allowedOrigin = origin
            }
        }

        headers.set('Access-Control-Allow-Origin', allowedOrigin)
        headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
        headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type')

        headers.set('Content-Disposition', 'inline')

        return new Response(object.body, { headers })

    } catch (e: any) {
        console.error(`❌ Error obteniendo archivo:`, e)
        return c.json({ error: e.message }, 500)
    }
})


export default storageRouter
