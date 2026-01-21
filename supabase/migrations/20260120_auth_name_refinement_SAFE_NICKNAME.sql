-- 1. Asegurar estructura
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS google_full_name TEXT;

-- 2. Función de Sincronización REFINADA V2
-- Esta versión inicializa el "nombre" con el nombre oficial
-- para evitar errores de NOT NULL, pero permite que el front-end
-- lo muestre como vacío si no ha sido personalizado.
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
        nombre, -- Inicializamos con el oficial para evitar error DB
        puntos, 
        role
    )
    VALUES (
        NEW.id, 
        NEW.email, 
        official_name, 
        official_name, -- <--- GUARDAMOS EL OFICIAL INICIALMENTE
        0, 
        'user'
    )
    ON CONFLICT (id) DO UPDATE SET
        google_full_name = official_name,
        email = EXCLUDED.email;
        -- NO tocamos "nombre" en el UPDATE para preservar la elección del usuario.

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Asegurar trigger
DROP TRIGGER IF EXISTS on_auth_user_created_google ON auth.users;
CREATE TRIGGER on_auth_user_created_google
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_google();
