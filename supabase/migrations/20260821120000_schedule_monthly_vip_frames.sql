-- Programación segura de marcos VIP y sincronización automática con la tienda.

create schema if not exists private;
revoke all on schema private from public;

alter table public.vip_exclusive_frames
  add column if not exists starts_at timestamptz;

update public.vip_exclusive_frames
set starts_at = created_at
where starts_at is null;

alter table public.vip_exclusive_frames
  alter column starts_at set default now(),
  alter column starts_at set not null;

alter table public.vip_exclusive_frames
  drop constraint if exists vip_exclusive_frames_valid_period;

alter table public.vip_exclusive_frames
  add constraint vip_exclusive_frames_valid_period
  check (expires_at is null or expires_at > starts_at);

-- Dos marcos habilitados nunca pueden ocupar el mismo intervalo.
alter table public.vip_exclusive_frames
  drop constraint if exists vip_exclusive_frames_no_active_overlap;

alter table public.vip_exclusive_frames
  add constraint vip_exclusive_frames_no_active_overlap
  exclude using gist (
    tstzrange(starts_at, coalesce(expires_at, 'infinity'::timestamptz), '[)') with &&
  ) where (is_active);

create index if not exists vip_exclusive_frames_schedule_idx
  on public.vip_exclusive_frames (starts_at, expires_at)
  where is_active;

drop policy if exists "Anyone can view active frames" on public.vip_exclusive_frames;
create policy "Anyone can view current frame"
  on public.vip_exclusive_frames
  for select
  to public
  using (
    is_active
    and starts_at <= now()
    and (expires_at is null or expires_at > now())
  );

create or replace function private.sync_current_vip_frame()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_frame public.vip_exclusive_frames%rowtype;
  avatar_category_id uuid;
begin
  select frame.*
    into current_frame
  from public.vip_exclusive_frames as frame
  where frame.is_active
    and frame.starts_at <= now()
    and (frame.expires_at is null or frame.expires_at > now())
  order by frame.starts_at desc
  limit 1;

  if not found then
    update public.shop_items
       set is_active = false,
           updated_at = now()
     where frame_key = 'vip_exclusive';
    return;
  end if;

  select category.id
    into avatar_category_id
  from public.shop_categories as category
  where category.name = 'Decoraciones de Avatar'
  order by category.created_at
  limit 1;

  insert into public.shop_items (
    type,
    name,
    description,
    image_url,
    price_coins,
    is_active,
    frame_key,
    category_id,
    frame_settings,
    updated_at
  ) values (
    'profile_frame',
    current_frame.label,
    current_frame.description,
    current_frame.image_url,
    0,
    true,
    'vip_exclusive',
    avatar_category_id,
    jsonb_build_object(
      'card', jsonb_build_object('scale', current_frame.scale_factor, 'x', current_frame.offset_x, 'y', current_frame.offset_y),
      'profile', jsonb_build_object('scale', current_frame.scale_factor, 'x', current_frame.offset_x, 'y', current_frame.offset_y),
      'navbar', jsonb_build_object('scale', current_frame.scale_factor, 'x', current_frame.offset_x, 'y', current_frame.offset_y)
    ),
    now()
  )
  on conflict (frame_key) do update
    set name = excluded.name,
        description = excluded.description,
        image_url = excluded.image_url,
        price_coins = 0,
        is_active = true,
        category_id = coalesce(excluded.category_id, public.shop_items.category_id),
        frame_settings = excluded.frame_settings,
        updated_at = now();
end;
$$;

revoke all on function private.sync_current_vip_frame() from public, anon, authenticated;

create or replace function private.sync_current_vip_frame_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_current_vip_frame();
  return null;
end;
$$;

revoke all on function private.sync_current_vip_frame_after_change() from public, anon, authenticated;

drop trigger if exists sync_current_vip_frame_after_change on public.vip_exclusive_frames;
create trigger sync_current_vip_frame_after_change
after insert or update or delete on public.vip_exclusive_frames
for each statement execute function private.sync_current_vip_frame_after_change();

-- La transición se comprueba cada minuto, incluso si nadie abre la web.
create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
  from cron.job
  where jobname = 'sync-current-vip-frame'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'sync-current-vip-frame',
    '* * * * *',
    'select private.sync_current_vip_frame();'
  );
end;
$$;

select private.sync_current_vip_frame();
