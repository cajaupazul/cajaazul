-- 1. AGREGAR COLUMNA DE ROL A PROFILES
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' 
CHECK (role IN ('user', 'admin', 'superadmin'));

-- 2. FUNCIÓN PARA VERIFICAR SI UN USUARIO ES ADMIN
-- Esto simplifica las políticas RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT (role IN ('admin', 'superadmin'))
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. POLÍTICAS RLS PARA shop_items
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

-- Los usuarios normales solo pueden ver los items activos
DROP POLICY IF EXISTS "Items visibles para todos" ON public.shop_items;
CREATE POLICY "Items visibles para todos" 
ON public.shop_items FOR SELECT 
USING (is_active = true OR is_admin());

-- Solo admins pueden gestionar los items
DROP POLICY IF EXISTS "Admins gestionan items" ON public.shop_items;
CREATE POLICY "Admins gestionan items" 
ON public.shop_items FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

-- 4. POLÍTICAS PARA STORAGE (Bucket profile-frames)
-- Permitir lectura pública de las imágenes
DROP POLICY IF EXISTS "Acceso público a marcos" ON storage.objects;
CREATE POLICY "Acceso público a marcos"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-frames');

-- Solo admins pueden subir, editar o borrar
DROP POLICY IF EXISTS "Admins gestionan storage de marcos" ON storage.objects;
CREATE POLICY "Admins gestionan storage de marcos"
ON storage.objects FOR ALL
USING (bucket_id = 'profile-frames' AND is_admin())
WITH CHECK (bucket_id = 'profile-frames' AND is_admin());

-- 5. EJEMPLO: ASIGNAR ROL ADMIN A UN USUARIO ESPECÍFICO
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@example.com';
