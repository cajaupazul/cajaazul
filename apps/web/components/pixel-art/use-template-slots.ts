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
                // Try fetching from Supabase
                const { data, error } = await supabase
                    .from('pixel_templates')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('event_id', eventId)
                    .order('updated_at', { ascending: false })
                    .limit(3);

                if (error) {
                    // Fallback to LocalStorage if table doesn't exist yet
                    console.warn("[TEMPLATES] Supabase fetch failed, falling back to LocalStorage:", error.message);
                    const local = localStorage.getItem(`pixel-slots-${eventId}-${userId}`);
                    if (local) setSlots(JSON.parse(local));
                } else {
                    setSlots(data || []);
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

        const newSlot: TemplateSlot = {
            ...template,
            updated_at: new Date().toISOString()
        };

        // UI Logic: Filter duplicates and Slot FIFO (Max 3)
        let updatedSlots = [newSlot, ...slots.filter(s => s.image !== template.image)].slice(0, 3);
        setSlots(updatedSlots);

        // Persistent Save
        try {
            const { error } = await supabase
                .from('pixel_templates')
                .upsert({
                    user_id: userId,
                    event_id: eventId,
                    image_data: template.image,
                    opacity: template.opacity,
                    grid_step: template.gridStep,
                    world_x: template.state.x,
                    world_y: template.state.y,
                    scale: template.state.scale,
                    updated_at: newSlot.updated_at
                }, { onConflict: 'user_id,event_id,image_data' });

            if (error) {
                console.warn("[TEMPLATES] Supabase save failed, using LocalStorage fallback:", error.message);
                localStorage.setItem(`pixel-slots-${eventId}-${userId}`, JSON.stringify(updatedSlots));
            }
        } catch (err) {
            console.error("[TEMPLATES] Save Error:", err);
            localStorage.setItem(`pixel-slots-${eventId}-${userId}`, JSON.stringify(updatedSlots));
        }
    };

    const deleteSlot = async (image: string) => {
        if (!userId) return;

        setSlots(prev => prev.filter(s => s.image !== image));

        try {
            await supabase
                .from('pixel_templates')
                .delete()
                .eq('user_id', userId)
                .eq('event_id', eventId)
                .eq('image_data', image);
        } catch (err) {
            // Local fallback deletion
            const local = localStorage.getItem(`pixel-slots-${eventId}-${userId}`);
            if (local) {
                const filtered = JSON.parse(local).filter((s: any) => s.image !== image);
                localStorage.setItem(`pixel-slots-${eventId}-${userId}`, JSON.stringify(filtered));
            }
        }
    };

    return { slots, saveSlot, deleteSlot, loading };
}
