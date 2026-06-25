import { Hono } from 'hono'
import { cors } from 'hono/cors'
import storageRouter from './storage'
import { checkout } from './checkout'
import shop from './shop'

type Bindings = {
    ALLOWED_ORIGIN: string
    SUPABASE_URL: string
    SUPABASE_SERVICE_ROLE_KEY: string
    SUPABASE_ANON_KEY: string  // 👈 AGREGADO
    MP_ACCESS_TOKEN: string
    COURSE_MATERIALS: R2Bucket
    PROFILE_AVATARS: R2Bucket
    PROFILE_FRAMES: R2Bucket
    GRUPOS: R2Bucket
    COURSE_IMAGES: R2Bucket
    BLACKBOARD_DOWNLOADS: R2Bucket
}

const app = new Hono<{ Bindings: Bindings }>()

// Global CORS middleware
// Robust CORS Middleware
// CORS Configuration
app.use('*', async (c, next) => {
    const corsMiddleware = cors({
        origin: (origin) => {
            // Permitir localhost para desarrollo
            if (origin.includes('localhost') || origin.includes('127.0.0.1')) return origin;

            // Permitir dominio de producción y previews de Cloudflare
            if (origin.endsWith('.pages.dev') || origin === c.env.ALLOWED_ORIGIN) return origin;

            return c.env.ALLOWED_ORIGIN;
        },
        allowHeaders: ['Origin', 'Content-Type', 'Authorization', 'X-Custom-Header', 'Upgrade-Insecure-Requests', 'Range'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        exposeHeaders: ['Content-Length', 'X-Kuma-Revision', 'Content-Range', 'Accept-Ranges'],
        maxAge: 600,
        credentials: true,
    })
    return corsMiddleware(c, next)
})

// Explicit OPTIONS handling
app.options('*', (c) => {
    return c.body(null, 204)
})

app.get('/', (c) => {
    return c.json({ message: 'CampusLink API is running! 🚀' })
})

app.route('/storage', storageRouter)
app.route('/checkout', checkout)
app.route('/shop', shop)

// --- Endpoint exclusivo para la Extensión de Blackboard ---
const EXTENSION_SECRET_KEY = 'CampusLink-Ext-2026-SuperSecreta';

app.post('/upload-from-extension', async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (authHeader !== `Bearer ${EXTENSION_SECRET_KEY}`) {
            return c.json({ error: 'Acceso no autorizado' }, 401);
        }

        const body = await c.req.parseBody();
        const file = body['file'] as File;
        const courseId = (body['courseId'] as string) || 'General';

        if (!file) {
            return c.json({ error: 'No se envió ningún archivo' }, 400);
        }

        const filePath = `${courseId}/${file.name}`;
        
        await c.env.BLACKBOARD_DOWNLOADS.put(filePath, await file.arrayBuffer(), {
            httpMetadata: { contentType: file.type },
        });

        return c.json({ 
            success: true, 
            message: 'Archivo respaldado en R2 exitosamente',
            path: filePath
        });

    } catch (error) {
        console.error('Error guardando en R2:', error);
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});
// --------------------------------------------------------

export default app