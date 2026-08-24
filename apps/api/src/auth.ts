import { createMiddleware } from 'hono/factory'
import { createClient, type User } from '@supabase/supabase-js'

export type AuthBindings = {
    SUPABASE_URL: string
    SUPABASE_ANON_KEY: string
    SUPABASE_SERVICE_ROLE_KEY: string
}

export type AuthVariables = {
    user: User
    accessSource: 'institutional' | 'exception' | 'anonymous'
    allowlistEntryId?: string
}

const INSTITUTIONAL_SUFFIX = '@alum.up.edu.pe'

export const authMiddleware = createMiddleware<{ Bindings: AuthBindings }>(async (c, next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: 'Missing or invalid Authorization header' }, 401)
    }

    const token = authHeader.slice('Bearer '.length).trim()
    if (!token || !c.env.SUPABASE_URL || !c.env.SUPABASE_ANON_KEY) {
        return c.json({ error: token ? 'Internal Configuration Error' : 'Missing token' }, token ? 500 : 401)
    }

    try {
        const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY, {
            auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
        })
        const { data: { user }, error } = await supabase.auth.getUser(token)
        if (error || !user) {
            console.error('[AUTH_VALIDATION_FAILED]', error?.message)
            return c.json({ error: 'Unauthorized: Invalid Token' }, 401)
        }

        let accessSource: AuthVariables['accessSource'] = 'institutional'
        let allowlistEntryId: string | undefined

        if (user.is_anonymous) {
            accessSource = 'anonymous'
        } else if (!user.email?.trim().toLowerCase().endsWith(INSTITUTIONAL_SUFFIX)) {
            const email = user.email?.trim().toLowerCase()
            if (!email || !c.env.SUPABASE_SERVICE_ROLE_KEY) {
                return c.json({ error: 'Account is not authorized', reason: 'missing_email' }, 403)
            }

            const service = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY, {
                auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
            })
            const { data: entry, error: accessError } = await service
                .from('auth_email_allowlist')
                .select('id, enabled, expires_at')
                .eq('email', email)
                .maybeSingle()

            if (accessError) {
                console.error('[AUTH_ALLOWLIST_LOOKUP]', accessError.code, accessError.message)
                return c.json({ error: 'Could not verify account access' }, 503)
            }

            const expired = Boolean(entry?.expires_at && new Date(entry.expires_at).getTime() <= Date.now())
            if (!entry || !entry.enabled || expired) {
                const reason = !entry ? 'not_approved' : expired ? 'expired' : 'revoked'
                const { error: revokeError } = await service.rpc('revoke_external_auth_sessions', {
                    target_user_id: user.id,
                })
                if (revokeError) console.error('[AUTH_SESSION_REVOKE]', revokeError.code, revokeError.message)
                return c.json({ error: 'Account is not authorized', reason }, 403)
            }

            accessSource = 'exception'
            allowlistEntryId = entry.id
        }

        const context = c as unknown as { set: (key: string, value: unknown) => void }
        context.set('user', user)
        context.set('accessSource', accessSource)
        if (allowlistEntryId) context.set('allowlistEntryId', allowlistEntryId)
        await next()
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown validation error'
        console.error('[AUTH_VALIDATION_ERROR]', message)
        return c.json({ error: 'Unauthorized: Validation Failed' }, 401)
    }
})
