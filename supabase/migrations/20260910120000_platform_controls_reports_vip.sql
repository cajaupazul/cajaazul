-- Platform controls, reporting inbox and short-lived welcome notifications.
-- All writes remain protected by RLS; admins are determined by public.is_admin().

create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  downloads_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.platform_settings (id, downloads_enabled)
values (true, true)
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;
drop policy if exists "Authenticated users can read platform settings" on public.platform_settings;
create policy "Authenticated users can read platform settings" on public.platform_settings
  for select to authenticated using (true);
drop policy if exists "Admins can update platform settings" on public.platform_settings;
create policy "Admins can update platform settings" on public.platform_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.set_platform_settings_audit_fields()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists platform_settings_audit on public.platform_settings;
create trigger platform_settings_audit before update on public.platform_settings
  for each row execute function public.set_platform_settings_audit_fields();

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'system',
  title text not null,
  body text not null,
  href text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists user_notifications_user_created_idx on public.user_notifications(user_id, created_at desc);
create index if not exists user_notifications_expiry_idx on public.user_notifications(expires_at) where expires_at is not null;
alter table public.user_notifications enable row level security;
drop policy if exists "Users can read their notifications" on public.user_notifications;
create policy "Users can read their notifications" on public.user_notifications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users can mark their notifications read" on public.user_notifications;
create policy "Users can mark their notifications read" on public.user_notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Admins can read all notifications" on public.user_notifications;
create policy "Admins can read all notifications" on public.user_notifications
  for select to authenticated using (public.is_admin());

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('course','comment','library','tool')),
  source_id text,
  context_label text not null,
  message text not null check (char_length(trim(message)) between 10 and 2000),
  evidence_path text,
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);
create index if not exists content_reports_status_created_idx on public.content_reports(status, created_at desc);
alter table public.content_reports enable row level security;
drop policy if exists "Users can create reports" on public.content_reports;
create policy "Users can create reports" on public.content_reports
  for insert to authenticated with check (reporter_id = auth.uid());
drop policy if exists "Users can read their reports" on public.content_reports;
create policy "Users can read their reports" on public.content_reports
  for select to authenticated using (reporter_id = auth.uid());
drop policy if exists "Admins can read reports" on public.content_reports;
create policy "Admins can read reports" on public.content_reports
  for select to authenticated using (public.is_admin());
drop policy if exists "Admins can manage reports" on public.content_reports;
create policy "Admins can manage reports" on public.content_reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-evidence', 'report-evidence', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Users upload own report evidence" on storage.objects;
create policy "Users upload own report evidence" on storage.objects for insert to authenticated
  with check (bucket_id = 'report-evidence' and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists "Users read own report evidence" on storage.objects;
create policy "Users read own report evidence" on storage.objects for select to authenticated
  using (bucket_id = 'report-evidence' and ((storage.foldername(name))[1] = (select auth.uid()::text) or public.is_admin()));
drop policy if exists "Users delete own report evidence" on storage.objects;
create policy "Users delete own report evidence" on storage.objects for delete to authenticated
  using (bucket_id = 'report-evidence' and ((storage.foldername(name))[1] = (select auth.uid()::text) or public.is_admin()));

create or replace function public.create_welcome_notification()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.user_notifications (user_id, kind, title, body, href, expires_at)
  values (new.id, 'welcome', 'Bienvenido a CampusLink', 'Tu cuenta ya está lista. Completa tu perfil y empieza a explorar.', '/profile', now() + interval '7 days');
  return new;
end;
$$;
revoke all on function public.create_welcome_notification() from public, anon, authenticated;
drop trigger if exists profiles_welcome_notification on public.profiles;
create trigger profiles_welcome_notification after insert on public.profiles
  for each row execute function public.create_welcome_notification();

create or replace function public.notify_admins_of_report()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.user_notifications (user_id, kind, title, body, href, metadata)
  select p.id, 'report', 'Nuevo reporte recibido', left(new.context_label || ': ' || new.message, 260), '/admin?tab=reports', jsonb_build_object('report_id', new.id, 'source_type', new.source_type)
  from public.profiles p
  where p.role in ('admin', 'superadmin');
  return new;
end;
$$;
revoke all on function public.notify_admins_of_report() from public, anon, authenticated;
drop trigger if exists reports_admin_notification on public.content_reports;
create trigger reports_admin_notification after insert on public.content_reports
  for each row execute function public.notify_admins_of_report();

create or replace function public.cleanup_my_expired_notifications()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  delete from public.user_notifications where user_id = auth.uid() and expires_at is not null and expires_at <= now();
end;
$$;
revoke all on function public.cleanup_my_expired_notifications() from public, anon;
grant execute on function public.cleanup_my_expired_notifications() to authenticated, service_role;
