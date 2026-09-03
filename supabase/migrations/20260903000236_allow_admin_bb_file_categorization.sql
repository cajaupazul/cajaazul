-- La categoría de una importación Blackboard se puede corregir desde el
-- organizador del curso. Solo administrador o superadministrador la modifica.
drop policy if exists "Admin puede actualizar categoria de archivos" on public.bb_files;

create policy "Admin puede actualizar categoria de archivos"
on public.bb_files
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
