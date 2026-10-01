-- Recover non-empty schedules created before the parser knew their period.
-- They are moved only when every saved course/section has an exact match in
-- the published 2026-I offering; ambiguous or empty records stay untouched.
with target_version as (
  select v.id
  from public.academic_offering_versions v
  where v.academic_period = '2026-I'
    and v.status = 'published'
  limit 1
), legacy_refs as (
  select
    us.id as schedule_id,
    x.ordinality,
    split_part(x.section_id, '-', 2) as course_code,
    split_part(x.section_id, '-', 3) as section_letter,
    count(*) over (partition by us.id) as total_refs
  from public.user_schedules us
  cross join lateral jsonb_array_elements_text(coalesce(us.secciones, '[]'::jsonb))
    with ordinality as x(section_id, ordinality)
  where us.offering_version_id is null
    and us.periodo = 'Periodo sin identificar'
    and x.section_id like 'Periodo sin identificar-%'
), resolved as (
  select
    r.schedule_id,
    max(r.total_refs) as total_refs,
    count(s.id) as matched_refs,
    jsonb_agg(s.id order by r.ordinality) filter (where s.id is not null) as section_ids
  from legacy_refs r
  cross join target_version tv
  left join public.sche_sections s
    on s.offering_version_id = tv.id
   and s.course_id = r.course_code
   and s.letter = r.section_letter
  group by r.schedule_id
), eligible as (
  select r.schedule_id, r.section_ids, tv.id as version_id
  from resolved r
  cross join target_version tv
  where r.total_refs > 0
    and r.matched_refs = r.total_refs
)
update public.user_schedules us
set
  periodo = '2026-I',
  offering_version_id = e.version_id,
  secciones = e.section_ids,
  updated_at = now()
from eligible e
where us.id = e.schedule_id;
