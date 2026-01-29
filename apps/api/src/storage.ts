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

// GET /storage/secure-url?bucket=...&path=...
// Sirve el archivo directamente desde R2
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
        console.log(`📥 Obteniendo archivo de R2: ${path}`)
        const object = await bucket.get(path)

        if (object === null) {
            console.log(`❌ Archivo no encontrado: ${path}`)
            return c.json({ error: 'Archivo no encontrado' }, 404)
        }

        console.log(`✅ Archivo encontrado, enviando...`)

        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)

        // CORS headers
        headers.set('Access-Control-Allow-Origin', c.env.ALLOWED_ORIGIN)
        headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
        headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

        // Para PDFs, forzar visualización inline
        if (path.toLowerCase().endsWith('.pdf')) {
            headers.set('Content-Disposition', 'inline')
        }

        return new Response(object.body, { headers })

    } catch (e: any) {
        console.error(`❌ Error obteniendo archivo:`, e)
        return c.json({ error: e.message }, 500)
    }
})

export default storageRouter