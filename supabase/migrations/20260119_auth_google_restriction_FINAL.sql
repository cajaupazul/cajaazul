-- 1. Función de Sincronización MEJORADA (Detección de llaves flexible)
CREATE OR REPLACE FUNCTION public.handle_new_user_google()
RETURNS TRIGGER AS $$
DECLARE
    is_google BOOLEAN;
    g_name TEXT;
    g_last TEXT;
BEGIN
    is_google := (NEW.raw_app_meta_data->>'provider') = 'google';
    
    IF is_google THEN
        -- Intentar obtener nombre de varias llaves posibles
        g_name := COALESCE(
            NEW.raw_user_meta_data->>'given_name', 
            NEW.raw_user_meta_data->>'first_name',
            split_part(NEW.raw_user_meta_data->>'full_name', ' ', 1),
            ''
        );
        
        -- Intentar obtener apellido
        g_last := COALESCE(
            NEW.raw_user_meta_data->>'family_name', 
            NEW.raw_user_meta_data->>'last_name',
            replace(NEW.raw_user_meta_data->>'full_name', split_part(NEW.raw_user_meta_data->>'full_name', ' ', 1) || ' ', ''),
            ''
        );

        INSERT INTO public.profiles (id, email, google_name, google_last_name, nombre, puntos, role)
        VALUES (
            NEW.id, 
            NEW.email, 
            g_name, 
            g_last, 
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 
            0, 
            'user'
        )
        ON CONFLICT (id) DO UPDATE SET
            google_name = EXCLUDED.google_name,
            google_last_name = EXCLUDED.google_last_name,
            email = EXCLUDED.email;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Asegurar el trigger
DROP TRIGGER IF EXISTS on_auth_user_created_google on auth.users;
CREATE TRIGGER on_auth_user_created_google
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_google();

-- 3. SCRIPT DE REPARACIÓN AGRESIVO (Ejecutar para limpiar los "EMPTY")
DO $$
DECLARE
    u RECORD;
    temp_name TEXT;
    temp_last TEXT;
BEGIN
    FOR u IN SELECT id, raw_user_meta_data FROM auth.users WHERE raw_app_meta_data->>'provider' = 'google' LOOP
        
        temp_name := COALESCE(
            u.raw_user_meta_data->>'given_name', 
            u.raw_user_meta_data->>'first_name',
            split_part(u.raw_user_meta_data->>'full_name', ' ', 1)
        );
        
        temp_last := COALESCE(
            u.raw_user_meta_data->>'family_name', 
            u.raw_user_meta_data->>'last_name',
            replace(u.raw_user_meta_data->>'full_name', split_part(u.raw_user_meta_data->>'full_name', ' ', 1) || ' ', '')
        );

        UPDATE public.profiles
        SET 
            google_name = temp_name,
            google_last_name = temp_last,
            nombre = CASE 
                WHEN nombre IS NULL OR nombre = '' OR nombre LIKE '%@%' THEN COALESCE(u.raw_user_meta_data->>'full_name', nombre)
                ELSE nombre 
            END
        WHERE id = u.id;
    END LOOP;
END;
$$;
