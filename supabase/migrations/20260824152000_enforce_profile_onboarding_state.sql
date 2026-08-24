begin;

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
    if tg_op = 'INSERT' then
      new.onboarding_completed_at := now();
    else
      new.onboarding_completed_at := coalesce(old.onboarding_completed_at, now());
    end if;
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
before insert or update on public.profiles
for each row execute function private.sync_profile_onboarding_state();

commit;
