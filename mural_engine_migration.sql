-- ==========================================
-- MURAL ENGINE: DETERMINISTIC SYNC MIGRATION
-- ==========================================

-- 1. CLEANUP: Remove legacy logic
DROP TRIGGER IF EXISTS tr_sync_pixel_board ON public.pixel_history;
DROP TRIGGER IF EXISTS tr_update_pixel_board ON public.pixel_history;
DROP FUNCTION IF EXISTS public.sync_pixel_board_state() CASCADE;
DROP FUNCTION IF EXISTS public.update_pixel_board_state() CASCADE;

-- 2. TABLE REFACTOR: Row-based state with TRUE COLOR
-- We drop and recreate to ensure the PRIMARY KEY is exactly (event_id, x, y)
DROP TABLE IF EXISTS public.pixel_board_state CASCADE;

CREATE TABLE public.pixel_board_state (
    event_id TEXT NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    color_hex TEXT NOT NULL, -- The single source of truth for color
    user_id UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (event_id, x, y)
);

-- 3. RLS: Professional access control
ALTER TABLE public.pixel_board_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view the mural" 
    ON public.pixel_board_state FOR SELECT USING (true);

CREATE POLICY "Authenticated users can paint" 
    ON public.pixel_board_state FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can overwrite pixels (WPlace style)" 
    ON public.pixel_board_state FOR UPDATE 
    USING (true) -- Overwrite is part of the game logic
    WITH CHECK (auth.uid() = user_id);

-- 4. RPC: High-Performance RGBA Hydration
-- This returns a BYTEA buffer where each pixel is 4 bytes (R, G, B, A)
CREATE OR REPLACE FUNCTION get_pixel_board_blob(p_event_id TEXT, p_width INTEGER, p_height INTEGER)
RETURNS BYTEA AS $$
DECLARE
    v_result BYTEA;
    r RECORD;
    v_offset INTEGER;
    v_r INTEGER; v_g INTEGER; v_b INTEGER;
BEGIN
    -- Initialize buffer with transparency (all zeros)
    -- Size: width * height * 4 bytes
    v_result := decode(repeat('00', p_width * p_height * 8), 'hex');
    
    FOR r IN (SELECT x, y, color_hex FROM public.pixel_board_state WHERE event_id = p_event_id) LOOP
        -- Simple HEX to RGB conversion
        v_r := ('x' || lpad(substring(r.color_hex from 2 for 2), 2, '0'))::bit(8)::int;
        v_g := ('x' || lpad(substring(r.color_hex from 4 for 2), 2, '0'))::bit(8)::int;
        v_b := ('x' || lpad(substring(r.color_hex from 6 for 2), 2, '0'))::bit(8)::int;
        
        v_offset := (r.y * p_width + r.x) * 4;
        
        v_result := set_byte(v_result, v_offset, v_r);     -- R
        v_result := set_byte(v_result, v_offset + 1, v_g); -- G
        v_result := set_byte(v_result, v_offset + 2, v_b); -- B
        v_result := set_byte(v_result, v_offset + 3, 255); -- A (Opaque)
    END LOOP;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. REALTIME: Enable for the state table
ALTER PUBLICATION supabase_realtime ADD TABLE public.pixel_board_state;

-- 6. INDEX: Fast event-based queries
CREATE INDEX IF NOT EXISTS idx_mural_event ON public.pixel_board_state(event_id);
