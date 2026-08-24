begin;

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.profiles.onboarding_completed_at is
  'Timestamp set only when the user has chosen a display name and faculty.';

update public.profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, updated_at, now())
where nullif(btrim(nombre), '') is not null
  and nullif(btrim(carrera), '') is not null
  and lower(btrim(carrera)) not in ('estudiante', 'general', 'carrera');

create or replace function private.sync_profile_onboarding_state()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if nullif(btrim(new.nombre), '') is not null
     and nullif(btrim(new.carrera), '') is not null
     and lower(btrim(new.carrera)) not in ('estudiante', 'general', 'carrera') then
    new.onboarding_completed_at := coalesce(new.onboarding_completed_at, now());
  else
    new.onboarding_completed_at := null;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_profile_onboarding_state() from public, anon, authenticated;
grant execute on function private.sync_profile_onboarding_state() to postgres, service_role, supabase_auth_admin;

drop trigger if exists sync_profile_onboarding_state on public.profiles;
create trigger sync_profile_onboarding_state
before insert or update of nombre, carrera on public.profiles
for each row execute function private.sync_profile_onboarding_state();

-- An external-email exception belongs to one account lifecycle. If that account
-- is deleted, remove the exception so the address must be approved again before
-- it can create a new account.
create or replace function private.remove_deleted_user_allowlist_entry()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, auth, public, private
as $$
begin
  delete from public.auth_email_allowlist
  where claimed_by = old.id
     or (old.email is not null and email = lower(btrim(old.email)));

  return old;
end;
$$;

revoke all on function private.remove_deleted_user_allowlist_entry() from public, anon, authenticated;
grant execute on function private.remove_deleted_user_allowlist_entry() to postgres, service_role, supabase_auth_admin;

drop trigger if exists remove_deleted_user_allowlist_entry on auth.users;
create trigger remove_deleted_user_allowlist_entry
before delete on auth.users
for each row execute function private.remove_deleted_user_allowlist_entry();

commit;
