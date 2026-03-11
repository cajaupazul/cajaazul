-- Migración para el Carrusel Dinámico del Dashboard v8.0
-- 1. Crear la tabla de carrusel
CREATE TABLE IF NOT EXISTS public.dashboard_carousel (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    subtitle text,
    image_url text NOT NULL,
    icon_name text DEFAULT 'Trophy', -- Lucide icon name
    color text DEFAULT '#3B82F6', -- Hex color
    priority integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Habilitar RLS
ALTER TABLE public.dashboard_carousel ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de seguridad
-- Lectura pública para usuarios autenticados
DROP POLICY IF EXISTS "Carrusel visible para usuarios autenticados" ON public.dashboard_carousel;
CREATE POLICY "Carrusel visible para usuarios autenticados" 
ON public.dashboard_carousel FOR SELECT 
TO authenticated 
USING (true);

-- Solo administradores pueden gestionar la tabla
DROP POLICY IF EXISTS "Admins gestionan carrusel" ON public.dashboard_carousel;
CREATE POLICY "Admins gestionan carrusel" 
ON public.dashboard_carousel FOR ALL 
TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 4. Datos iniciales (para mantener la consistencia con el diseño actual)
INSERT INTO public.dashboard_carousel (title, subtitle, image_url, icon_name, color, priority)
VALUES 
('Sede Principal', 'Instalaciones modernas para tu desarrollo', '/options/option-bg-1.jpg', 'Trophy', '#ED5565', 50),
('Campus Central', 'Espacios de estudio y colaboración', '/options/option-bg-2.jpg', 'BookOpen', '#FC6E51', 40),
('Intercambio', 'Conoce estudiantes de todo el mundo', '/options/option-bg-3.jpg', 'Users', '#FFCE54', 30),
('Comité Consultivo', 'Líderes que guían nuestra visión', '/options/option-bg-4.png', 'Star', '#2ECC71', 20),
('Vida Estudiantil', 'Eventos y actividades exclusivas', '/options/option-bg-5.webp', 'Calendar', '#5D9CEC', 10)
ON CONFLICT DO NOTHING;
