-- FINAL INSTITUTIONAL AUTHENTICATION & PROFILE SYSTEM
-- Target Domain: @alum.up.edu.pe ONLY.

-- 1. Create validation function (Strict Domain Check)
CREATE OR REPLACE FUNCTION public.check_institutional_domain()
RETURNS TRIGGER AS $$
BEGIN
    -- Block any email that doesn't strictly match the institutional domain.
    IF NEW.email NOT ILIKE '%@alum.up.edu.pe' THEN
        RAISE EXCEPTION 'Acceso restringido: Solo se permiten correos institucionales @alum.up.edu.pe. Por favor usa tu cuenta de la universidad.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Apply BEFORE INSERT trigger to auth.users (Prevent unauthorized creation)
DROP TRIGGER IF EXISTS ensure_institutional_domain_before ON auth.users;
CREATE TRIGGER ensure_institutional_domain_before
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.check_institutional_domain();

-- 3. Apply BEFORE UPDATE trigger to auth.users (Block email changes)
DROP TRIGGER IF EXISTS ensure_institutional_domain_update ON auth.users;
CREATE TRIGGER ensure_institutional_domain_update
    BEFORE UPDATE OF email ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.check_institutional_domain();

-- 4. Create robust profile handler (Sync auth.users -> public.profiles)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    meta_name TEXT;
    meta_avatar TEXT;
BEGIN
    meta_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'nombre',
        split_part(NEW.email, '@', 1)
    );

    meta_avatar := COALESCE(
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'picture',
        NULL
    );

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

-- 5. Apply AFTER INSERT trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_robust ON auth.users;
CREATE TRIGGER on_auth_user_created_robust
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 6. SECURE ACCOUNT DELETION FUNCTION
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void AS $$
DECLARE
    target_user_id UUID;
BEGIN
    target_user_id := auth.uid();
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'No autenticado.';
    END IF;

    -- Profiles are deleted automatically if ON DELETE CASCADE is set.
    -- Otherwise, we delete manually.
    DELETE FROM public.profiles WHERE id = target_user_id;
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
