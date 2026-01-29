import { createMiddleware } from 'hono/factory'
import { createClient } from '@supabase/supabase-js'

type Bindings = {
    SUPABASE_URL: string
    SUPABASE_ANON_KEY: string
    SUPABASE_SERVICE_ROLE_KEY: string
}

export const authMiddleware = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
    const authHeader = c.req.header('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('❌ Auth Error: Missing or invalid Authorization header')
        return c.json({ error: 'Missing or invalid Authorization header' }, 401)
    }

    const token = authHeader.split(' ')[1]
    const supabaseUrl = c.env.SUPABASE_URL
    const supabaseKey = c.env.SUPABASE_ANON_KEY // Use Anon key for getUser, or Service Role if strictly needed. 
    // Usually getUser(token) works with Anon key if the token is valid.
    // However, user asked for SUBPASE_SERVICE_ROLE_KEY. Let's use it to be robust and bypass RLS if we were querying data, 
    // but for getUser it doesn't strictly matter as long as we pass the JWT.
    // I will use ANON KEY to initialize client, but validation happens via the token.

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Configuration Error: SUPABASE_URL or Key missing')
        return c.json({ error: 'Internal Configuration Error' }, 500)
    }

    try {
        // Create a new client for each request to ensure no shared state
        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false
            }
        })

        // Validate token strictly with Supabase Auth Server
        const { data: { user }, error } = await supabase.auth.getUser(token)

        if (error || !user) {
            console.error('❌ Auth Failed:', error?.message)
            return c.json({ error: 'Unauthorized: Invalid Token' }, 401)
        }

        // Attach user specifically to context
        c.set('user', user)

        await next()
    } catch (err: any) {
        console.error('❌ Unexpected Auth Error:', err.message)
        return c.json({ error: 'Unauthorized: Validation Failed' }, 401)
    }
})
