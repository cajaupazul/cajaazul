import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function usePixelStats(userProfileId: string | undefined, eventId: string) {
    const [pixelsPainted, setPixelsPainted] = useState(0);

    const fetchPixelsPainted = async () => {
        if (!userProfileId || !eventId) return;
        const { count, error } = await supabase
            .from('pixel_history')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userProfileId)
            .eq('event_id', eventId);

        if (error) {
            console.error('[STATS] Error fetching pixels painted:', error);
        } else {
            setPixelsPainted(count || 0);
        }
    };

    useEffect(() => {
        fetchPixelsPainted();
    }, [userProfileId, eventId]);

    const incrementLocalCount = () => setPixelsPainted(prev => prev + 1);

    return {
        pixelsPainted,
        refreshStats: fetchPixelsPainted,
        incrementLocalCount
    };
}
