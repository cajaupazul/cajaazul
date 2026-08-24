begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.auth_email_allowlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  enabled boolean not null default true,
  reason text,
  expires_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auth_email_allowlist_email_normalized_check
    check (
      email = lower(btrim(email))
      and char_length(email) between 3 and 254
      and email ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'
    ),
  constraint auth_email_allowlist_reason_length_check
    check (reason is null or char_length(reason) <= 240)
);

create unique index if not exists auth_email_allowlist_email_key
  on public.auth_email_allowlist (email);
create index if not exists auth_email_allowlist_active_idx
  on public.auth_email_allowlist (enabled, expires_at);

alter table public.auth_email_allowlist enable row level security;
revoke all on table public.auth_email_allowlist from public, anon, authenticated;
grant all on table public.auth_email_allowlist to service_role;

comment on table public.auth_email_allowlist is
  'Exact external Google emails approved by an administrator. Never exposed to browser roles.';

create or replace function private.is_campuslink_email_authorized(target_email text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select case
    when target_email is null then true
    when right(lower(btrim(target_email)), length('@alum.up.edu.pe')) = '@alum.up.edu.pe' then true
    else exists (
      select 1
      from public.auth_email_allowlist allowlist
      where allowlist.email = lower(btrim(target_email))
        and allowlist.enabled
        and (allowlist.expires_at is null or allowlist.expires_at > now())
    )
  end;
$$;

revoke all on function private.is_campuslink_email_authorized(text) from public, anon, authenticated;
grant execute on function private.is_campuslink_email_authorized(text) to postgres, service_role, supabase_auth_admin;

create or replace function public.check_institutional_domain()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_campuslink_email_authorized(new.email) then
    raise exception using
      errcode = 'P0001',
      message = 'Acceso restringido: utiliza tu correo @alum.up.edu.pe o solicita autorización previa.';
  end if;
  return new;
end;
$$;

revoke all on function public.check_institutional_domain() from public, anon, authenticated;
grant execute on function public.check_institutional_domain() to postgres, service_role, supabase_auth_admin;

drop trigger if exists ensure_email_domain_update on auth.users;
drop function if exists public.check_email_update();

drop trigger if exists ensure_institutional_domain_before on auth.users;
create trigger ensure_institutional_domain_before
before insert on auth.users
for each row execute function public.check_institutional_domain();

drop trigger if exists ensure_institutional_domain_update on auth.users;
create trigger ensure_institutional_domain_update
before update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function public.check_institutional_domain();

-- Keep a single idempotent profile creation trigger.
drop trigger if exists on_auth_user_created_robust on auth.users;

create or replace function private.claim_authorized_email()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.email is not null then
    update public.auth_email_allowlist
    set claimed_by = new.id,
        claimed_at = coalesce(claimed_at, now()),
        last_used_at = now(),
        updated_at = now()
    where email = lower(btrim(new.email))
      and enabled
      and (expires_at is null or expires_at > now());
  end if;
  return new;
end;
$$;

revoke all on function private.claim_authorized_email() from public, anon, authenticated;
grant execute on function private.claim_authorized_email() to postgres, service_role, supabase_auth_admin;

drop trigger if exists claim_authorized_email_after_auth on auth.users;
create trigger claim_authorized_email_after_auth
after insert or update of email on auth.users
for each row execute function private.claim_authorized_email();

create or replace function public.revoke_external_auth_sessions(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, auth, public
as $$
begin
  delete from auth.refresh_tokens where user_id = target_user_id::text;
  delete from auth.sessions where user_id = target_user_id;
end;
$$;

revoke all on function public.revoke_external_auth_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_external_auth_sessions(uuid) to service_role;

create or replace function private.revoke_allowlist_sessions_on_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, auth, public, private
as $$
declare
  target_id uuid;
  should_revoke boolean := false;
begin
  if tg_op = 'DELETE' then
    should_revoke := true;
    target_id := old.claimed_by;
  else
    should_revoke := (
      old.enabled and not new.enabled
      or old.email is distinct from new.email
      or old.expires_at is distinct from new.expires_at
         and new.expires_at is not null
         and new.expires_at <= now()
    );
    target_id := coalesce(old.claimed_by, new.claimed_by);
  end if;

  if should_revoke then
    if target_id is null then
      select id into target_id
      from auth.users
      where lower(btrim(email)) = old.email
      limit 1;
    end if;

    if target_id is not null then
      perform public.revoke_external_auth_sessions(target_id);
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.revoke_allowlist_sessions_on_change() from public, anon, authenticated;
grant execute on function private.revoke_allowlist_sessions_on_change() to postgres, service_role;

drop trigger if exists revoke_allowlist_sessions on public.auth_email_allowlist;
create trigger revoke_allowlist_sessions
after update or delete on public.auth_email_allowlist
for each row execute function private.revoke_allowlist_sessions_on_change();

create or replace function private.touch_auth_email_allowlist()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  new.email := lower(btrim(new.email));
  new.reason := nullif(btrim(new.reason), '');
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_auth_email_allowlist() from public, anon, authenticated;
grant execute on function private.touch_auth_email_allowlist() to postgres, service_role;

drop trigger if exists touch_auth_email_allowlist on public.auth_email_allowlist;
create trigger touch_auth_email_allowlist
before insert or update on public.auth_email_allowlist
for each row execute function private.touch_auth_email_allowlist();

commit;
