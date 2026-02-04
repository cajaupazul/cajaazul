-- 1. Habilitar RLS en las tablas si no está habilitado
ALTER TABLE public.pixel_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pixel_board_state ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas antiguas para evitar conflictos
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.pixel_history;
DROP POLICY IF EXISTS "Allow public select" ON public.pixel_history;
DROP POLICY IF EXISTS "Allow public select state" ON public.pixel_board_state;

-- 3. Crear políticas para pixel_history
-- Permitir que cualquier usuario vea el historial (para recrear el tablero si fuera necesario)
CREATE POLICY "Allow public select" 
ON public.pixel_history FOR SELECT 
USING (true);

-- Permitir que usuarios autenticados inserten sus píxeles
CREATE POLICY "Allow authenticated insert" 
ON public.pixel_history FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 4. Crear políticas para pixel_board_state
-- Permitir que todos vean el estado actual del mural
CREATE POLICY "Allow public select state" 
ON public.pixel_board_state FOR SELECT 
USING (true);

-- 5. Actualizar la función del trigger para que sea SECURITY DEFINER
-- Esto es CRÍTICO: permite que la función actualice el tablero con privilegios de sistema,
-- incluso si el usuario no tiene permisos directos de UPDATE en pixel_board_state.
CREATE OR REPLACE FUNCTION public.update_pixel_board_state()
RETURNS TRIGGER 
AS $$
DECLARE
    v_width INTEGER;
    v_pixels BYTEA;
BEGIN
    -- Obtener el estado actual
    SELECT pixels, width INTO v_pixels, v_width 
    FROM public.pixel_board_state 
    WHERE event_id = NEW.event_id;
    
    -- Inicialización de emergencia si es NULL
    IF v_pixels IS NULL THEN
        v_width := 1000;
        INSERT INTO public.pixel_board_state (event_id, pixels, width, height)
        VALUES (NEW.event_id, decode(repeat('00', 1000000), 'hex'), v_width, 1000)
        ON CONFLICT (event_id) DO UPDATE SET 
            pixels = decode(repeat('00', 1000000), 'hex'),
            width = 1000,
            height = 1000
        RETURNING pixels INTO v_pixels;
    END IF;
    
    -- Actualizar el byte del píxel
    UPDATE public.pixel_board_state
    SET pixels = set_byte(pixels, (NEW.y * v_width + NEW.x), NEW.color_index)
    WHERE event_id = NEW.event_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
