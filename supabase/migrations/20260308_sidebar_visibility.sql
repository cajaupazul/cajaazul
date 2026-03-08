-- Sidebar Visibility Table
CREATE TABLE IF NOT EXISTS public.sidebar_visibility (
    section_key TEXT PRIMARY KEY,
    is_hidden BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sidebar_visibility ENABLE ROW LEVEL SECURITY;

-- Reading policy
CREATE POLICY "Allow read for everyone" ON public.sidebar_visibility
    FOR SELECT TO authenticated USING (true);

-- Admin policy
CREATE POLICY "Allow management for admins" ON public.sidebar_visibility
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.role = 'admin' OR profiles.role = 'superadmin')
    ));

-- Initial Data
INSERT INTO public.sidebar_visibility (section_key, is_hidden) VALUES
('Inicio', false),
('Cursos', false),
('Profesores', false),
('Herramientas', false),
('Tienda', false),
('Inventario', false),
('Eventos', false),
('Grupos', false),
('Nosotros', false)
ON CONFLICT (section_key) DO NOTHING;
