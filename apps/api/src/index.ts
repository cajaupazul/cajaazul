import { Hono } from 'hono'
import { cors } from 'hono/cors'
import storageRouter from './storage'
import { checkout } from './checkout'
import shop from './shop'
import extensionRouter from './extension'
import adminRouter from './admin'
import accessRouter from './access'

type Bindings = {
    ALLOWED_ORIGIN: string
    SUPABASE_URL: string
    SUPABASE_SERVICE_ROLE_KEY: string
    SUPABASE_ANON_KEY: string
    MP_ACCESS_TOKEN: string
    COURSE_MATERIALS: R2Bucket
    PROFILE_AVATARS: R2Bucket
    PROFILE_FRAMES: R2Bucket
    GRUPOS: R2Bucket
    COURSE_IMAGES: R2Bucket
    BLACKBOARD_DOWNLOADS: R2Bucket
    FORENSIC_SUPABASE_URL?: string
    FORENSIC_SUPABASE_KEY?: string
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
        allowHeaders: ['Origin', 'Content-Type', 'Authorization', 'X-Custom-Header', 'X-File-Size', 'Upgrade-Insecure-Requests', 'Range'],
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

app.get('/health', (c) => {
    return c.json({ status: 'ok', worker: 'campuslink-api' })
})

app.route('/storage', storageRouter)
app.route('/checkout', checkout)
app.route('/shop', shop)
app.route('/admin', adminRouter)
app.route('/auth', accessRouter)
app.route('/', extensionRouter)

export default app
