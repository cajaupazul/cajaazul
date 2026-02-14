-- 1. Create 'r2-images' bucket for event images
INSERT INTO storage.buckets (id, name, public)
VALUES ('r2-images', 'r2-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies for 'r2-images'

-- Public Read Access
DROP POLICY IF EXISTS "Public Read r2-images" ON storage.objects;
CREATE POLICY "Public Read r2-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'r2-images');

-- Upload Access (Authenticated Users)
DROP POLICY IF EXISTS "Auth Upload r2-images" ON storage.objects;
CREATE POLICY "Auth Upload r2-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'r2-images');

-- Update Access (Admins or Owners - simplified to Auth for now to unblock)
DROP POLICY IF EXISTS "Auth Update r2-images" ON storage.objects;
CREATE POLICY "Auth Update r2-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'r2-images');

-- 3. Ensure 'events' table is publicly viewable
-- (Re-applying this policy to ensure no regression)
DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;
CREATE POLICY "Events are viewable by everyone"
ON public.events FOR SELECT
TO public
USING (true);

-- 4. Ensure Admins can UPDATE events (Fix for changes not saving/visible)
-- The previous "Admins can manage all events" might have been shadowed or insufficient
-- We explicitely allow UPDATE for admins
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
CREATE POLICY "Admins can update events"
ON public.events FOR UPDATE
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
