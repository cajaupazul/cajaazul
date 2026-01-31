
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

export default shop
