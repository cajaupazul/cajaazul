-- Migración para el Sistema de Anuncios (Ads) v7.0
-- 1. Crear la tabla de anuncios
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    image_url text NOT NULL,
    link_url text,
    is_active boolean DEFAULT true,
    priority integer DEFAULT 0, -- Mayor número = mayor prioridad
    show_once boolean DEFAULT true, -- Si se muestra solo una vez por sesión
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Habilitar RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de seguridad
-- Lectura pública para usuarios autenticados
DROP POLICY IF EXISTS "Anuncios visibles para usuarios autenticados" ON public.announcements;
CREATE POLICY "Anuncios visibles para usuarios autenticados" 
ON public.announcements FOR SELECT 
TO authenticated 
USING (true);

-- Solo administradores pueden gestionar la tabla
DROP POLICY IF EXISTS "Admins gestionan anuncios" ON public.announcements;
CREATE POLICY "Admins gestionan anuncios" 
ON public.announcements FOR ALL 
TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 4. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_announcements_active_priority ON public.announcements(is_active, priority DESC);
