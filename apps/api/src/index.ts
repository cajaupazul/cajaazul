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
app.use('/*', (c, next) => {
    const corsMiddleware = cors({
        origin: c.env.ALLOWED_ORIGIN || '*',
        allowHeaders: ['Origin', 'Content-Type', 'Authorization'],
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        exposeHeaders: ['Content-Length'],
        maxAge: 600,
        credentials: true,
    })
    return corsMiddleware(c, next)
})

app.get('/', (c) => {
    return c.json({ message: 'CampusLink API is running! 🚀' })
})

app.route('/storage', storageRouter)
app.route('/checkout', checkout)

export default app
