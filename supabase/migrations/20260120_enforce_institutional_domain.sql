-- RESTRICT LOGIN TO INSTITUTIONAL DOMAIN (@up.edu.pe)
-- This is a security-level enforcement at the database level.

-- 1. Create the validation function
CREATE OR REPLACE FUNCTION public.check_institutional_domain()
RETURNS TRIGGER AS $$
BEGIN
    -- RESTRICCIÓN ESPECÍFICA PARA GOOGLE OAUTH
    -- Bloqueamos el registro/login si el proveedor es Google y el dominio no es @alum.up.edu.pe
    IF (NEW.raw_app_meta_data->>'provider') = 'google' AND NEW.email NOT LIKE '%@alum.up.edu.pe' THEN
        RAISE EXCEPTION 'Acceso restringido: El dominio institucional @alum.up.edu.pe es obligatorio para ingresar con Google.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Add the trigger to auth.users (schema auth)
-- We use BEFORE INSERT to block the account creation/session entirely.
DROP TRIGGER IF EXISTS ensure_institutional_domain ON auth.users;
CREATE TRIGGER ensure_institutional_domain
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.check_institutional_domain();

-- 3. (Optional) Validation for updates
-- In case a user tries to change their email to a non-institutional one.
DROP TRIGGER IF EXISTS ensure_institutional_domain_update ON auth.users;
CREATE TRIGGER ensure_institutional_domain_update
    BEFORE UPDATE OF email ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.check_institutional_domain();
