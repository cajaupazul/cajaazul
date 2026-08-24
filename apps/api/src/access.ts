import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware, type AuthBindings, type AuthVariables } from './auth'

const access = new Hono<{ Bindings: AuthBindings; Variables: AuthVariables }>()
access.use('*', authMiddleware)

access.get('/access', async (c) => {
  const user = c.get('user')
  const source = c.get('accessSource')
  const allowlistEntryId = c.get('allowlistEntryId')

  if (source === 'exception' && allowlistEntryId) {
    const service = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
    const now = new Date().toISOString()
    const { error } = await service
      .from('auth_email_allowlist')
      .update({ claimed_by: user.id, claimed_at: now, last_used_at: now, updated_at: now })
      .eq('id', allowlistEntryId)

    if (error) console.error('[AUTH_ACCESS_CLAIM]', error.code, error.message)
  }

  return c.json({ allowed: true, source })
})

export default access
