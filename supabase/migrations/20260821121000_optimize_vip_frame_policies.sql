-- Evita políticas SELECT permisivas duplicadas y mantiene la agenda privada para administradores.

drop policy if exists "Admins can manage frames" on public.vip_exclusive_frames;
drop policy if exists "Anyone can view current frame" on public.vip_exclusive_frames;

create policy "Frames visible by schedule or admins"
  on public.vip_exclusive_frames
  for select
  to public
  using (
    (
      is_active
      and starts_at <= now()
      and (expires_at is null or expires_at > now())
    )
    or exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role in ('admin', 'superadmin')
    )
  );

create policy "Admins insert frames"
  on public.vip_exclusive_frames
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role in ('admin', 'superadmin')
    )
  );

create policy "Admins update frames"
  on public.vip_exclusive_frames
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role in ('admin', 'superadmin')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role in ('admin', 'superadmin')
    )
  );

create policy "Admins delete frames"
  on public.vip_exclusive_frames
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role in ('admin', 'superadmin')
    )
  );
