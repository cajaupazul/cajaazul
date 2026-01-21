-- 1. Asegurar estructura
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS google_full_name TEXT;

-- 2. Función de Sincronización REFINADA
-- Esta versión deja el "nombre" como NULL inicialmente 
-- para obligar a pasar por el panel de personalización.
CREATE OR REPLACE FUNCTION public.handle_new_user_google()
RETURNS TRIGGER AS $$
DECLARE
    official_name TEXT;
BEGIN
    official_name := UPPER(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

    INSERT INTO public.profiles (
        id, 
        email, 
        google_full_name, 
        nombre, -- Dejamos nombre como NULL inicialmente
        puntos, 
        role
    )
    VALUES (
        NEW.id, 
        NEW.email, 
        official_name, 
        NULL, -- <--- FORZAMOS NULL PARA EL APODO
        0, 
        'user'
    )
    ON CONFLICT (id) DO UPDATE SET
        google_full_name = official_name,
        email = EXCLUDED.email;
        -- NO tocamos "nombre" en el UPDATE para que si el usuario ya eligió un apodo, no se borre.

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Asegurar trigger
DROP TRIGGER IF EXISTS on_auth_user_created_google ON auth.users;
CREATE TRIGGER on_auth_user_created_google
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_google();
