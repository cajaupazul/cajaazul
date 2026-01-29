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
}

const storageRouter = new Hono<{ Bindings: Bindings }>()

// Middleware de autenticación solo para buckets privados
const privateAuthMiddleware = async (c: any, next: any) => {
    const bucketName = c.req.query('bucket') || 'course-materials'

    // Solo aplicar auth a buckets privados
    if (bucketName === 'course-materials' || bucketName === 'course_materials') {
        return authMiddleware(c, next)
    }

    // Para buckets públicos, continuar sin auth
    await next()
}

storageRouter.use('/*', privateAuthMiddleware)


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
        case 'course-materials':
            bucket = c.env.COURSE_MATERIALS
            break
        case 'course-images':
            bucket = c.env.COURSE_IMAGES
            break
        case 'profile-avatars':
            bucket = c.env.PROFILE_AVATARS
            break
        case 'profile-frames':
            bucket = c.env.PROFILE_FRAMES
            break
        case 'grupos':
            bucket = c.env.GRUPOS
            break
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

// Helper para firmar tokens (Simple HMAC o similar)
// En producción, usar una biblioteca JWT real o WebCrypto
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
    return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function verifyToken(data: string, signature: string, secret: string) {
    const expected = await signToken(data, secret)
    return expected === signature
}

// GET /storage/preview-url?bucket=...&path=...
// Genera una URL temporal pública para visores externos (Google/MS)
storageRouter.get('/preview-url', async (c) => {
    // 1. Auth check (ya manejado por middleware para buckets privados)
    const path = c.req.query('path')
    const bucketName = c.req.query('bucket') || 'course-materials'

    if (!path) return c.json({ error: 'Falta path' }, 400)

    // 2. Generar Token
    // Payload: path + expiration
    const expiration = Math.floor(Date.now() / 1000) + (5 * 60) // 5 minutos
    const payload = JSON.stringify({ p: path, b: bucketName, e: expiration })
    const secret = c.env.SUPABASE_ANON_KEY // O un secreto dedicado en env
    const signature = await signToken(payload, secret)
    const token = `${btoa(payload)}.${signature}`

    // 3. Construir URL pública para el stream
    const publicUrl = `${c.env.ALLOWED_ORIGIN}/storage/public-stream?token=${token}`

    return c.json({
        url: publicUrl,
        expires: expiration
    })
})

// GET /storage/public-stream?token=...
// Endpoint "Público" pero protegido por token firmado
// Usado por Google/MS Viewers
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
        const payload = JSON.parse(atob(payloadB64))
        if (Date.now() / 1000 > payload.e) {
            return c.json({ error: 'URL expirada', expired: true }, 410)
        }

        // 3. Servir Archivo
        const bucket = payload.b === 'course-materials' ? c.env.COURSE_MATERIALS : c.env.COURSE_MATERIALS // Default por seguridad
        // (Añadir lógica de seleccion de bucket si se requiere ampliar)

        const object = await bucket.get(payload.p)
        if (!object) return c.json({ error: 'Archivo no encontrado' }, 404)

        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)

        // Cache corto para que el visor no falle si hace range requests
        headers.set('Cache-Control', 'public, max-age=300')

        // Headers de seguridad CRÍTICOS
        headers.set('Content-Disposition', 'inline') // NUNCA attachment
        headers.set('X-Content-Type-Options', 'nosniff')
        headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox") // Sandbox estricto

        return new Response(object.body, { headers })

    } catch (e) {
        return c.json({ error: 'Token inválido' }, 400)
    }
})

// GET /storage/secure-url?bucket=...&path=...
// Sirve el archivo directamente desde R2 (Para el frontend autenticado)
storageRouter.get('/secure-url', async (c) => {
    const path = c.req.query('path')
    const bucketName = c.req.query('bucket') || 'course-materials'

    console.log(`📂 Storage request: bucket=${bucketName}, path=${path}`)

    if (!path) {
        return c.json({ error: 'Falta el parámetro "path"' }, 400)
    }

    // Seleccionar el bucket correcto
    let bucket: R2Bucket | undefined

    // Normalizar nombres de bucket (aceptar con guion bajo o guion)
    const normalizedBucket = bucketName.replace(/_/g, '-')

    switch (normalizedBucket) {
        case 'course-materials':
            bucket = c.env.COURSE_MATERIALS
            break
        case 'course-images':
            bucket = c.env.COURSE_IMAGES
            break
        case 'profile-avatars':
            bucket = c.env.PROFILE_AVATARS
            break
        case 'profile-frames':
            bucket = c.env.PROFILE_FRAMES
            break
        case 'grupos':
            bucket = c.env.GRUPOS
            break
        default:
            console.log(`❌ Bucket inválido: ${bucketName}`)
            return c.json({ error: `Bucket inválido: ${bucketName}` }, 400)
    }

    if (!bucket) {
        return c.json({ error: 'Bucket no configurado' }, 500)
    }

    try {
        // console.log(`📥 Obteniendo archivo de R2: ${path}`) // Log spam
        const object = await bucket.get(path)

        if (object === null) {
            console.log(`❌ Archivo no encontrado: ${path}`)
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
        headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type') // Importante para client-side viewers

        // Para PDFs, forzar visualización inline
        // if (path.toLowerCase().endsWith('.pdf')) {
        headers.set('Content-Disposition', 'inline')
        // }

        return new Response(object.body, { headers })

    } catch (e: any) {
        console.error(`❌ Error obteniendo archivo:`, e)
        return c.json({ error: e.message }, 500)
    }
})

export default storageRouter