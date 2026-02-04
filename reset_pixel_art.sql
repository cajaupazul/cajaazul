-- 1. Eliminar el historial individual grabado hasta ahora
DELETE FROM public.pixel_history WHERE event_id = 'pixel-art-2025';

-- 2. Reiniciar el estado del tablero (el mural completo) a blanco puro (1000x1000)
INSERT INTO public.pixel_board_state (event_id, pixels, width, height)
VALUES ('pixel-art-2025', decode(repeat('00', 1000000), 'hex'), 1000, 1000)
ON CONFLICT (event_id) DO UPDATE SET 
    pixels = EXCLUDED.pixels,
    width = EXCLUDED.width,
    height = EXCLUDED.height;

-- 3. Crear un trigger ROBUSTO que inicialice el buffer si por alguna razón falla o es NULL
CREATE OR REPLACE FUNCTION update_pixel_board_state()
RETURNS TRIGGER AS $$
DECLARE
    v_width INTEGER;
    v_pixels BYTEA;
BEGIN
    -- Intentar obtener el estado actual
    SELECT pixels, width INTO v_pixels, v_width FROM pixel_board_state WHERE event_id = NEW.event_id;
    
    -- Si el buffer es NULL o no existe, lo inicializamos de emergencia (1000x1000)
    IF v_pixels IS NULL THEN
        v_width := 1000;
        INSERT INTO pixel_board_state (event_id, pixels, width, height)
        VALUES (NEW.event_id, decode(repeat('00', 1000000), 'hex'), v_width, 1000)
        ON CONFLICT (event_id) DO UPDATE SET 
            pixels = decode(repeat('00', 1000000), 'hex'),
            width = 1000,
            height = 1000
        RETURNING pixels INTO v_pixels;
    END IF;
    
    -- Actualizar el byte correspondiente en el buffer
    UPDATE pixel_board_state
    SET pixels = set_byte(pixels, (NEW.y * v_width + NEW.x), NEW.color_index)
    WHERE event_id = NEW.event_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Re-asociar el trigger
DROP TRIGGER IF EXISTS tr_update_pixel_board ON pixel_history;
CREATE TRIGGER tr_update_pixel_board
AFTER INSERT ON pixel_history
FOR EACH ROW
EXECUTE FUNCTION update_pixel_board_state();
