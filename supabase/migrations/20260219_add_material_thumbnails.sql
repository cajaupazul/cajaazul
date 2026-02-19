-- Migration to support file thumbnails in materials

-- 1. Add thumbnail_url to materials table
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- 2. Create 'thumbnails' bucket in storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies for 'thumbnails'
-- Public Read Access
DROP POLICY IF EXISTS "Public Read thumbnails" ON storage.objects;
CREATE POLICY "Public Read thumbnails"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'thumbnails');

-- Upload Access (Authenticated Users/Service Role)
DROP POLICY IF EXISTS "Auth Upload thumbnails" ON storage.objects;
CREATE POLICY "Auth Upload thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'thumbnails');

-- 4. Re-ensure materials are viewable by authenticated users (safety check)
DROP POLICY IF EXISTS "Materials are viewable by everyone" ON public.materials;
CREATE POLICY "Materials are viewable by everyone"
ON public.materials FOR SELECT
TO authenticated
USING (true);
