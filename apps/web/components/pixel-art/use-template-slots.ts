'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface TemplateSlot {
    id?: string;
    image: string;
    opacity: number;
    gridStep: number;
    state: { x: number, y: number, scale: number };
    updated_at: string;
    slot_index?: number; // 1, 2, or 3
    group_code?: string;
}

export function useTemplateSlots(userId: string | undefined, eventId: string) {
    const [slots, setSlots] = useState<TemplateSlot[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch initial slots
    useEffect(() => {
        if (!userId || !eventId) return;

        async function fetchSlots() {
            setLoading(true);
            try {
                // Try fetching from Supabase, ordered by slot_index
                const { data, error } = await supabase
                    .from('pixel_templates')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('event_id', eventId)
                    .order('slot_index', { ascending: true });

                if (error) {
                    console.warn("[TEMPLATES] Supabase fetch failed, falling back to LocalStorage:", error.message);
                    const local = localStorage.getItem(`pixel-slots-${eventId}-${userId}`);
                    if (local) setSlots(JSON.parse(local));
                } else {
                    // Map DB results to match TemplateSlot interface
                    const mappedSlots: TemplateSlot[] = (data || []).map(row => ({
                        image: row.image_data,
                        opacity: row.opacity,
                        gridStep: row.grid_step,
                        state: { x: row.world_x, y: row.world_y, scale: row.scale },
                        updated_at: row.updated_at,
                        slot_index: row.slot_index,
                        group_code: row.group_code
                    }));
                    setSlots(mappedSlots);
                }
            } catch (err) {
                console.error("[TEMPLATES] Fetch Error:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchSlots();
    }, [userId, eventId]);

    const saveSlot = async (template: Omit<TemplateSlot, 'updated_at'>) => {
        if (!userId) return;

        // 1. Determine which slot_index to use (1, 2, or 3)
        // If the image already exists in a slot, we update THAT slot_index.
        // If it's new, we find the first empty slot or use FIFO.
        let targetSlotIndex = template.slot_index;

        if (!targetSlotIndex) {
            const existing = slots.find(s => s.image === template.image);
            if (existing) {
                targetSlotIndex = existing.slot_index;
            } else {
                // Find first empty index between 1-3
                const usedIndices = slots.map(s => s.slot_index).filter(Boolean) as number[];
                for (let i = 1; i <= 3; i++) {
                    if (!usedIndices.includes(i)) {
                        targetSlotIndex = i;
                        break;
                    }
                }
                // If all full, replace the oldest slot (highest updated_at would be newest, so lowest is oldest)
                if (!targetSlotIndex) {
                    const oldest = [...slots].sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())[0];
                    targetSlotIndex = oldest?.slot_index || 1;
                }
            }
        }

        const newSlot: TemplateSlot = {
            ...template,
            slot_index: targetSlotIndex,
            updated_at: new Date().toISOString()
        };

        // UI Update (Keep local state in sync)
        setSlots(prev => {
            const filtered = prev.filter(s => s.slot_index !== targetSlotIndex);
            return [...filtered, newSlot].sort((a, b) => (a.slot_index || 0) - (b.slot_index || 0));
        });

        // Persistent Save
        try {
            const { error } = await supabase
                .from('pixel_templates')
                .upsert({
                    user_id: userId,
                    event_id: eventId,
                    slot_index: targetSlotIndex, // PRIMARY KEY identifier
                    image_data: template.image,
                    opacity: template.opacity,
                    grid_step: template.gridStep,
                    world_x: template.state.x,
                    world_y: template.state.y,
                    scale: template.state.scale,
                    updated_at: newSlot.updated_at,
                    group_code: newSlot.group_code
                }, { onConflict: 'user_id,event_id,slot_index' }); // Using slot_index instead of image_data

            if (error) {
                console.error("[TEMPLATES] Supabase save failed:", error.message);
                // On error, sync localstorage for extreme resilience
                localStorage.setItem(`pixel-slots-${eventId}-${userId}`, JSON.stringify(slots));
            }
        } catch (err) {
            console.error("[TEMPLATES] Save Error:", err);
        }
    };

    const deleteSlot = async (image: string) => {
        if (!userId) return;

        const slot = slots.find(s => s.image === image);
        if (!slot) return;

        setSlots(prev => prev.filter(s => s.image !== image));

        try {
            await supabase
                .from('pixel_templates')
                .delete()
                .eq('user_id', userId)
                .eq('event_id', eventId)
                .eq('slot_index', slot.slot_index);
        } catch (err) {
            console.error("[TEMPLATES] Delete Error:", err);
        }
    };

    return { slots, saveSlot, deleteSlot, loading };
}
