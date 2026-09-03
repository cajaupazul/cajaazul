import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware, type AuthVariables } from './auth'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  PROFILE_FRAMES: R2Bucket
  WEBHOOK_URL_BASE?: string
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

const ITEM_TYPES = new Set(['profile_frame', 'background', 'badge', 'sticker', 'other'])
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const R2_ASSET_KEY = /^items\/([0-9a-f-]{36})\/v([0-9]+)\/(original|display|thumbnail)\.([a-z0-9]+)$/i

function publicR2Url(c: any, bucket: string, objectKey: string) {
  const publicOrigin = (c.env.WEBHOOK_URL_BASE || new URL(c.req.url).origin).replace(/\/$/, '')
  return `${publicOrigin}/storage/secure-url?bucket=${bucket}&path=${encodeURIComponent(objectKey)}`
}

function parseAsset(value: unknown, expectedItemId: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const asset = value as Record<string, unknown>
  const objectKey = typeof asset.objectKey === 'string' ? asset.objectKey.trim() : ''
  const match = R2_ASSET_KEY.exec(objectKey)
  const mimeType = typeof asset.mimeType === 'string' ? asset.mimeType.toLowerCase() : ''
  const sizeBytes = Number(asset.sizeBytes)
  const checksum = typeof asset.checksumSha256 === 'string' ? asset.checksumSha256.toLowerCase() : null
  if (
    asset.bucket !== 'profile-frames' || !match || match[1].toLowerCase() !== expectedItemId.toLowerCase() ||
    !IMAGE_TYPES.has(mimeType) || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > 16 * 1024 * 1024 ||
    (checksum !== null && !/^[a-f0-9]{64}$/.test(checksum))
  ) return null
  return { bucket: 'profile-frames', objectKey, version: Number(match[2]), variant: match[3].toLowerCase(), mimeType, sizeBytes, checksum }
}

function catalogFields(body: Record<string, unknown>, partial = false) {
  const update: Record<string, unknown> = {}
  for (const field of ['name', 'description', 'frame_key'] as const) {
    if (!(field in body)) continue
    if (body[field] !== null && typeof body[field] !== 'string') return null
    const value = typeof body[field] === 'string' ? body[field].trim() : null
    update[field] = value || null
  }
  if ('type' in body) {
    if (typeof body.type !== 'string' || !ITEM_TYPES.has(body.type)) return null
    update.type = body.type
  }
  if ('category_id' in body) update.category_id = typeof body.category_id === 'string' && body.category_id ? body.category_id : null
  if ('price_coins' in body) {
    const price = Number(body.price_coins)
    if (!Number.isInteger(price) || price < 0 || price > 10_000_000) return null
    update.price_coins = price
  }
  if ('max_uses' in body) {
    const maxUses = body.max_uses === null || body.max_uses === '' ? null : Number(body.max_uses)
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100_000)) return null
    update.max_uses = maxUses
  }
  if ('bundle_items' in body) {
    if (!Array.isArray(body.bundle_items) || body.bundle_items.some(value => typeof value !== 'string')) return null
    update.bundle_items = body.bundle_items
  }
  if ('frame_settings' in body) update.frame_settings = body.frame_settings && typeof body.frame_settings === 'object' ? body.frame_settings : null
  if (!partial && (!update.name || !update.type || !('price_coins' in update))) return null
  return update
}

async function logAdminAction(service: any, actorId: string, action: string, entityType: string, entityId: string, before: unknown, after: unknown) {
  const { error } = await service.from('admin_audit_logs').insert({
    actor_id: actorId, action, entity_type: entityType, entity_id: entityId,
    before_data: before ?? null, after_data: after ?? null,
  })
  if (error) console.error('[ADMIN_AUDIT]', error.code, error.message)
}

async function removeLegacySupabaseAsset(service: any, imageUrl: string | null) {
  const path = extractSupabaseStoragePath(imageUrl, 'profile-frames')
  if (!path) return
  const { error } = await service.storage.from('profile-frames').remove([path])
  if (error) throw new Error(error.message)
}

async function removeR2Assets(bucket: R2Bucket, assets: Array<{ object_key: string }>) {
  const keys = [...new Set(assets.map(asset => asset.object_key).filter(Boolean))]
  if (keys.length) await bucket.delete(keys)
}

admin.get('/catalog/items', async (c) => {
  const access = await requireAdmin(c)
  if (!access.allowed) return access.response
  const [{ data: items, error }, { data: owners, error: ownerError }] = await Promise.all([
    access.service.from('shop_items').select('*, shop_item_assets(*)').order('updated_at', { ascending: false }),
    access.service.from('user_inventory').select('item_id'),
  ])
  if (error || ownerError) return c.json({ error: 'No se pudo cargar el catálogo administrativo.' }, 500)
  const counts = new Map<string, number>()
  for (const owner of owners ?? []) counts.set(owner.item_id, (counts.get(owner.item_id) ?? 0) + 1)
  return c.json({ items: (items ?? []).map(item => ({ ...item, owner_count: counts.get(item.id) ?? 0 })) })
})

admin.post('/catalog/items', async (c) => {
  const access = await requireAdmin(c)
  if (!access.allowed) return access.response
  const parsed = await readAdminBody(c)
  if ('error' in parsed) return c.json({ error: parsed.error }, 400)
  const itemId = typeof parsed.body.id === 'string' ? parsed.body.id : ''
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) return c.json({ error: 'Identificador de artículo inválido.' }, 400)
  const fields = catalogFields(parsed.body)
  const asset = parseAsset(parsed.body.asset, itemId)
  if (!fields || !asset) return c.json({ error: 'Los datos del artículo o de su archivo no son válidos.' }, 400)
  const imageUrl = publicR2Url(c, asset.bucket, asset.objectKey)
  const { data: item, error } = await access.service.from('shop_items').insert({
    id: itemId, ...fields, image_url: imageUrl, is_active: true,
    catalog_status: 'active', updated_by: access.user.id,
  }).select('*').single()
  if (error || !item) return c.json({ error: error?.message || 'No se pudo crear el artículo.' }, 400)
  const { error: assetError } = await access.service.from('shop_item_assets').insert({
    item_id: itemId, bucket: asset.bucket, object_key: asset.objectKey,
    variant: asset.variant, version: asset.version, mime_type: asset.mimeType,
    size_bytes: asset.sizeBytes, checksum_sha256: asset.checksum, created_by: access.user.id,
  })
  if (assetError) {
    await access.service.from('shop_items').delete().eq('id', itemId)
    return c.json({ error: 'No se pudo registrar la versión del archivo.' }, 500)
  }
  return c.json({ item }, 201)
})

admin.patch('/catalog/items/:id', async (c) => {
  const access = await requireAdmin(c)
  if (!access.allowed) return access.response
  const parsed = await readAdminBody(c)
  if ('error' in parsed) return c.json({ error: parsed.error }, 400)
  const itemId = c.req.param('id')
  const fields = catalogFields(parsed.body, true)
  if (!fields) return c.json({ error: 'Hay datos de artículo inválidos.' }, 400)
  const hasAsset = 'asset' in parsed.body
  const asset = hasAsset ? parseAsset(parsed.body.asset, itemId) : null
  if (hasAsset && !asset) return c.json({ error: 'El nuevo archivo no es válido.' }, 400)
  const { data: existing, error: existingError } = await access.service.from('shop_items').select('*').eq('id', itemId).single()
  if (existingError || !existing) return c.json({ error: 'Artículo no encontrado.' }, 404)
  if (existing.catalog_status === 'revoked') return c.json({ error: 'Un artículo revocado no se puede editar.' }, 409)

  let insertedAssetId: string | null = null
  if (asset) {
    const inserted = await access.service.from('shop_item_assets').insert({
      item_id: itemId, bucket: asset.bucket, object_key: asset.objectKey, variant: asset.variant,
      version: asset.version, mime_type: asset.mimeType, size_bytes: asset.sizeBytes,
      checksum_sha256: asset.checksum, is_current: false, created_by: access.user.id,
    }).select('id').single()
    if (inserted.error || !inserted.data) return c.json({ error: 'No se pudo registrar el nuevo archivo.' }, 500)
    insertedAssetId = inserted.data.id
    fields.image_url = publicR2Url(c, asset.bucket, asset.objectKey)
  }
  const { data: item, error } = await access.service.from('shop_items').update({ ...fields, updated_by: access.user.id }).eq('id', itemId).select('*').single()
  if (error || !item) {
    if (insertedAssetId) await access.service.from('shop_item_assets').delete().eq('id', insertedAssetId)
    return c.json({ error: error?.message || 'No se pudo actualizar el artículo.' }, 400)
  }
  if (asset && insertedAssetId) {
    const { data: previous } = await access.service.from('shop_item_assets').select('id, object_key').eq('item_id', itemId).eq('variant', asset.variant).eq('is_current', true)
    await access.service.from('shop_item_assets').update({ is_current: false, status: 'superseded', superseded_at: new Date().toISOString() }).eq('item_id', itemId).eq('variant', asset.variant).eq('is_current', true)
    await access.service.from('shop_item_assets').update({ is_current: true, status: 'active' }).eq('id', insertedAssetId)
    try {
      await removeR2Assets(c.env.PROFILE_FRAMES, previous ?? [])
      if (previous?.length) await access.service.from('shop_item_assets').update({ status: 'deleted', deleted_at: new Date().toISOString() }).in('id', previous.map(row => row.id))
      else await removeLegacySupabaseAsset(access.service, existing.image_url)
    } catch (cleanupError: any) {
      if (previous?.length) await access.service.from('shop_item_assets').update({ status: 'cleanup_failed' }).in('id', previous.map(row => row.id))
      await logAdminAction(access.service, access.user.id, 'CLEANUP_REQUIRED', 'shop_item_asset', itemId, { image_url: existing.image_url }, { error: cleanupError?.message })
    }
  }
  return c.json({ item })
})

async function setCatalogVisibility(c: any, active: boolean) {
  const access = await requireAdmin(c)
  if (!access.allowed) return access.response
  const itemId = c.req.param('id')
  const { data: before } = await access.service.from('shop_items').select('id, name, catalog_status, image_url').eq('id', itemId).single()
  if (!before) return c.json({ error: 'Artículo no encontrado.' }, 404)
  if (before.catalog_status === 'revoked' || (active && !before.image_url)) return c.json({ error: 'El artículo no se puede reactivar.' }, 409)
  const changes = active
    ? { is_active: true, catalog_status: 'active', retired_at: null, updated_by: access.user.id }
    : { is_active: false, catalog_status: 'retired', retired_at: new Date().toISOString(), updated_by: access.user.id }
  const { data: item, error } = await access.service.from('shop_items').update(changes).eq('id', itemId).select('*').single()
  if (error || !item) return c.json({ error: `No se pudo ${active ? 'activar' : 'retirar'} el artículo.` }, 500)
  await logAdminAction(access.service, access.user.id, active ? 'ACTIVATE' : 'RETIRE', 'shop_item_lifecycle', itemId, before, item)
  return c.json({ item })
}

admin.post('/catalog/items/:id/retire', c => setCatalogVisibility(c, false))
admin.post('/catalog/items/:id/activate', c => setCatalogVisibility(c, true))

admin.delete('/catalog/items/:id', async (c) => {
  const access = await requireAdmin(c)
  if (!access.allowed) return access.response
  const itemId = c.req.param('id')
  const parsed = await readAdminBody(c)
  if ('error' in parsed) return c.json({ error: parsed.error }, 400)
  const reason = typeof parsed.body.reason === 'string' ? parsed.body.reason.trim() : ''
  const confirmation = typeof parsed.body.confirmation === 'string' ? parsed.body.confirmation.trim() : ''
  const { data: item, error: itemError } = await access.service.from('shop_items').select('id, name, image_url').eq('id', itemId).single()
  if (itemError || !item) return c.json({ error: 'Artículo no encontrado.' }, 404)
  if (confirmation !== item.name.trim()) return c.json({ error: 'Confirma con el nombre exacto del artículo.' }, 400)
  if (reason.length < 10 || reason.length > 1000) return c.json({ error: 'El motivo debe tener entre 10 y 1000 caracteres.' }, 400)
  const { data: assets } = await access.service.from('shop_item_assets').select('id, object_key').eq('item_id', itemId).neq('status', 'deleted')
  const { data: revocation, error: revocationError } = await access.service.rpc('internal_revoke_shop_item', {
    p_item_id: itemId,
    p_actor_id: access.user.id,
    p_reason: reason,
  })
  if (revocationError) return c.json({ error: 'No se pudo retirar el artículo de los inventarios.' }, 500)
  await access.service.from('shop_items').update({ is_active: false, catalog_status: 'deletion_pending', updated_by: access.user.id }).eq('id', itemId)
  try {
    if (assets?.length) await removeR2Assets(c.env.PROFILE_FRAMES, assets)
    else await removeLegacySupabaseAsset(access.service, item.image_url)
  } catch (cleanupError: any) {
    if (assets?.length) await access.service.from('shop_item_assets').update({ status: 'cleanup_failed' }).in('id', assets.map(row => row.id))
    await logAdminAction(access.service, access.user.id, 'CLEANUP_REQUIRED', 'shop_item_asset', itemId, item, { error: cleanupError?.message })
    return c.json({ error: 'No se borró el registro porque el archivo no pudo limpiarse. Puedes reintentarlo.' }, 502)
  }
  const { error } = await access.service.from('shop_items').delete().eq('id', itemId)
  if (error) return c.json({ error: 'El archivo se limpió, pero el registro requiere revisión.' }, 500)
  await logAdminAction(access.service, access.user.id, 'DELETE', 'shop_item_admin_action', itemId, item, { reason, revoked_owners: revocation?.owner_count ?? 0 })
  return c.json({ success: true, deleted: { id: item.id, name: item.name, revokedOwners: revocation?.owner_count ?? 0 } })
})

admin.post('/catalog/items/:id/revoke', async (c) => {
  const access = await requireAdmin(c)
  if (!access.allowed) return access.response
  const parsed = await readAdminBody(c)
  if ('error' in parsed) return c.json({ error: parsed.error }, 400)
  const itemId = c.req.param('id')
  const reason = typeof parsed.body.reason === 'string' ? parsed.body.reason.trim() : ''
  const confirmation = typeof parsed.body.confirmation === 'string' ? parsed.body.confirmation.trim() : ''
  const { data: item } = await access.service.from('shop_items').select('id, name, image_url').eq('id', itemId).single()
  if (!item) return c.json({ error: 'Artículo no encontrado.' }, 404)
  if (confirmation !== item.name) return c.json({ error: 'Escribe el nombre exacto del artículo para confirmar.' }, 400)
  if (reason.length < 10 || reason.length > 1000) return c.json({ error: 'Explica el motivo de emergencia (10 a 1000 caracteres).' }, 400)
  const { data: assets } = await access.service.from('shop_item_assets').select('id, object_key').eq('item_id', itemId).neq('status', 'deleted')
  const { data: result, error } = await access.service.rpc('internal_revoke_shop_item', { p_item_id: itemId, p_actor_id: access.user.id, p_reason: reason })
  if (error) return c.json({ error: 'No se pudo completar la revocación de emergencia.' }, 500)
  let cleanupPending = false
  try {
    if (assets?.length) await removeR2Assets(c.env.PROFILE_FRAMES, assets)
    else await removeLegacySupabaseAsset(access.service, item.image_url)
    if (assets?.length) await access.service.from('shop_item_assets').update({ is_current: false, status: 'deleted', deleted_at: new Date().toISOString() }).in('id', assets.map(row => row.id))
  } catch (cleanupError: any) {
    cleanupPending = true
    if (assets?.length) await access.service.from('shop_item_assets').update({ is_current: false, status: 'cleanup_failed' }).in('id', assets.map(row => row.id))
    await logAdminAction(access.service, access.user.id, 'CLEANUP_REQUIRED', 'shop_item_asset', itemId, item, { error: cleanupError?.message })
  }
  return c.json({ success: true, result, cleanupPending })
})

admin.post('/catalog/migrate-assets', async (c) => {
  const access = await requireAdmin(c)
  if (!access.allowed) return access.response
  const { data: items, error } = await access.service.from('shop_items').select('id, image_url').not('image_url', 'is', null)
  if (error) return c.json({ error: 'No se pudo leer el catálogo.' }, 500)
  const { data: registered } = await access.service.from('shop_item_assets').select('item_id').eq('is_current', true).eq('status', 'active')
  const registeredIds = new Set((registered ?? []).map(row => row.item_id))
  const results: Array<Record<string, unknown>> = []
  for (const item of items ?? []) {
    if (registeredIds.has(item.id) || !item.image_url || item.image_url.includes('/storage/secure-url?')) continue
    try {
      const response = await fetch(item.image_url)
      const mimeType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase()
      const bytes = await response.arrayBuffer()
      if (!response.ok || !IMAGE_TYPES.has(mimeType) || !bytes.byteLength || bytes.byteLength > 16 * 1024 * 1024) throw new Error('Invalid legacy image')
      const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1]
      const objectKey = `items/${item.id}/v1/original.${extension}`
      await c.env.PROFILE_FRAMES.put(objectKey, bytes, { httpMetadata: { contentType: mimeType, cacheControl: 'public, max-age=31536000, immutable' }, customMetadata: { migratedBy: access.user.id, source: 'supabase-storage' } })
      const digest = await crypto.subtle.digest('SHA-256', bytes)
      const checksum = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
      const imageUrl = publicR2Url(c, 'profile-frames', objectKey)
      const assetInsert = await access.service.from('shop_item_assets').insert({ item_id: item.id, object_key: objectKey, version: 1, mime_type: mimeType, size_bytes: bytes.byteLength, checksum_sha256: checksum, created_by: access.user.id })
      if (assetInsert.error) throw new Error(assetInsert.error.message)
      const itemUpdate = await access.service.from('shop_items').update({ image_url: imageUrl, updated_by: access.user.id }).eq('id', item.id)
      if (itemUpdate.error) throw new Error(itemUpdate.error.message)
      await logAdminAction(access.service, access.user.id, 'MIGRATE', 'shop_item_asset', item.id, { image_url: item.image_url }, { image_url: imageUrl, object_key: objectKey })
      try {
        await removeLegacySupabaseAsset(access.service, item.image_url)
        results.push({ id: item.id, status: 'migrated' })
      } catch (cleanupError: any) {
        await logAdminAction(access.service, access.user.id, 'CLEANUP_REQUIRED', 'shop_item_asset', item.id, { image_url: item.image_url }, { object_key: objectKey, error: cleanupError?.message })
        results.push({ id: item.id, status: 'cleanup_pending', error: cleanupError?.message || 'Legacy cleanup pending' })
      }
    } catch (migrationError: any) {
      results.push({ id: item.id, status: 'failed', error: migrationError?.message || 'Unknown error' })
    }
  }
  return c.json({
    results,
    migrated: results.filter(row => row.status === 'migrated').length,
    cleanupPending: results.filter(row => row.status === 'cleanup_pending').length,
    failed: results.filter(row => row.status === 'failed').length,
  })
})

export default admin
