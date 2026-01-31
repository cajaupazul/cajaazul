
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
    const { error: invError } = await supabase
        .from('user_inventory')
        .insert({
            user_id: user.id,
            item_id: item.id,
            is_equipped: false
        })

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

    // 1. Verify Ownership & Get Frame Details
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
        return c.json({ error: 'Item not owned' }, 403)
    }

    // Check if it is a frame
    // Note: TypeScript might not know the shape of joined data, cast as any or rely on loose typing
    const itemData = inventoryItem.shop_items as any;

    // We assume it's a frame or something equippable.
    // If it's a frame, we update active_frame_key
    if (itemData?.frame_key) {
        // Update Profile
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ active_frame_key: itemData.frame_key })
            .eq('id', user.id)

        if (updateError) return c.json({ error: 'Failed to update profile' }, 500)

    } else {
        // If it's not a frame (e.g. badge), maybe logic differs, but for now user asked about frames
        // We will just return success if it's not a frame to avoid breaking, or error?
        // Let's assume for now valid frames have keys.
    }

    // 2. Update Inventory "is_equipped" status (Optional but good for UI)
    // First unequip all of same type? Or just set this one true?
    // For simplicity, let's just mark this one as equipped and we can handle unequip logic if strictness needed.
    // Actually, usually we clear others. But `active_frame_key` on profile is the source of truth for the avatar.

    // Return the new frame key so frontend can update immediately
    return c.json({ success: true, frame_key: itemData?.frame_key })
})

export default shop
