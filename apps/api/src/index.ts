import { Hono } from 'hono'
import { cors } from 'hono/cors'
import storageRouter from './storage'
import { checkout } from './checkout'

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
}

const app = new Hono<{ Bindings: Bindings }>()

// Global CORS middleware
// Robust CORS Middleware
app.use('*', async (c, next) => {
    const corsMiddleware = cors({
        origin: (origin) => {
            const allowed = c.env.ALLOWED_ORIGIN; // Primary production origin

            // 1. Allow production origin
            if (origin === allowed) return origin;

            // 2. Allow Cloudflare Pages Previews (any subdomain of .pages.dev for this project)
            // Checks if it ends with .pages.dev and contains the project name to prevent abuse
            if (origin && origin.endsWith('.pages.dev') && origin.includes('cajaupazul')) {
                return origin;
            }

            // 3. Fallback: Return allowed origin (browser will block if mismatch)
            return allowed;
        },
        allowHeaders: ['Origin', 'Content-Type', 'Authorization', 'X-Custom-Header', 'Upgrade-Insecure-Requests'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
        maxAge: 600,
        credentials: true,
    })
    return corsMiddleware(c, next)
})

// Explicit OPTIONS handling for preflight
app.options('*', (c) => {
    return c.body(null, 204)
})

app.get('/', (c) => {
    return c.json({ message: 'CampusLink API is running! 🚀' })
})

app.route('/storage', storageRouter)
app.route('/checkout', checkout)

export default app