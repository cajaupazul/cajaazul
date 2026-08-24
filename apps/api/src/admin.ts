import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware, type AuthVariables } from './auth'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

const admin = new Hono<{ Bindings: Bindings; Variables: AuthVariables }>()

admin.use('*', authMiddleware)

async function requireAdmin(c: any) {
  const user = c.get('user')
  const service = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profile, error } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !profile || !['admin', 'superadmin'].includes(profile.role)) {
    return { allowed: false as const, response: c.json({ error: 'Administrator privileges are required' }, 403) }
  }

  return { allowed: true as const, user, service }
}

function extractSupabaseStoragePath(value: string | null, bucket: string) {
  if (!value) return ''
  if (!value.startsWith('http')) return value.replace(/^\/+/, '')
  try {
    const url = new URL(value)
    for (const visibility of ['public', 'sign', 'authenticated']) {
      const marker = `/storage/v1/object/${visibility}/${bucket}/`
      const index = url.pathname.indexOf(marker)
      if (index >= 0) return decodeURIComponent(url.pathname.slice(index + marker.length))
    }
  } catch {
    return ''
  }
  return ''
}

const INSTITUTIONAL_SUFFIX = '@alum.up.edu.pe'
const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function parseExpiration(value: unknown) {
  if (value === null || value === undefined || value === '') return { value: null, valid: true }
  if (typeof value !== 'string') return { value: null, valid: false }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { value: null, valid: false }
  return { value: date.toISOString(), valid: true }
}

async function readAdminBody(c: any) {
  const contentLength = Number(c.req.header('Content-Length') || '0')
  if (contentLength > 16_384) return { error: 'Request body is too large' as const }

  try {
    const body = await c.req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { error: 'A JSON object is required' as const }
    }
    return { body: body as Record<string, unknown> }
  } catch {
    return { error: 'Invalid JSON body' as const }
  }
}

admin.get('/auth/allowlist', async (c) => {
  const access = await requireAdmin(c)
  if (!access.allowed) return access.response

  const { data, error } = await access.service
    .from('auth_email_allowlist')
    .select('id, email, enabled, reason, expires_at, claimed_by, claimed_at, last_used_at, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[ADMIN_AUTH_ALLOWLIST_LIST]', error.code, error.message)
    return c.json({ error: 'No se pudo cargar la lista de accesos.' }, 500)
  }

  return c.json({ entries: data ?? [] })
})

admin.post('/auth/allowlist', async (c) => {
  const access = await requireAdmin(c)
  if (!access.allowed) return access.response

  const parsed = await readAdminBody(c)
  if ('error' in parsed) return c.json({ error: parsed.error }, 400)

  const email = normalizeEmail(parsed.body.email)
  const reason = typeof parsed.body.reason === 'string' ? parsed.body.reason.trim() : ''
  const expiration = parseExpiration(parsed.body.expiresAt)

  if (!EMAIL_PATTERN.test(email) || email.length > 254) return c.json({ error: 'Ingresa un correo válido.' }, 400)
  if (email.endsWith(INSTITUTIONAL_SUFFIX)) return c.json({ error: 'Los correos institucionales ya tienen acceso.' }, 400)
  if (reason.length > 240) return c.json({ error: 'El motivo no puede superar 240 caracteres.' }, 400)
  if (!expiration.valid) return c.json({ error: 'La fecha de expiración no es válida.' }, 400)
  if (expiration.value && new Date(expiration.value).getTime() <= Date.now()) {
    return c.json({ error: 'La fecha de expiración debe estar en el futuro.' }, 400)
  }

  const { data, error } = await access.service
    .from('auth_email_allowlist')
    .insert({
      email,
      reason: reason || null,
      expires_at: expiration.value,
      created_by: access.user.id,
      updated_by: access.user.id,
    })
    .select('id, email, enabled, reason, expires_at, claimed_by, claimed_at, last_used_at, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === '23505') return c.json({ error: 'Ese correo ya está registrado.' }, 409)
    console.error('[ADMIN_AUTH_ALLOWLIST_CREATE]', error.code, error.message)
    return c.json({ error: 'No se pudo autorizar el correo.' }, 500)
  }

  await access.service.from('admin_audit_logs').insert({
    actor_id: access.user.id,
    action: 'INSERT',
    entity_type: 'auth_email_allowlist',
    entity_id: data.id,
    after_data: { email: data.email, enabled: data.enabled, expires_at: data.expires_at },
  })

  return c.json({ entry: data }, 201)
})

admin.patch('/auth/allowlist/:id', async (c) => {
  const access = await requireAdmin(c)
  if (!access.allowed) return access.response

  const parsed = await readAdminBody(c)
  if ('error' in parsed) return c.json({ error: parsed.error }, 400)

  const entryId = c.req.param('id')
  const { data: existing, error: existingError } = await access.service
    .from('auth_email_allowlist')
    .select('id, email, enabled, reason, expires_at, claimed_by')
    .eq('id', entryId)
    .single()

  if (existingError || !existing) return c.json({ error: 'Acceso no encontrado.' }, 404)

  const update: Record<string, unknown> = { updated_by: access.user.id }
  if (typeof parsed.body.enabled === 'boolean') update.enabled = parsed.body.enabled
  if ('reason' in parsed.body) {
    if (typeof parsed.body.reason !== 'string' && parsed.body.reason !== null) return c.json({ error: 'El motivo no es válido.' }, 400)
    const reason = typeof parsed.body.reason === 'string' ? parsed.body.reason.trim() : ''
    if (reason.length > 240) return c.json({ error: 'El motivo no puede superar 240 caracteres.' }, 400)
    update.reason = reason || null
  }
  if ('expiresAt' in parsed.body) {
    const expiration = parseExpiration(parsed.body.expiresAt)
    if (!expiration.valid) return c.json({ error: 'La fecha de expiración no es válida.' }, 400)
    if (expiration.value && new Date(expiration.value).getTime() <= Date.now() && update.enabled !== false) {
      return c.json({ error: 'Desactiva el acceso o selecciona una fecha futura.' }, 400)
    }
    update.expires_at = expiration.value
  }

  const effectiveExpiration = 'expires_at' in update ? update.expires_at : existing.expires_at
  if (update.enabled === true && typeof effectiveExpiration === 'string' && new Date(effectiveExpiration).getTime() <= Date.now()) {
    return c.json({ error: 'El acceso está vencido. Asigna una nueva fecha antes de reactivarlo.' }, 400)
  }

  if (Object.keys(update).length === 1) return c.json({ error: 'No hay cambios válidos.' }, 400)

  const { data, error } = await access.service
    .from('auth_email_allowlist')
    .update(update)
    .eq('id', entryId)
    .select('id, email, enabled, reason, expires_at, claimed_by, claimed_at, last_used_at, created_at, updated_at')
    .single()

  if (error) {
    console.error('[ADMIN_AUTH_ALLOWLIST_UPDATE]', error.code, error.message)
    return c.json({ error: 'No se pudo actualizar el acceso.' }, 500)
  }

  await access.service.from('admin_audit_logs').insert({
    actor_id: access.user.id,
    action: 'UPDATE',
    entity_type: 'auth_email_allowlist',
    entity_id: entryId,
    before_data: { email: existing.email, enabled: existing.enabled, expires_at: existing.expires_at },
    after_data: { email: data.email, enabled: data.enabled, expires_at: data.expires_at },
  })

  return c.json({ entry: data })
})

admin.delete('/auth/allowlist/:id', async (c) => {
  const access = await requireAdmin(c)
  if (!access.allowed) return access.response

  const entryId = c.req.param('id')
  const { data: existing, error: existingError } = await access.service
    .from('auth_email_allowlist')
    .select('id, email, enabled, expires_at, claimed_by')
    .eq('id', entryId)
    .single()

  if (existingError || !existing) return c.json({ error: 'Acceso no encontrado.' }, 404)

  const { error } = await access.service.from('auth_email_allowlist').delete().eq('id', entryId)
  if (error) {
    console.error('[ADMIN_AUTH_ALLOWLIST_DELETE]', error.code, error.message)
    return c.json({ error: 'No se pudo eliminar el acceso.' }, 500)
  }

  await access.service.from('admin_audit_logs').insert({
    actor_id: access.user.id,
    action: 'DELETE',
    entity_type: 'auth_email_allowlist',
    entity_id: entryId,
    before_data: { email: existing.email, enabled: existing.enabled, expires_at: existing.expires_at },
  })

  return c.json({ success: true })
})

admin.delete('/catalog/items/:id', async (c) => {
  const access = await requireAdmin(c)
  if (!access.allowed) return access.response

  const itemId = c.req.param('id')
  const { service, user } = access

  const { data: item, error: itemError } = await service
    .from('shop_items')
    .select('id, name, frame_key, image_url')
    .eq('id', itemId)
    .single()

  if (itemError || !item) return c.json({ error: 'Catalog item not found' }, 404)

  if (item.frame_key) {
    const { error: profileError } = await service
      .from('profiles')
      .update({ active_frame_key: null })
      .eq('active_frame_key', item.frame_key)

    if (profileError) return c.json({ error: 'Could not safely unequip the item' }, 500)
  }

  const { error: inventoryError } = await service
    .from('user_inventory')
    .delete()
    .eq('item_id', itemId)

  if (inventoryError) return c.json({ error: 'Could not remove item entitlements' }, 500)

  const { error: deleteError } = await service
    .from('shop_items')
    .delete()
    .eq('id', itemId)

  if (deleteError) return c.json({ error: 'Could not delete the catalog item' }, 500)

  const imagePath = extractSupabaseStoragePath(item.image_url, 'profile-frames')
  if (imagePath) {
    let cleanupError: any = null
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await service.storage.from('profile-frames').remove([imagePath])
      cleanupError = result.error
      if (!cleanupError) break
      await new Promise(resolve => setTimeout(resolve, attempt * 200))
    }
    if (cleanupError) {
      await service.from('admin_audit_logs').insert({
        actor_id: user.id,
        action: 'CLEANUP_REQUIRED',
        entity_type: 'shop_item_image',
        entity_id: itemId,
        before_data: { image_url: item.image_url, error: cleanupError.message },
      })
      return c.json({ error: 'El artículo se eliminó, pero su imagen requiere limpieza manual.' }, 500)
    }
  }

  // The database trigger records the entity change. This companion entry keeps
  // the authenticated actor explicit when the service-role client performs it.
  await service.from('admin_audit_logs').insert({
    actor_id: user.id,
    action: 'DELETE',
    entity_type: 'shop_item_admin_action',
    entity_id: itemId,
    before_data: item,
  })

  return c.json({ success: true, deleted: { id: item.id, name: item.name } })
})

export default admin
