-- PERMITIR REGISTROS ANÓNIMOS (GUESTS)
-- Actualiza las funciones de trigger para manejar usuarios sin correo electrónico.

-- 1. Actualizar validación de dominio (Omitir para anónimos)
CREATE OR REPLACE FUNCTION public.check_institutional_domain()
RETURNS TRIGGER AS $$
BEGIN
    -- Permitir usuarios anónimos (email es NULL)
    IF NEW.email IS NULL THEN
        RETURN NEW;
    END IF;

    -- Solo validar dominio si hay un correo presente
    IF NEW.email NOT ILIKE '%@alum.up.edu.pe' THEN
        RAISE EXCEPTION 'Acceso restringido: Solo se permiten correos institucionales @alum.up.edu.pe. Por favor usa tu cuenta de la universidad.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Actualizar manejador de perfiles (Nombre por defecto 'Invitado')
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    meta_name TEXT;
    meta_avatar TEXT;
BEGIN
    -- Determinar el nombre (para invitados será "Invitado")
    meta_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'nombre',
        CASE 
            WHEN NEW.email IS NOT NULL THEN split_part(NEW.email, '@', 1) 
            ELSE 'Invitado' 
        END
    );

    meta_avatar := COALESCE(
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'picture',
        NULL
    );

    -- Insertar o actualizar el perfil
    INSERT INTO public.profiles (id, email, nombre, avatar_url, puntos, role)
    VALUES (
        NEW.id,
        NEW.email,
        meta_name,
        meta_avatar,
        0,
        'user'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        nombre = COALESCE(public.profiles.nombre, EXCLUDED.nombre),
        avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
        last_seen = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
