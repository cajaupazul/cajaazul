import { Hono } from 'hono'
import { cors } from 'hono/cors'
import storageRouter from './storage'
import { checkout } from './checkout'

type Bindings = {
    ALLOWED_ORIGIN: string
    SUPABASE_URL: string
    SUPABASE_SERVICE_ROLE_KEY: string
    MP_ACCESS_TOKEN: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Global CORS middleware
// Robust CORS Middleware
app.use('*', async (c, next) => {
    const corsMiddleware = cors({
        origin: (origin) => {
            const allowed = c.env.ALLOWED_ORIGIN;
            // Allow requests with no origin (like mobile apps or curl) or matching origin
            // For strict production: return allowed === origin ? origin : null;
            // For now, we allow the configured origin.
            return origin === allowed ? allowed : allowed;
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
