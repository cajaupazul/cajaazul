-- =========================================
-- CONFIGURACIÓN DE STORAGE PARA MARCOS
-- =========================================

-- 1. Crear bucket público para frames
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-frames', 'profile-frames', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de storage para el bucket
-- Permitir lectura pública
DROP POLICY IF EXISTS "Public read access for frames" ON storage.objects;
CREATE POLICY "Public read access for frames"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-frames');

-- Permitir subida solo a usuarios autenticados (opcional, para admin)
DROP POLICY IF EXISTS "Authenticated users can upload frames" ON storage.objects;
CREATE POLICY "Authenticated users can upload frames"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-frames');

-- Permitir actualización solo a usuarios autenticados (opcional, para admin)
DROP POLICY IF EXISTS "Authenticated users can update frames" ON storage.objects;
CREATE POLICY "Authenticated users can update frames"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-frames');

-- Permitir eliminación solo a usuarios autenticados (opcional, para admin)
DROP POLICY IF EXISTS "Authenticated users can delete frames" ON storage.objects;
CREATE POLICY "Authenticated users can delete frames"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-frames');

-- =========================================
-- ESTRUCTURA DE CARPETAS RECOMENDADA
-- =========================================
-- En el bucket 'profile-frames', organiza así:
--
-- profile-frames/
--   ├── golden.png          (Marco dorado estático)
--   ├── rainbow.gif         (Marco arcoíris animado)
--   ├── diamond.png         (Marco diamante estático)
--   ├── fire.gif            (Marco fuego animado)
--   └── neon.gif            (Marco neón animado)
--
-- Las URLs quedarán así:
-- https://[tu-proyecto].supabase.co/storage/v1/object/public/profile-frames/golden.png

-- =========================================
-- ACTUALIZAR DATOS DE EJEMPLO CON URLs REALES
-- =========================================
-- Después de subir las imágenes, actualiza los items:

-- EJEMPLO (reemplaza con tus URLs reales del storage):
/*
UPDATE shop_items 
SET image_url = 'https://[tu-proyecto].supabase.co/storage/v1/object/public/profile-frames/golden.png'
WHERE frame_key = 'frame-golden';

UPDATE shop_items 
SET image_url = 'https://[tu-proyecto].supabase.co/storage/v1/object/public/profile-frames/rainbow.gif'
WHERE frame_key = 'frame-rainbow';

UPDATE shop_items 
SET image_url = 'https://[tu-proyecto].supabase.co/storage/v1/object/public/profile-frames/diamond.png'
WHERE frame_key = 'frame-diamond';

UPDATE shop_items 
SET image_url = 'https://[tu-proyecto].supabase.co/storage/v1/object/public/profile-frames/fire.gif'
WHERE frame_key = 'frame-fire';

UPDATE shop_items 
SET image_url = 'https://[tu-proyecto].supabase.co/storage/v1/object/public/profile-frames/neon.gif'
WHERE frame_key = 'frame-neon';
*/
