import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware } from './auth'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

const admin = new Hono<{ Bindings: Bindings }>()

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

admin.delete('/catalog/items/:id', async (c) => {
  const access = await requireAdmin(c)
  if (!access.allowed) return access.response

  const itemId = c.req.param('id')
  const { service, user } = access

  const { data: item, error: itemError } = await service
    .from('shop_items')
    .select('id, name, frame_key')
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
