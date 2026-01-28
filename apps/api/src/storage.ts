import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware } from './auth'

type Bindings = {
    SUPABASE_URL: string
    SUPABASE_SERVICE_ROLE_KEY: string
}

const storageRouter = new Hono<{ Bindings: Bindings }>()

// Protect all storage routes
storageRouter.use('/*', authMiddleware)

storageRouter.get('/sign', async (c) => {
    const path = c.req.query('path')
    const bucket = c.req.query('bucket') || 'profile-avatars'

    if (!path) {
        return c.json({ error: 'Missing "path" query parameter' }, 400)
    }

    const supabaseIndex = createClient(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Generate signed URL (valid for 1 hour)
    const { data, error } = await supabaseIndex
        .storage
        .from(bucket)
        .createSignedUrl(path, 3600)

    if (error) {
        console.error('Storage error:', error)
        return c.json({ error: error.message }, 500)
    }

    return c.json({ signedUrl: data.signedUrl })
})

export default storageRouter
