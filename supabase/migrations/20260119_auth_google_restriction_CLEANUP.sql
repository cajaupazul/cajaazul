-- 1. Eliminar las columnas obsoletas
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS google_name,
DROP COLUMN IF EXISTS google_last_name;

-- 2. Asegurar que la función solo use la columna consolidada (Ya hecho antes, pero para estar seguros)
CREATE OR REPLACE FUNCTION public.handle_new_user_google()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.raw_app_meta_data->>'provider') = 'google' THEN
        INSERT INTO public.profiles (id, email, google_full_name, nombre, puntos, role)
        VALUES (
            NEW.id, 
            NEW.email, 
            COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 
            0, 
            'user'
        )
        ON CONFLICT (id) DO UPDATE SET
            google_full_name = EXCLUDED.google_full_name,
            email = EXCLUDED.email;
    END IF;
    RETURN NEW;   
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
