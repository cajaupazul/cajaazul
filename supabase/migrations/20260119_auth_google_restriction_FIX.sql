-- 1. Asegurar que las columnas existen con el tipo correcto
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS google_name TEXT,
ADD COLUMN IF NOT EXISTS google_last_name TEXT;

-- 2. Función de validación de dominio (Mantenemos la restricción)
CREATE OR REPLACE FUNCTION public.validate_institutional_email()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.raw_app_meta_data->>'provider') = 'google' THEN
        IF NOT (NEW.email LIKE '%@alum.up.edu.pe') THEN
            RAISE EXCEPTION 'Solo se permiten correos @alum.up.edu.pe para Google Auth.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_validate_institutional_email ON auth.users;
CREATE TRIGGER tr_validate_institutional_email
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.validate_institutional_email();

-- 3. Función de Sincronización DEFINITIVA
-- Esta función maneja la creación de perfiles y la sincronización de nombres de Google
CREATE OR REPLACE FUNCTION public.handle_new_user_google()
RETURNS TRIGGER AS $$
DECLARE
    is_google BOOLEAN;
    f_name TEXT;
    l_name TEXT;
    full_n TEXT;
BEGIN
    is_google := (NEW.raw_app_meta_data->>'provider') = 'google';
    
    IF is_google THEN
        -- Extraemos del JSON con COALESCE por si acaso las llaves varían
        f_name := COALESCE(NEW.raw_user_meta_data->>'given_name', '');
        l_name := COALESCE(NEW.raw_user_meta_data->>'family_name', '');
        full_n := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);

        -- UPSERT: Si no existe lo crea, si existe actualiza los campos de Google
        INSERT INTO public.profiles (id, email, google_name, google_last_name, nombre, puntos, role)
        VALUES (
            NEW.id, 
            NEW.email, 
            f_name, 
            l_name, 
            full_n, 
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

-- 4. Re-activar el trigger para INSERT y UPDATE (Para asegurar que se sincronice al entrar)
DROP TRIGGER IF EXISTS on_auth_user_created_google ON auth.users;
CREATE TRIGGER on_auth_user_created_google
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_google();

-- 5. SCRIPT DE REPARACIÓN AGRESIVO
-- Ejecuta esto para llenar los campos NULL de los usuarios que ya están en el sistema
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN 
        SELECT id, raw_user_meta_data 
        FROM auth.users 
        WHERE raw_app_meta_data->>'provider' = 'google' 
    LOOP
        UPDATE public.profiles
        SET 
            google_name = COALESCE(user_record.raw_user_meta_data->>'given_name', ''),
            google_last_name = COALESCE(user_record.raw_user_meta_data->>'family_name', ''),
            -- Solo actualizamos nombre si es nulo o parece un email, para no pisar el "apodo"
            nombre = CASE 
                WHEN nombre IS NULL OR nombre LIKE '%@%' THEN COALESCE(user_record.raw_user_meta_data->>'full_name', nombre)
                ELSE nombre 
            END
        WHERE id = user_record.id;
    END LOOP;
END;
$$;
