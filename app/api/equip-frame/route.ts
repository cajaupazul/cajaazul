export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * API Route: Equipar Marco de Perfil
 * 
 * Este endpoint permite a los usuarios equipar/desequipar marcos que poseen.
 * Solo se puede equipar un marco a la vez.
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

        // 3. Verificar que el usuario posee el artículo
        const { data: inventoryItem, error: inventoryError } = await supabase
            .from('user_inventory')
            .select('*, shop_items(*)')
            .eq('user_id', user.id)
            .eq('item_id', item_id)
            .single();

        if (inventoryError || !inventoryItem) {
            return NextResponse.json(
                { error: 'No posees este artículo' },
                { status: 403 }
            );
        }

        // 4. Obtener el frame_key del artículo
        const frameKey = inventoryItem.shop_items?.frame_key;

        if (!frameKey) {
            return NextResponse.json(
                { error: 'Artículo no tiene frame_key válido' },
                { status: 400 }
            );
        }

        // 5. Desequipar todos los marcos del usuario
        const { error: unequipError } = await supabase
            .from('user_inventory')
            .update({ is_equipped: false })
            .eq('user_id', user.id);

        if (unequipError) {
            return NextResponse.json(
                { error: 'Error al desequipar marcos anteriores' },
                { status: 500 }
            );
        }

        // 6. Equipar el marco seleccionado
        const { error: equipError } = await supabase
            .from('user_inventory')
            .update({ is_equipped: true })
            .eq('user_id', user.id)
            .eq('item_id', item_id);

        if (equipError) {
            return NextResponse.json(
                { error: 'Error al equipar el marco' },
                { status: 500 }
            );
        }

        // 7. Actualizar el active_frame_key en el perfil
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ active_frame_key: frameKey })
            .eq('id', user.id);

        if (profileError) {
            return NextResponse.json(
                { error: 'Error al actualizar perfil' },
                { status: 500 }
            );
        }

        // 8. Respuesta exitosa
        return NextResponse.json({
            success: true,
            message: '¡Marco equipado con éxito!',
            frame_key: frameKey,
            item_name: inventoryItem.shop_items?.name
        });

    } catch (error) {
        console.error('Error en equip-frame:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

/**
 * API Route: Desequipar Marco Actual
 * 
 * Permite al usuario quitar el marco equipado actualmente.
 */
export async function DELETE(request: NextRequest) {
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

        // 2. Desequipar todos los marcos
        const { error: unequipError } = await supabase
            .from('user_inventory')
            .update({ is_equipped: false })
            .eq('user_id', user.id);

        if (unequipError) {
            return NextResponse.json(
                { error: 'Error al desequipar marcos' },
                { status: 500 }
            );
        }

        // 3. Limpiar active_frame_key del perfil
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ active_frame_key: null })
            .eq('id', user.id);

        if (profileError) {
            return NextResponse.json(
                { error: 'Error al actualizar perfil' },
                { status: 500 }
            );
        }

        // 4. Respuesta exitosa
        return NextResponse.json({
            success: true,
            message: 'Marco desequipado con éxito'
        });

    } catch (error) {
        console.error('Error en unequip-frame:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
