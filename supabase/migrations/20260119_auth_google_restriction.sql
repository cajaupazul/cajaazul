-- 1. Asegurar que las columnas existen
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS google_name TEXT,
ADD COLUMN IF NOT EXISTS google_last_name TEXT;

-- 2. Función mejorada para manejar la creación/sincronización de perfiles desde Google
CREATE OR REPLACE FUNCTION public.handle_new_user_google()
RETURNS TRIGGER AS $$
DECLARE
    full_name_meta TEXT;
    first_name_meta TEXT;
    last_name_meta TEXT;
    provider_meta TEXT;
BEGIN
    -- Extraer metadatos
    provider_meta := (NEW.raw_app_meta_data->>'provider');
    full_name_meta := (NEW.raw_user_meta_data->>'full_name');
    first_name_meta := (NEW.raw_user_meta_data->>'given_name');
    last_name_meta := (NEW.raw_user_meta_data->>'family_name');

    -- Solo actuamos si es Google
    IF provider_meta = 'google' THEN
        -- Insertar o actualizar el perfil
        INSERT INTO public.profiles (
            id, 
            email, 
            google_name, 
            google_last_name,
            nombre,
            puntos
        )
        VALUES (
            NEW.id, 
            NEW.email, 
            COALESCE(first_name_meta, ''), 
            COALESCE(last_name_meta, ''),
            COALESCE(full_name_meta, NEW.email),
            0
        )
        ON CONFLICT (id) DO UPDATE SET
            google_name = EXCLUDED.google_name,
            google_last_name = EXCLUDED.google_last_name,
            email = EXCLUDED.email;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-crear el trigger para asegurar que se ejecute CORRECTAMENTE
DROP TRIGGER IF EXISTS on_auth_user_created_google ON auth.users;
CREATE TRIGGER on_auth_user_created_google
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_google();

-- 4. SCRIPT DE REPARACIÓN: Sincronizar todos los usuarios de Google actuales que tengan campos NULL
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT id, email, raw_user_meta_data, raw_app_meta_data FROM auth.users WHERE raw_app_meta_data->>'provider' = 'google') LOOP
        UPDATE public.profiles
        SET 
            google_name = (r.raw_user_meta_data->>'given_name'),
            google_last_name = (r.raw_user_meta_data->>'family_name'),
            nombre = COALESCE(profiles.nombre, (r.raw_user_meta_data->>'full_name'))
        WHERE id = r.id;
    END LOOP;
END;
$$;
