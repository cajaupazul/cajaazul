-- Harden user profiles and make catalog administration auditable.
-- The browser may edit only user-owned presentation fields. System fields
-- (roles, balances, VIP state and entitlements) remain server-managed.

begin;

-- Passwords belong exclusively to Supabase Auth. This legacy column exposed
-- sensitive data through the Data API and must not exist in public.profiles.
update public.profiles set plain_password = null where plain_password is not null;
alter table public.profiles drop column if exists plain_password;

-- Remove overly broad legacy policies.
drop policy if exists "Anyone can insert profiles" on public.profiles;
drop policy if exists "Anyone can update profiles" on public.profiles;
drop policy if exists "Anyone can view profiles" on public.profiles;
drop policy if exists "Authenticated users can see profiles" on public.profiles;
drop policy if exists "Public select profiles" on public.profiles;
drop policy if exists "allow_public_read_profiles" on public.profiles;
drop policy if exists "allow_users_insert_own_profile" on public.profiles;
drop policy if exists "allow_users_update_own_profile" on public.profiles;

create policy "Authenticated users can read profiles"
on public.profiles for select
to authenticated
using (true);

create policy "Users can insert their own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Anonymous API keys no longer receive table-wide privileges. Anonymous
-- sessions created by Supabase Auth use the authenticated role and still work.
revoke all on table public.profiles from anon;
revoke all on table public.store_products from anon;
revoke all on table public.shop_items from anon;
revoke all on table public.shop_categories from anon;

revoke delete, truncate, references, trigger on table public.profiles from authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select on table public.store_products, public.shop_items, public.shop_categories to authenticated;
grant insert, update, delete on table public.store_products, public.shop_items, public.shop_categories to authenticated;

-- A hardened helper used by RLS and audit policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'superadmin')
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- Reject attempts to change server-owned profile fields through a user JWT.
create or replace function public.protect_profile_system_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select auth.role()) = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.id is distinct from (select auth.uid()) then
        raise exception 'A profile can only be created for the authenticated user'
          using errcode = '42501';
      end if;

      new.role := 'user';
      new.puntos := 0;
      new.monedas := 0;
      new.subscription_tier := 'free';
      new.es_vip := false;
      new.vip_hasta := null;
      new.active_frame_key := null;
      new.email := coalesce((select auth.jwt() ->> 'email'), new.email);
      new.created_at := coalesce(new.created_at, now());
      new.updated_at := now();
      return new;
    end if;

    if new.id is distinct from old.id
      or new.role is distinct from old.role
      or new.puntos is distinct from old.puntos
      or new.monedas is distinct from old.monedas
      or new.subscription_tier is distinct from old.subscription_tier
      or new.es_vip is distinct from old.es_vip
      or new.vip_hasta is distinct from old.vip_hasta
      or new.active_frame_key is distinct from old.active_frame_key
      or new.email is distinct from old.email
      or new.google_full_name is distinct from old.google_full_name
      or new.google_name is distinct from old.google_name
      or new.google_last_name is distinct from old.google_last_name
      or new.created_at is distinct from old.created_at
    then
      raise exception 'System-managed profile fields cannot be changed from the client'
        using errcode = '42501';
    end if;

    new.updated_at := now();
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_system_fields() from public, anon, authenticated;

drop trigger if exists protect_profile_system_fields_trigger on public.profiles;
create trigger protect_profile_system_fields_trigger
before insert or update on public.profiles
for each row execute function public.protect_profile_system_fields();

-- Catalog metadata for traceability.
alter table public.store_products add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.shop_items add column if not exists updated_at timestamptz not null default now();
alter table public.shop_items add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.shop_categories add column if not exists updated_at timestamptz not null default now();
alter table public.shop_categories add column if not exists updated_by uuid references auth.users(id) on delete set null;

-- Defensive domain constraints. Current production data already satisfies them.
alter table public.store_products drop constraint if exists store_products_name_length_check;
alter table public.store_products add constraint store_products_name_length_check check (char_length(btrim(name)) between 2 and 120);
alter table public.store_products drop constraint if exists store_products_price_range_check;
alter table public.store_products add constraint store_products_price_range_check check (price between 0.50 and 100000);
alter table public.store_products drop constraint if exists store_products_amount_range_check;
alter table public.store_products add constraint store_products_amount_range_check check (amount between 1 and 1000000);

alter table public.shop_items drop constraint if exists shop_items_name_length_check;
alter table public.shop_items add constraint shop_items_name_length_check check (char_length(btrim(name)) between 2 and 120);
alter table public.shop_items drop constraint if exists shop_items_description_length_check;
alter table public.shop_items add constraint shop_items_description_length_check check (description is null or char_length(description) <= 1600);
alter table public.shop_items drop constraint if exists shop_items_price_range_check;
alter table public.shop_items add constraint shop_items_price_range_check check (price_coins between 0 and 10000000);
alter table public.shop_items drop constraint if exists shop_items_max_uses_check;
alter table public.shop_items add constraint shop_items_max_uses_check check (max_uses is null or max_uses between 1 and 100000);

alter table public.shop_categories drop constraint if exists shop_categories_name_length_check;
alter table public.shop_categories add constraint shop_categories_name_length_check check (char_length(btrim(name)) between 2 and 80);
alter table public.shop_categories drop constraint if exists shop_categories_order_range_check;
alter table public.shop_categories add constraint shop_categories_order_range_check check (display_order between 0 and 10000);

create index if not exists idx_store_products_active_type on public.store_products(active, type);
create index if not exists idx_shop_items_active_category on public.shop_items(is_active, category_id);
create index if not exists idx_shop_categories_active_order on public.shop_categories(is_active, display_order);

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_created_at on public.admin_audit_logs(created_at desc);
create index if not exists idx_admin_audit_logs_entity on public.admin_audit_logs(entity_type, entity_id);
alter table public.admin_audit_logs enable row level security;

drop policy if exists "Admins can read audit logs" on public.admin_audit_logs;
create policy "Admins can read audit logs"
on public.admin_audit_logs for select
to authenticated
using ((select public.is_admin()));

revoke all on table public.admin_audit_logs from public, anon, authenticated;
grant select on table public.admin_audit_logs to authenticated;

create or replace function public.audit_admin_catalog_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_id text;
begin
  row_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id');

  insert into public.admin_audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    (select auth.uid()),
    tg_op,
    tg_table_name,
    row_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.audit_admin_catalog_change() from public, anon, authenticated;

create or replace function public.touch_admin_catalog_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

revoke all on function public.touch_admin_catalog_row() from public, anon, authenticated;

drop trigger if exists touch_store_products_admin on public.store_products;
create trigger touch_store_products_admin before insert or update on public.store_products
for each row execute function public.touch_admin_catalog_row();
drop trigger if exists audit_store_products_admin on public.store_products;
create trigger audit_store_products_admin after insert or update or delete on public.store_products
for each row execute function public.audit_admin_catalog_change();

drop trigger if exists touch_shop_items_admin on public.shop_items;
create trigger touch_shop_items_admin before insert or update on public.shop_items
for each row execute function public.touch_admin_catalog_row();
drop trigger if exists audit_shop_items_admin on public.shop_items;
create trigger audit_shop_items_admin after insert or update or delete on public.shop_items
for each row execute function public.audit_admin_catalog_change();

drop trigger if exists touch_shop_categories_admin on public.shop_categories;
create trigger touch_shop_categories_admin before insert or update on public.shop_categories
for each row execute function public.touch_admin_catalog_row();
drop trigger if exists audit_shop_categories_admin on public.shop_categories;
create trigger audit_shop_categories_admin after insert or update or delete on public.shop_categories
for each row execute function public.audit_admin_catalog_change();

commit;
