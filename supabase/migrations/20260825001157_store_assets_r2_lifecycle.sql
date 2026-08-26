-- Store media lifecycle: R2 contains bytes; Postgres contains ownership,
-- versioning, lifecycle state and audit data.

begin;

alter table public.shop_items
  add column if not exists catalog_status text not null default 'active',
  add column if not exists retired_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revocation_reason text;

update public.shop_items
set catalog_status = case when is_active then 'active' else 'retired' end,
    retired_at = case when is_active then null else coalesce(retired_at, updated_at, now()) end
where catalog_status = 'active' and not is_active;

alter table public.shop_items drop constraint if exists shop_items_catalog_status_check;
alter table public.shop_items add constraint shop_items_catalog_status_check
  check (catalog_status in ('active', 'retired', 'revoked', 'deletion_pending'));

alter table public.shop_items drop constraint if exists shop_items_revocation_reason_length_check;
alter table public.shop_items add constraint shop_items_revocation_reason_length_check
  check (revocation_reason is null or char_length(revocation_reason) between 10 and 1000);

create index if not exists idx_shop_items_catalog_status
  on public.shop_items(catalog_status, updated_at desc);

-- Keep older clients compatible while the new admin panel rolls out.
create or replace function public.sync_shop_item_lifecycle()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.catalog_status = 'revoked' then
    new.is_active := false;
  elsif new.is_active is distinct from old.is_active
    and new.catalog_status is not distinct from old.catalog_status
  then
    new.catalog_status := case when new.is_active then 'active' else 'retired' end;
    new.retired_at := case when new.is_active then null else coalesce(new.retired_at, now()) end;
  elsif new.catalog_status is distinct from old.catalog_status then
    new.is_active := new.catalog_status = 'active';
  end if;
  return new;
end;
$$;

revoke all on function public.sync_shop_item_lifecycle() from public, anon, authenticated;
drop trigger if exists sync_shop_item_lifecycle on public.shop_items;
create trigger sync_shop_item_lifecycle
before update on public.shop_items
for each row execute function public.sync_shop_item_lifecycle();

create table if not exists public.shop_item_assets (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.shop_items(id) on delete cascade,
  bucket text not null default 'profile-frames',
  object_key text not null,
  variant text not null default 'original',
  version bigint not null default 1,
  mime_type text,
  size_bytes bigint,
  checksum_sha256 text,
  status text not null default 'active',
  is_current boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  superseded_at timestamptz,
  deleted_at timestamptz,
  constraint shop_item_assets_bucket_check check (bucket = 'profile-frames'),
  constraint shop_item_assets_key_check check (
    object_key ~ '^items/[0-9a-fA-F-]{36}/v[0-9]+/(original|display|thumbnail)\.[a-zA-Z0-9]+$'
  ),
  constraint shop_item_assets_variant_check check (variant in ('original', 'display', 'thumbnail')),
  constraint shop_item_assets_version_check check (version > 0),
  constraint shop_item_assets_size_check check (size_bytes is null or size_bytes >= 0),
  constraint shop_item_assets_status_check check (
    status in ('active', 'superseded', 'pending_delete', 'deleted', 'cleanup_failed')
  ),
  unique (item_id, version, variant)
);

create unique index if not exists uq_shop_item_assets_current_variant
  on public.shop_item_assets(item_id, variant)
  where is_current and status = 'active';
create index if not exists idx_shop_item_assets_cleanup
  on public.shop_item_assets(status, created_at)
  where status in ('pending_delete', 'cleanup_failed');
create index if not exists idx_shop_item_assets_object_key
  on public.shop_item_assets(bucket, object_key);

alter table public.shop_item_assets enable row level security;
drop policy if exists "Admins can read shop item assets" on public.shop_item_assets;
create policy "Admins can read shop item assets"
on public.shop_item_assets for select
to authenticated
using ((select public.is_admin()));

revoke all on table public.shop_item_assets from public, anon, authenticated;
grant select on table public.shop_item_assets to authenticated;
grant all on table public.shop_item_assets to service_role;

-- Owners must continue seeing metadata for items that were safely retired.
drop policy if exists shop_items_select_owned on public.shop_items;
create policy shop_items_select_owned
on public.shop_items for select
to authenticated
using (
  exists (
    select 1
    from public.user_inventory ui
    where ui.item_id = shop_items.id
      and ui.user_id = (select auth.uid())
  )
);

-- Never erase purchased entitlements as a side effect of deleting catalog data.
alter table public.user_inventory
  drop constraint if exists user_inventory_item_id_fkey;
alter table public.user_inventory
  add constraint user_inventory_item_id_fkey
  foreign key (item_id) references public.shop_items(id) on delete restrict;

alter table public.vip_exclusive_frames
  add column if not exists asset_bucket text,
  add column if not exists asset_object_key text,
  add column if not exists asset_mime_type text,
  add column if not exists asset_size_bytes bigint,
  add column if not exists asset_checksum_sha256 text;

alter table public.vip_exclusive_frames drop constraint if exists vip_frames_asset_bucket_check;
alter table public.vip_exclusive_frames add constraint vip_frames_asset_bucket_check
  check (asset_bucket is null or asset_bucket = 'profile-frames');
alter table public.vip_exclusive_frames drop constraint if exists vip_frames_asset_size_check;
alter table public.vip_exclusive_frames add constraint vip_frames_asset_size_check
  check (asset_size_bytes is null or asset_size_bytes >= 0);

-- Administrative lifecycle events are explicit and searchable.
alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_action_check;
alter table public.admin_audit_logs add constraint admin_audit_logs_action_check
  check (action in (
    'INSERT', 'UPDATE', 'DELETE', 'RETIRE', 'ACTIVATE', 'REVOKE',
    'CLEANUP_REQUIRED', 'MIGRATE'
  ));

-- Remove the former function that silently erased every owner entitlement.
-- DROP IF EXISTS is enough here: some production databases never installed it,
-- and REVOKE cannot target a function that does not exist.
drop function if exists public.admin_delete_shop_item(uuid);

-- Emergency-only operation. It intentionally removes entitlements, but keeps a
-- tombstone and a durable audit trail. Only the service role can invoke it.
create or replace function public.internal_revoke_shop_item(
  p_item_id uuid,
  p_actor_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.shop_items%rowtype;
  v_owner_count integer;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 10 then
    raise exception 'A detailed revocation reason is required' using errcode = '22023';
  end if;

  select * into v_item
  from public.shop_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Catalog item not found' using errcode = 'P0002';
  end if;

  select count(*)::integer into v_owner_count
  from public.user_inventory
  where item_id = p_item_id;

  perform set_config('app.system_profile_write', 'on', true);
  if v_item.frame_key is not null then
    update public.profiles
    set active_frame_key = null,
        updated_at = now()
    where active_frame_key = v_item.frame_key;
  end if;

  delete from public.user_inventory where item_id = p_item_id;

  update public.shop_items
  set is_active = false,
      catalog_status = 'revoked',
      revoked_at = now(),
      retired_at = coalesce(retired_at, now()),
      revocation_reason = btrim(p_reason),
      image_url = null,
      updated_by = p_actor_id
  where id = p_item_id;

  insert into public.admin_audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    p_actor_id,
    'REVOKE',
    'shop_item_emergency_revocation',
    p_item_id::text,
    jsonb_build_object(
      'name', v_item.name,
      'frame_key', v_item.frame_key,
      'owner_count', v_owner_count,
      'image_url', v_item.image_url
    ),
    jsonb_build_object('reason', btrim(p_reason), 'revoked_at', now())
  );

  return jsonb_build_object(
    'id', p_item_id,
    'name', v_item.name,
    'frame_key', v_item.frame_key,
    'owner_count', v_owner_count,
    'legacy_image_url', v_item.image_url
  );
end;
$$;

revoke all on function public.internal_revoke_shop_item(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.internal_revoke_shop_item(uuid, uuid, text)
  to service_role;

commit;
