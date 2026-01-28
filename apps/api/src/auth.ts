import { createMiddleware } from 'hono/factory'
import { jwtVerify, createRemoteJWKSet } from 'jose'

type Bindings = {
    SUPABASE_URL: string
    SUPABASE_SERVICE_ROLE_KEY: string
}

export const authMiddleware = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
    const authHeader = c.req.header('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Missing or invalid Authorization header' }, 401)
    }

    const token = authHeader.split(' ')[1]
    const supabaseUrl = c.env.SUPABASE_URL

    if (!supabaseUrl) {
        console.error('SUPABASE_URL not configured')
        return c.json({ error: 'Internal Server Error' }, 500)
    }

    try {
        // 1. Verify JWT signature using Supabase's JWKS
        // This is stateless and secure.
        const JWKS = createRemoteJWKSet(new URL(`${supabaseUrl}/rest/v1/auth/jwks`))

        const { payload } = await jwtVerify(token, JWKS)

        // 2. Attach user to context (optional, if we need user info later)
        c.set('user', payload)

        await next()
    } catch (err) {
        console.error('JWT Verification failed:', err)
        return c.json({ error: 'Unauthorized: Invalid Token' }, 401)
    }
})
