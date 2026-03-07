
import { Hono } from 'hono'
import { authMiddleware } from './auth'
import { createClient } from '@supabase/supabase-js'

type Bindings = {
    SUPABASE_URL: string
    SUPABASE_SERVICE_ROLE_KEY: string
}

const shop = new Hono<{ Bindings: Bindings }>()

shop.use('*', authMiddleware)

shop.post('/buy', async (c) => {
    const user = (c as any).get('user')
    const body = await c.req.json()
    const { item_id } = body;

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY)

    // 1. Get Item
    const { data: item, error: itemError } = await supabase
        .from('shop_items')
        .select('*')
        .eq('id', item_id)
        .eq('is_active', true)
        .single()

    if (itemError || !item) {
        return c.json({ error: 'Item not found or inactive' }, 404)
    }

    // 2. Check Ownership
    const { data: existing } = await supabase
        .from('user_inventory')
        .select('id')
        .eq('user_id', user.id)
        .eq('item_id', item_id)
        .single()

    if (existing) {
        return c.json({ error: 'Already owned' }, 400)
    }

    // 3. Check Balance
    const { data: profile } = await supabase
        .from('profiles')
        .select('monedas')
        .eq('id', user.id)
        .single()

    if (!profile || profile.monedas < item.price_coins) {
        return c.json({ error: 'Insufficient coins' }, 400)
    }

    // 4. Transaction (Deduct Coins + Add Item)
    // Note: Supabase doesn't support transactions via JS client easily without RPC, 
    // so we do it optimally: Deduct first (safer), then add item. 
    // If add item fails, refund.

    const newBalance = profile.monedas - item.price_coins;

    // Deduct
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ monedas: newBalance })
        .eq('id', user.id)

    if (updateError) {
        return c.json({ error: 'Failed to update balance' }, 500)
    }

    // Add Inventory
    // If it's a bundle, grant the bundle item AND all the items inside the bundle
    const itemsToGrant = [item.id];
    if (item.bundle_items && Array.isArray(item.bundle_items)) {
        itemsToGrant.push(...item.bundle_items);
    }

    const inventoryRecords = itemsToGrant.map(id => ({
        user_id: user.id,
        item_id: id,
        is_equipped: false
    }));

    // Use upsert to ignore duplicates if the user already owns some items in the bundle
    const { error: invError } = await supabase
        .from('user_inventory')
        .upsert(inventoryRecords, { onConflict: 'user_id, item_id', ignoreDuplicates: true })

    if (invError) {
        // Rollback
        await supabase
            .from('profiles')
            .update({ monedas: profile.monedas })
            .eq('id', user.id)
        return c.json({ error: 'Failed to add item to inventory' }, 500)
    }

    return c.json({ success: true, new_balance: newBalance })
})

shop.post('/equip', async (c) => {
    const user = (c as any).get('user')
    const body = await c.req.json()
    const { item_id } = body;

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY)

    // 1. Verify Ownership or VIP Exclusive Status
    let frameKey = '';

    // Check if it's the VIP exclusive frame first
    const { data: profile } = await supabase.from('profiles').select('es_vip').eq('id', user.id).single();
    const { data: item } = await supabase.from('shop_items').select('frame_key').eq('id', item_id).single();

    if (item?.frame_key === 'vip_exclusive' && profile?.es_vip) {
        frameKey = 'vip_exclusive';
    } else {
        // Normal inventory check
        const { data: inventoryItem, error: findError } = await supabase
            .from('user_inventory')
            .select(`
                *,
                shop_items:item_id (
                    frame_key,
                    type
                )
            `)
            .eq('user_id', user.id)
            .eq('item_id', item_id)
            .single()

        if (findError || !inventoryItem) {
            return c.json({ error: 'Item not owned or not allowed' }, 403)
        }

        frameKey = (inventoryItem.shop_items as any)?.frame_key;
    }

    // 2. Update Profile
    if (frameKey) {
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ active_frame_key: frameKey })
            .eq('id', user.id)

        if (updateError) return c.json({ error: 'Failed to update profile' }, 500)

        return c.json({ success: true, frame_key: frameKey })
    }

    return c.json({ error: 'Invalid equippable item' }, 400)
})

export default shop
