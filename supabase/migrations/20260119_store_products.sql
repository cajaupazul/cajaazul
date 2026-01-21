-- Create table for store products
CREATE TABLE IF NOT EXISTS public.store_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('vip', 'coins')),
    price NUMERIC(10, 2) NOT NULL,
    amount INTEGER NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Everyone can see active products
CREATE POLICY "Anyone can view active products" 
ON public.store_products FOR SELECT 
TO authenticated 
USING (active = true);

-- 2. Admins can do everything
CREATE POLICY "Admins have full access to products" 
ON public.store_products FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin')
    )
) 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin')
    )
);

-- Insert initial data
INSERT INTO public.store_products (name, type, price, amount) VALUES
('VIP Mensual', 'vip', 20.00, 30),
('Paquete 100 Monedas', 'coins', 10.00, 100),
('Paquete 500 Monedas', 'coins', 45.00, 500),
('Paquete 1000 Monedas', 'coins', 80.00, 1000)
ON CONFLICT DO NOTHING;
