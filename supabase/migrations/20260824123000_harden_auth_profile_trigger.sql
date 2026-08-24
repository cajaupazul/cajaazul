begin;

-- Only the active auth.users trigger needs this function. It must not be callable
-- through the public Data API.
alter function public.handle_new_user()
  set search_path = pg_catalog, public;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to postgres, service_role, supabase_auth_admin;

-- These legacy functions are no longer referenced by any trigger or application
-- code. Removing them avoids maintaining competing authentication rules.
drop function if exists public.handle_new_user_google();
drop function if exists public.validate_institutional_email();

commit;
