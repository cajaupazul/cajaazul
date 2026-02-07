-- ==========================================
-- FINAL PIXEL ART ARCHITECTURE (PRODUCTION)
-- ==========================================
-- This migration restructures pixel_board_state to "1 row per pixel"
-- as requested, while maintaining performance for large canvases.

-- 1. LIMPIEZA / INITIALIZATION
-- Drop old trigger on pixel_history if it exists
DROP TRIGGER IF EXISTS tr_update_pixel_board ON public.pixel_history;
DROP TRIGGER IF EXISTS tr_sync_pixel_board ON public.pixel_history;

-- 2. REESTRUCTURAR PIXEL_BOARD_STATE
-- Recreamos la tabla para asegurar que las columnas sean las correctas
-- y el PRIMARY KEY sea (event_id, x, y)
CREATE TABLE IF NOT EXISTS public.pixel_board_state_new (
    event_id TEXT NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    color_hex TEXT NOT NULL DEFAULT '#FFFFFF',
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (event_id, x, y)
);

-- Migrar datos básicos si es posible (solo si ya existían columnas x,y,color_hex)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pixel_board_state' AND column_name='x') THEN
        INSERT INTO public.pixel_board_state_new (event_id, x, y, color_hex, user_id, updated_at)
        SELECT event_id, x, y, color_hex, user_id, updated_at FROM public.pixel_board_state
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Remplazar tabla vieja
DROP TABLE IF EXISTS public.pixel_board_state CASCADE;
ALTER TABLE public.pixel_board_state_new RENAME TO pixel_board_state;

-- 3. ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS pixel_board_state_user_idx ON public.pixel_board_state(user_id);
CREATE INDEX IF NOT EXISTS pixel_board_state_event_idx ON public.pixel_board_state(event_id);

-- 4. HISTORIAL SEPARADO
CREATE TABLE IF NOT EXISTS public.pixel_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  x int NOT NULL,
  y int NOT NULL,
  color_hex text NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 5. RPC PARA CARGA MASIVA (4-BYTE RGBA BLOB)
-- Esta función es CRITICAL para que el canvas de 1000x1000 cargue instantáneamente
-- sin saturar el ancho de banda con 1 millón de filas JSON.
CREATE OR REPLACE FUNCTION get_pixel_board_blob(p_event_id TEXT, p_width INTEGER, p_height INTEGER)
RETURNS BYTEA AS $$
DECLARE
    v_result BYTEA;
    r RECORD;
    v_r INT; v_g INT; v_b INT;
    v_pos INT;
BEGIN
    -- Inicializar buffer blanco opaco (RGBA: 255, 255, 255, 255)
    -- repeat('ffffffff', N) genera 4N bytes hexadecimales
    v_result := decode(repeat('ffffffff', p_width * p_height), 'hex');
    
    -- Pintar píxeles guardados
    FOR r IN (SELECT x, y, color_hex FROM public.pixel_board_state WHERE event_id = p_event_id) LOOP
        -- Solo procesar si está dentro de los límites solicitados
        IF r.x >= 0 AND r.x < p_width AND r.y >= 0 AND r.y < p_height THEN
            -- Extraer canales del hex (#RRGGBB)
            v_r := ('x' || substring(r.color_hex from 2 for 2))::bit(8)::int;
            v_g := ('x' || substring(r.color_hex from 4 for 2))::bit(8)::int;
            v_b := ('x' || substring(r.color_hex from 6 for 2))::bit(8)::int;
            
            v_pos := (r.y * p_width + r.x) * 4;
            v_result := set_byte(v_result, v_pos,     v_r);
            v_result := set_byte(v_result, v_pos + 1, v_g);
            v_result := set_byte(v_result, v_pos + 2, v_b);
            v_result := set_byte(v_result, v_pos + 3, 255); -- Opaco
        END IF;
    END LOOP;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 6. PERMISOS Y RLS
ALTER TABLE public.pixel_board_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pixel_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select board state" ON public.pixel_board_state;
CREATE POLICY "Select board state" ON public.pixel_board_state FOR SELECT USING (true);

DROP POLICY IF EXISTS "Insert board state" ON public.pixel_board_state;
CREATE POLICY "Insert board state" ON public.pixel_board_state FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update board state" ON public.pixel_board_state;
CREATE POLICY "Update board state" ON public.pixel_board_state FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Select history" ON public.pixel_history;
CREATE POLICY "Select history" ON public.pixel_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "Insert history" ON public.pixel_history;
CREATE POLICY "Insert history" ON public.pixel_history FOR INSERT WITH CHECK (auth.uid() = user_id);
