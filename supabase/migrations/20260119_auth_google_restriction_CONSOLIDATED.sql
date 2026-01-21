-- 1. Añadir la nueva columna consolidada
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS google_full_name TEXT;

-- 2. Función de Sincronización CONSOLIDADA
CREATE OR REPLACE FUNCTION public.handle_new_user_google()
RETURNS TRIGGER AS $$
DECLARE
    is_google BOOLEAN;
BEGIN
    is_google := (NEW.raw_app_meta_data->>'provider') = 'google';
    
    IF is_google THEN
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

-- 3. Asegurar el trigger
DROP TRIGGER IF EXISTS on_auth_user_created_google on auth.users;
CREATE TRIGGER on_auth_user_created_google
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_google();

-- 4. SCRIPT DE REPARACIÓN (Consolida los nombres actuales)
DO $$
DECLARE
    u RECORD;
BEGIN
    FOR u IN SELECT id, raw_user_meta_data FROM auth.users WHERE raw_app_meta_data->>'provider' = 'google' LOOP
        UPDATE public.profiles
        SET 
            google_full_name = COALESCE(u.raw_user_meta_data->>'full_name', ''),
            nombre = CASE 
                WHEN nombre IS NULL OR nombre = '' OR nombre LIKE '%@%' THEN COALESCE(u.raw_user_meta_data->>'full_name', nombre)
                ELSE nombre 
            END
        WHERE id = u.id;
    END LOOP;
END;
$$;

-- 5. Opcional: Si quieres borrar las columnas viejas que ya no usaremos
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS google_name;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS google_last_name;
