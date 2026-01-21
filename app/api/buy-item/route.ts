export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * API Route: Comprar Artículo de la Tienda
 * 
 * Este endpoint permite a los usuarios comprar artículos usando monedas.
 * Toda la validación y transacción se realiza en el backend para máxima seguridad.
 * 
 * Compatible con Cloudflare Pages Edge Runtime.
 */

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // 1. Verificar autenticación
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'No autenticado' },
                { status: 401 }
            );
        }

        // 2. Obtener datos de la solicitud
        const body = await request.json();
        const { item_id } = body;

        if (!item_id) {
            return NextResponse.json(
                { error: 'item_id es requerido' },
                { status: 400 }
            );
        }

        // 3. Obtener información del artículo
        const { data: item, error: itemError } = await supabase
            .from('shop_items')
            .select('*')
            .eq('id', item_id)
            .eq('is_active', true)
            .single();

        if (itemError || !item) {
            return NextResponse.json(
                { error: 'Artículo no encontrado o no disponible' },
                { status: 404 }
            );
        }

        // 4. Verificar si el usuario ya posee el artículo
        const { data: existingItem } = await supabase
            .from('user_inventory')
            .select('id')
            .eq('user_id', user.id)
            .eq('item_id', item_id)
            .single();

        if (existingItem) {
            return NextResponse.json(
                { error: 'Ya posees este artículo' },
                { status: 400 }
            );
        }

        // 5. Obtener el perfil del usuario
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('monedas')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            return NextResponse.json(
                { error: 'Perfil no encontrado' },
                { status: 404 }
            );
        }

        // 6. Verificar saldo suficiente
        if (profile.monedas < item.price_coins) {
            return NextResponse.json(
                {
                    error: 'Monedas insuficientes',
                    required: item.price_coins,
                    current: profile.monedas,
                    missing: item.price_coins - profile.monedas
                },
                { status: 400 }
            );
        }

        // 7. TRANSACCIÓN: Descontar monedas y agregar al inventario
        // Nota: Supabase no soporta transacciones explícitas en el cliente,
        // pero podemos usar RPC para hacer esto atómico

        // Descontar monedas
        const newBalance = profile.monedas - item.price_coins;
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ monedas: newBalance })
            .eq('id', user.id);

        if (updateError) {
            return NextResponse.json(
                { error: 'Error al procesar el pago' },
                { status: 500 }
            );
        }

        // Agregar al inventario
        const { error: inventoryError } = await supabase
            .from('user_inventory')
            .insert({
                user_id: user.id,
                item_id: item_id,
                is_equipped: false
            });

        if (inventoryError) {
            // Revertir el descuento de monedas si falla la inserción
            await supabase
                .from('profiles')
                .update({ monedas: profile.monedas })
                .eq('id', user.id);

            return NextResponse.json(
                { error: 'Error al agregar artículo al inventario' },
                { status: 500 }
            );
        }

        // 8. Respuesta exitosa
        return NextResponse.json({
            success: true,
            message: '¡Artículo comprado con éxito!',
            item: {
                id: item.id,
                name: item.name,
                type: item.type
            },
            new_balance: newBalance
        });

    } catch (error) {
        console.error('Error en buy-item:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
