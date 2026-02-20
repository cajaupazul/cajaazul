-- Create table for store layout configuration (mascots, assets positions)
CREATE TABLE IF NOT EXISTS public.store_layout_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_key TEXT UNIQUE NOT NULL, -- e.g., 'vip_mascot'
    x_pos INTEGER DEFAULT 0,
    y_pos INTEGER DEFAULT 0,
    scale NUMERIC(4, 2) DEFAULT 1.0,
    is_visible BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_layout_config ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Everyone can see the config
CREATE POLICY "Anyone can view layout config" 
ON public.store_layout_config FOR SELECT 
TO authenticated 
USING (true);

-- 2. Admins can manage config
CREATE POLICY "Admins can manage layout config" 
ON public.store_layout_config FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin')
    )
);

-- Insert initial config for the 'origi' mascot in VIP section
INSERT INTO public.store_layout_config (asset_key, x_pos, y_pos, scale)
VALUES ('vip_mascot_origi', -20, -20, 1.2)
ON CONFLICT (asset_key) DO NOTHING;
