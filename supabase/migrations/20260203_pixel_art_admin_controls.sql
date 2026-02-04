-- 1. Agregar columnas de dimensiones a la tabla de estado del tablero
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pixel_board_state' AND column_name='width') THEN
        ALTER TABLE pixel_board_state ADD COLUMN width INTEGER DEFAULT 1000;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pixel_board_state' AND column_name='height') THEN
        ALTER TABLE pixel_board_state ADD COLUMN height INTEGER DEFAULT 1000;
    END IF;
END $$;

-- 2. Asegurar que el evento actual tenga dimensiones iniciales (ajusta 'pixel-art-2025' si es necesario)
INSERT INTO pixel_board_state (event_id, pixels, width, height)
VALUES ('pixel-art-2025', decode(repeat('00', 1000000), 'hex'), 1000, 1000)
ON CONFLICT (event_id) DO UPDATE SET 
    width = EXCLUDED.width,
    height = EXCLUDED.height;

-- 3. Actualizar la función del trigger para que use el 'width' dinámico de la tabla
CREATE OR REPLACE FUNCTION update_pixel_board_state()
RETURNS TRIGGER AS $$
DECLARE
    v_width INTEGER;
BEGIN
    -- Obtener el ancho actual del tablero para el cálculo de coordenadas
    SELECT width INTO v_width FROM pixel_board_state WHERE event_id = NEW.event_id;
    
    -- Si el tablero existe, actualizar el byte correspondiente
    IF v_width IS NOT NULL THEN
        UPDATE pixel_board_state
        SET pixels = set_byte(pixels, (NEW.y * v_width + NEW.x), NEW.color_index)
        WHERE event_id = NEW.event_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Re-crear el trigger
DROP TRIGGER IF EXISTS tr_update_pixel_board ON pixel_history;
CREATE TRIGGER tr_update_pixel_board
AFTER INSERT ON pixel_history
FOR EACH ROW
EXECUTE FUNCTION update_pixel_board_state();
