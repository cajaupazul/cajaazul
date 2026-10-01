-- Versioned academic offerings for the schedule builder.
-- This migration is intentionally additive: the legacy sche_courses/periodo
-- columns remain available during the web deployment transition.

create table if not exists public.academic_offering_versions (
  id uuid primary key default gen_random_uuid(),
  academic_period text not null,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  source_label text,
  source_filename text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (academic_period, version_number)
);

create unique index if not exists academic_offering_versions_one_published
  on public.academic_offering_versions (academic_period)
  where status = 'published';

create index if not exists academic_offering_versions_period_status_idx
  on public.academic_offering_versions (academic_period, status, version_number desc);

create table if not exists public.academic_offering_courses (
  id uuid primary key default gen_random_uuid(),
  offering_version_id uuid not null
    references public.academic_offering_versions(id) on delete cascade,
  catalog_course_id uuid references public.catalog_courses(id) on delete set null,
  course_code text not null,
  course_name_snapshot text not null,
  credits_snapshot numeric not null default 0 check (credits_snapshot >= 0),
  created_at timestamptz not null default now(),
  unique (offering_version_id, course_code)
);

create index if not exists academic_offering_courses_catalog_idx
  on public.academic_offering_courses (catalog_course_id)
  where catalog_course_id is not null;

alter table public.sche_sections
  add column if not exists offering_version_id uuid
    references public.academic_offering_versions(id) on delete cascade,
  add column if not exists offering_course_id uuid
    references public.academic_offering_courses(id) on delete cascade;

alter table public.user_schedules
  add column if not exists offering_version_id uuid
    references public.academic_offering_versions(id) on delete restrict;

create unique index if not exists sche_sections_version_course_letter_key
  on public.sche_sections (offering_version_id, course_id, letter)
  where offering_version_id is not null;

create index if not exists sche_sections_offering_version_idx
  on public.sche_sections (offering_version_id);

create index if not exists user_schedules_offering_version_idx
  on public.user_schedules (user_id, offering_version_id, created_at);

-- Convert every existing import into an immutable historical version.
with legacy_periods as (
  select distinct
    s.periodo as source_label,
    case
      when upper(s.periodo) ~ '20[0-9]{2}[[:space:]]*[-_/][[:space:]]*(II|2)([^0-9]|$)'
        then substring(upper(s.periodo) from '(20[0-9]{2})') || '-II'
      when upper(s.periodo) ~ '20[0-9]{2}[[:space:]]*[-_/][[:space:]]*(I|1)([^0-9]|$)'
        then substring(upper(s.periodo) from '(20[0-9]{2})') || '-I'
      else trim(s.periodo)
    end as academic_period
  from public.sche_sections s
), ranked_periods as (
  select
    lp.*,
    row_number() over (
      partition by lp.academic_period
      order by
        case
          when upper(lp.source_label) ~ 'V[[:space:]]*[0-9]+'
            then coalesce((substring(upper(lp.source_label) from 'V[[:space:]]*([0-9]+)'))::integer, 1)
          when upper(lp.source_label) = lp.academic_period then 100000
          else 50000
        end,
        lp.source_label
    ) as version_number,
    count(*) over (partition by lp.academic_period) as version_count
  from legacy_periods lp
)
insert into public.academic_offering_versions (
  academic_period,
  version_number,
  status,
  source_label,
  published_at
)
select
  rp.academic_period,
  rp.version_number,
  case when rp.version_number = rp.version_count then 'published' else 'archived' end,
  rp.source_label,
  case when rp.version_number = rp.version_count then now() else null end
from ranked_periods rp
on conflict (academic_period, version_number) do nothing;

insert into public.academic_offering_courses (
  offering_version_id,
  catalog_course_id,
  course_code,
  course_name_snapshot,
  credits_snapshot
)
select distinct on (v.id, s.course_id)
  v.id,
  cc.id,
  s.course_id,
  coalesce(cc.nombre, sc.name, s.course_id),
  coalesce(cc.creditos::numeric, sc.credits, 0)
from public.sche_sections s
join public.academic_offering_versions v
  on v.source_label = s.periodo
left join public.sche_courses sc
  on sc.id = s.course_id
left join public.catalog_courses cc
  on upper(regexp_replace(coalesce(cc.codigo, ''), '[^[:alnum:]]', '', 'g')) =
     upper(regexp_replace(coalesce(s.course_id, ''), '[^[:alnum:]]', '', 'g'))
order by v.id, s.course_id, cc.id
on conflict (offering_version_id, course_code) do nothing;

update public.sche_sections s
set
  offering_version_id = v.id,
  offering_course_id = oc.id
from public.academic_offering_versions v
join public.academic_offering_courses oc
  on oc.offering_version_id = v.id
where v.source_label = s.periodo
  and oc.course_code = s.course_id
  and (s.offering_version_id is null or s.offering_course_id is null);

-- Pin existing saved schedules to the exact version referenced by their saved
-- section IDs. Empty legacy schedules fall back to their source label or to the
-- published version of the normalized academic period.
with inferred as (
  select
    us.id as schedule_id,
    (
      select ss.offering_version_id
      from jsonb_array_elements_text(coalesce(us.secciones, '[]'::jsonb)) saved(section_id)
      join public.sche_sections ss on ss.id = saved.section_id
      where ss.offering_version_id is not null
      limit 1
    ) as version_from_sections,
    (
      select v.id
      from public.academic_offering_versions v
      where v.source_label = us.periodo
      order by v.version_number desc
      limit 1
    ) as version_from_label,
    case
      when upper(us.periodo) ~ '20[0-9]{2}[[:space:]]*[-_/][[:space:]]*(II|2)([^0-9]|$)'
        then substring(upper(us.periodo) from '(20[0-9]{2})') || '-II'
      when upper(us.periodo) ~ '20[0-9]{2}[[:space:]]*[-_/][[:space:]]*(I|1)([^0-9]|$)'
        then substring(upper(us.periodo) from '(20[0-9]{2})') || '-I'
      else trim(us.periodo)
    end as normalized_period
  from public.user_schedules us
  where us.offering_version_id is null
)
update public.user_schedules us
set offering_version_id = coalesce(
  i.version_from_sections,
  i.version_from_label,
  (
    select v.id
    from public.academic_offering_versions v
    where v.academic_period = i.normalized_period
      and v.status = 'published'
    limit 1
  )
)
from inferred i
where us.id = i.schedule_id;

alter table public.academic_offering_versions enable row level security;
alter table public.academic_offering_courses enable row level security;

drop policy if exists academic_offering_versions_select on public.academic_offering_versions;
create policy academic_offering_versions_select
  on public.academic_offering_versions
  for select to authenticated
  using (true);

drop policy if exists academic_offering_courses_select on public.academic_offering_courses;
create policy academic_offering_courses_select
  on public.academic_offering_courses
  for select to authenticated
  using (true);

grant select on public.academic_offering_versions to authenticated;
grant select on public.academic_offering_courses to authenticated;

create or replace function public.import_academic_offering_version(
  p_academic_period text,
  p_source_label text default null,
  p_source_filename text default null,
  p_courses jsonb default '[]'::jsonb,
  p_sections jsonb default '[]'::jsonb,
  p_blocks jsonb default '[]'::jsonb
)
returns table (id uuid, version_number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  new_version integer;
  normalized_period text := upper(trim(p_academic_period));
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'superadmin')
  ) then
    raise exception 'Solo los administradores pueden crear versiones de oferta académica';
  end if;

  if normalized_period !~ '^20[0-9]{2}-(I|II)$' then
    raise exception 'El ciclo debe tener el formato AAAA-I o AAAA-II';
  end if;

  if jsonb_array_length(p_courses) = 0 or jsonb_array_length(p_sections) = 0 then
    raise exception 'La oferta debe contener al menos un curso y una sección';
  end if;

  perform pg_advisory_xact_lock(hashtext(normalized_period));

  select coalesce(max(v.version_number), 0) + 1
  into new_version
  from public.academic_offering_versions v
  where v.academic_period = normalized_period;

  insert into public.academic_offering_versions (
    academic_period,
    version_number,
    status,
    source_label,
    source_filename,
    created_by
  ) values (
    normalized_period,
    new_version,
    'draft',
    nullif(trim(p_source_label), ''),
    nullif(trim(p_source_filename), ''),
    auth.uid()
  )
  returning academic_offering_versions.id into new_id;

  -- Temporary compatibility data for the currently deployed client. The new
  -- builder reads the canonical catalog and immutable snapshots below.
  insert into public.sche_courses (id, name, credits)
  select
    c.course_code,
    c.course_name,
    greatest(coalesce(c.credits, 0), 0)
  from jsonb_to_recordset(p_courses) as c(
    course_code text,
    course_name text,
    credits numeric
  )
  on conflict (id) do update set
    name = excluded.name,
    credits = excluded.credits;

  insert into public.academic_offering_courses (
    offering_version_id,
    catalog_course_id,
    course_code,
    course_name_snapshot,
    credits_snapshot
  )
  select
    new_id,
    catalog.id,
    c.course_code,
    coalesce(catalog.nombre, c.course_name, c.course_code),
    greatest(coalesce(catalog.creditos::numeric, c.credits, 0), 0)
  from jsonb_to_recordset(p_courses) as c(
    course_code text,
    course_name text,
    credits numeric
  )
  left join lateral (
    select cc.id, cc.nombre, cc.creditos
    from public.catalog_courses cc
    where upper(regexp_replace(coalesce(cc.codigo, ''), '[^[:alnum:]]', '', 'g')) =
          upper(regexp_replace(coalesce(c.course_code, ''), '[^[:alnum:]]', '', 'g'))
    order by cc.id
    limit 1
  ) catalog on true;

  insert into public.sche_sections (
    id,
    course_id,
    letter,
    teacher,
    periodo,
    offering_version_id,
    offering_course_id
  )
  select
    gen_random_uuid()::text,
    s.course_code,
    s.letter,
    coalesce(nullif(trim(s.teacher), ''), 'Sin profesor'),
    normalized_period || ' · v' || new_version::text,
    new_id,
    oc.id
  from jsonb_to_recordset(p_sections) as s(
    course_code text,
    letter text,
    teacher text
  )
  join public.academic_offering_courses oc
    on oc.offering_version_id = new_id
   and oc.course_code = s.course_code;

  insert into public.sche_schedule_blocks (
    section_id,
    type,
    day,
    start_time,
    end_time,
    classroom
  )
  select distinct
    s.id,
    b.type,
    b.day,
    b.start_time::time,
    b.end_time::time,
    nullif(trim(b.classroom), '')
  from jsonb_to_recordset(p_blocks) as b(
    course_code text,
    letter text,
    type text,
    day text,
    start_time text,
    end_time text,
    classroom text
  )
  join public.sche_sections s
    on s.offering_version_id = new_id
   and s.course_id = b.course_code
   and s.letter = b.letter;

  return query select new_id, new_version;
end;
$$;

create or replace function public.publish_academic_offering_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_period text;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'superadmin')
  ) then
    raise exception 'Solo los administradores pueden publicar ofertas académicas';
  end if;

  select v.academic_period
  into target_period
  from public.academic_offering_versions v
  where v.id = p_version_id
  for update;

  if target_period is null then
    raise exception 'La versión indicada no existe';
  end if;

  if not exists (
    select 1 from public.sche_sections s
    where s.offering_version_id = p_version_id
  ) then
    raise exception 'No se puede publicar una versión sin secciones';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_period));

  update public.academic_offering_versions v
  set status = 'archived'
  where v.academic_period = target_period
    and v.status = 'published'
    and v.id <> p_version_id;

  update public.academic_offering_versions v
  set status = 'published', published_at = now()
  where v.id = p_version_id;
end;
$$;

create or replace function public.delete_academic_offering_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_status text;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'superadmin')
  ) then
    raise exception 'Solo los administradores pueden eliminar ofertas académicas';
  end if;

  select v.status into target_status
  from public.academic_offering_versions v
  where v.id = p_version_id
  for update;

  if target_status is null then
    raise exception 'La versión indicada no existe';
  end if;

  if target_status = 'published' then
    raise exception 'Publica otra versión antes de eliminar la oferta vigente';
  end if;

  if exists (
    select 1 from public.user_schedules us
    where us.offering_version_id = p_version_id
  ) then
    raise exception 'Esta versión conserva horarios de usuarios y no puede eliminarse';
  end if;

  delete from public.academic_offering_versions v where v.id = p_version_id;
end;
$$;

revoke all on function public.import_academic_offering_version(text, text, text, jsonb, jsonb, jsonb) from public;
revoke all on function public.publish_academic_offering_version(uuid) from public;
revoke all on function public.delete_academic_offering_version(uuid) from public;

grant execute on function public.import_academic_offering_version(text, text, text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.publish_academic_offering_version(uuid) to authenticated;
grant execute on function public.delete_academic_offering_version(uuid) to authenticated;

comment on table public.academic_offering_versions is
  'Immutable imports of each academic-period offering; one published version per period.';
comment on table public.academic_offering_courses is
  'Courses present in one offering version, linked to the canonical catalog when possible.';
comment on column public.academic_offering_courses.course_name_snapshot is
  'Historical fallback used when the catalog course changes or is absent.';
