-- Migration to enhance events table and initialize Pixel Art event

-- 1. Add metadata column for flexible event configurations
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Ensure RLS allows admins to manage events
DROP POLICY IF EXISTS "Admins can manage all events" ON public.events;
CREATE POLICY "Admins can manage all events"
ON public.events
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'superadmin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'superadmin')
  )
);

-- 3. Initialize the Pixel Art event in the database
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
  'pixel-art-2025',
  'Pixel Art Event 2025',
  '¡Únete al lienzo infinito! Pinta, colabora y crea arte en tiempo real con toda la universidad.',
  '2025-12-15T12:00:00Z',
  'Online - CampusLink',
  'Cultural',
  '{"is_pixel_art": true, "width": 1000, "height": 1000}'
)
ON CONFLICT (id) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  descripcion = EXCLUDED.descripcion,
  metadata = EXCLUDED.metadata;

-- 4. Ensure pixel_board_state has the row for this event if it doesn't
-- (Using the existing structure from 20260207_pixel_architecture_final)
-- Note: pixel_board_state is now 1 row per pixel in the latest architecture, 
-- but the admin control uses a summary approach. 
-- The actual pixels are filled on demand via triggers or direct inserts.
