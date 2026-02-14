-- Fix Pixel Art Event ID to be a valid UUID
-- The previous ID 'pixel-art-2025' was invalid for the UUID column types in 'events' table.
-- New ID: a0000000-0000-0000-0000-000000002025

-- 1. Insert the Pixel Art Event with the VALID UUID
INSERT INTO public.events (
  id,
  titulo,
  descripcion,
  fecha_inicio,
  lugar,
  tipo,
  metadata
)
VALUES (
  'a0000000-0000-0000-0000-000000002025',
  'Pixel Art Event 2025',
  '¡Únete al lienzo infinito! Pinta, colabora y crea arte en tiempo real con toda la universidad. Calidad "wplace".',
  '2025-12-15T12:00:00Z',
  'Online - CampusLink',
  'Cultural',
  '{"is_pixel_art": true, "width": 1000, "height": 1000}'
)
ON CONFLICT (id) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  metadata = EXCLUDED.metadata;

-- 2. Migrate any existing pixel data from the old invalid ID (if any exists)
-- pixel_board_state.event_id is TEXT, so it might contain the old string.
UPDATE public.pixel_board_state
SET event_id = 'a0000000-0000-0000-0000-000000002025'
WHERE event_id = 'pixel-art-2025';

-- 3. Cleanup: Remove any other potential references (Optional/Context specific)
-- (None expected for now)
