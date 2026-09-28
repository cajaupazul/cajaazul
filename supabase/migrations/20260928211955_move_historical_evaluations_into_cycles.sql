-- Reclassify the intentional historical bank into real course cycles. Only the
-- supported 2010-current range is migrated; no material row is duplicated.
insert into public.course_cycles (course_id, ciclo_name, created_by)
select distinct
    material.course_id,
    material.academic_period,
    null
from public.materials as material
where material.material_scope = 'course_bank'
  and material.academic_period is not null
  and case
      when material.academic_period ~ '^(19|20)[0-9]{2}-[012]$'
          then left(material.academic_period, 4)::integer
              between 2010 and extract(year from current_date)::integer
      else false
  end
on conflict (course_id, ciclo_name) do nothing;

-- Register inferred PC/partial/final folders so the classic folder view can
-- expose each evaluation in the same place as a manually classified upload.
with detected_folders as (
    select
        cycle.id as cycle_id,
        array_agg(distinct material.tipo) as folders
    from public.materials as material
    join public.course_cycles as cycle
      on cycle.course_id = material.course_id
     and cycle.ciclo_name = material.academic_period
    where material.material_scope = 'course_bank'
      and material.academic_period is not null
      and material.evaluation_type <> 'other'
      and case
          when material.academic_period ~ '^(19|20)[0-9]{2}-[012]$'
              then left(material.academic_period, 4)::integer
                  between 2010 and extract(year from current_date)::integer
          else false
      end
    group by cycle.id
)
update public.course_cycles as cycle
set active_subfolders = (
    select coalesce(array_agg(distinct expanded.folder), '{}'::text[])
    from unnest(coalesce(cycle.active_subfolders, '{}'::text[]) || detected.folders) as expanded(folder)
)
from detected_folders as detected
where cycle.id = detected.cycle_id;

update public.materials as material
set
    cycle_id = cycle.id,
    material_scope = 'standard'
from public.course_cycles as cycle
where material.material_scope = 'course_bank'
  and material.course_id = cycle.course_id
  and material.academic_period = cycle.ciclo_name
  and case
      when material.academic_period ~ '^(19|20)[0-9]{2}-[012]$'
          then left(material.academic_period, 4)::integer
              between 2010 and extract(year from current_date)::integer
      else false
  end;
