-- Atomic administrative operations used by the catalog UI.

begin;

drop policy if exists "Admins can read all payment orders" on public.payment_orders;
create policy "Admins can read all payment orders"
on public.payment_orders for select
to authenticated
using ((select public.is_admin()));

create or replace function public.protect_profile_system_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select auth.role()) = 'authenticated'
    and coalesce(current_setting('app.system_profile_write', true), 'off') <> 'on'
  then
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

create or replace function public.admin_delete_shop_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_frame_key text;
begin
  if not (select public.is_admin()) then
    raise exception 'Administrator privileges are required'
      using errcode = '42501';
  end if;

  select frame_key into v_frame_key
  from public.shop_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Catalog item not found'
      using errcode = 'P0002';
  end if;

  perform set_config('app.system_profile_write', 'on', true);

  if v_frame_key is not null then
    update public.profiles
    set active_frame_key = null,
        updated_at = now()
    where active_frame_key = v_frame_key;
  end if;

  delete from public.user_inventory where item_id = p_item_id;
  delete from public.shop_items where id = p_item_id;
end;
$$;

revoke all on function public.admin_delete_shop_item(uuid) from public, anon;
grant execute on function public.admin_delete_shop_item(uuid) to authenticated;

commit;
