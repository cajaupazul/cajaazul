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

-- 3. Crear un trigger OPTIMIZADO que no consume memoria excesiva
-- Evitamos cargar el buffer de 1MB en una variable por cada fila insertada.
CREATE OR REPLACE FUNCTION public.update_pixel_board_state()
RETURNS TRIGGER 
AS $$
BEGIN
    -- Actualizar el byte del píxel directamente en la tabla
    UPDATE public.pixel_board_state
    SET pixels = set_byte(pixels, (NEW.y * width + NEW.x), NEW.color_index)
    WHERE event_id = NEW.event_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
