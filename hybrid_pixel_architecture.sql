-- ==========================================
-- HIBRID ARCHITECTURE: PIXEL ART ROW-BASED
-- ==========================================

-- 1. LIMPIEZA TOTAL: Eliminar triggers y tablas antiguas
-- CRITICAL: Eliminamos el trigger viejo que intentaba usar la columna 'pixels'
DROP TRIGGER IF EXISTS tr_update_pixel_board ON public.pixel_history;
DROP FUNCTION IF EXISTS public.update_pixel_board_state();

-- Usamos CASCADE para limpiar la tabla de estado y sus dependencias (políticas, etc.)
DROP TABLE IF EXISTS public.pixel_board_state CASCADE;

CREATE TABLE public.pixel_board_state (
    event_id TEXT NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    color_index INTEGER NOT NULL,
    PRIMARY KEY (event_id, x, y)
);

-- 2. Habilitar RLS
ALTER TABLE public.pixel_board_state ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Acceso
DROP POLICY IF EXISTS "Allow public select state" ON public.pixel_board_state;
CREATE POLICY "Allow public select state" ON public.pixel_board_state FOR SELECT USING (true);

-- 4. Función Trigger para Sincronización Automática (UPSERT)
-- Cuando se inserta en pixel_history, actualiza pixel_board_state automáticamente.
CREATE OR REPLACE FUNCTION public.sync_pixel_board_state()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.pixel_board_state (event_id, x, y, color_index)
    VALUES (NEW.event_id, NEW.x, NEW.y, NEW.color_index)
    ON CONFLICT (event_id, x, y) 
    DO UPDATE SET color_index = EXCLUDED.color_index;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Crear el Trigger en pixel_history
DROP TRIGGER IF EXISTS tr_sync_pixel_board ON public.pixel_history;
CREATE TRIGGER tr_sync_pixel_board
AFTER INSERT ON public.pixel_history
FOR EACH ROW
EXECUTE FUNCTION public.sync_pixel_board_state();

-- 6. [OPCIONAL/RECOMENDADO] Función para Reconstrucción Masiva (Carga Inicial Rápida)
-- Esta función genera el blob BYTEA (Uint8Array en JS) directamente en SQL agregando las filas.
-- Evita enviar 1,000,000 de filas JSON al frontend.
CREATE OR REPLACE FUNCTION get_pixel_board_blob(p_event_id TEXT, p_width INTEGER, p_height INTEGER)
RETURNS BYTEA AS $$
DECLARE
    v_result BYTEA;
    r RECORD;
BEGIN
    -- Inicializar un buffer vacío (lleno de ceros/blanco) del tamaño correcto
    v_result := decode(repeat('00', p_width * p_height), 'hex');
    
    -- "Pintar" el buffer con los datos de las filas existentes
    -- Nota: Este query es intensivo pero se ejecuta solo una vez al cargar la página.
    FOR r IN (SELECT x, y, color_index FROM public.pixel_board_state WHERE event_id = p_event_id) LOOP
        v_result := set_byte(v_result, (r.y * p_width + r.x), r.color_index);
    END LOOP;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. Habilitar Realtime para la tabla de estado
-- Esto permite que los usuarios vean los cambios de otros en tiempo real de forma eficiente.
ALTER PUBLICATION supabase_realtime ADD TABLE public.pixel_board_state;

-- ==========================================
-- BUENAS PRÁCTICAS Y PERFORMANCE:
-- ==========================================
-- 1. El uso de PRIMARY KEY (event_id, x, y) ya crea un índice B-TREE óptimo.
-- 2. Al usar Realtime en pixel_board_state, el frontend recibe cambios individuales de 3 columnas.
-- 3. La función sync_pixel_board_state usa SECURITY DEFINER para evitar problemas de permisos de usuario.
-- 4. El trigger es AFTER INSERT para no retrasar el guardado del historial.
