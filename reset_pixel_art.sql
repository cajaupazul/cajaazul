-- 1. Eliminar el historial individual grabado hasta ahora
DELETE FROM public.pixel_history WHERE event_id = 'pixel-art-2025';

-- 2. Reiniciar el estado del tablero (el mural completo) a blanco puro
-- Esto asegura que la columna 'pixels' no sea NULL y tenga el tamaño correcto (1,000,000 bytes)
UPDATE public.pixel_board_state
SET pixels = decode(repeat('00', 1000000), 'hex'),
    width = 1000,
    height = 1000
WHERE event_id = 'pixel-art-2025';

-- 3. Si por alguna razón la fila no existe, la creamos correctamente
INSERT INTO public.pixel_board_state (event_id, pixels, width, height)
SELECT 'pixel-art-2025', decode(repeat('00', 1000000), 'hex'), 1000, 1000
WHERE NOT EXISTS (SELECT 1 FROM public.pixel_board_state WHERE event_id = 'pixel-art-2025');
