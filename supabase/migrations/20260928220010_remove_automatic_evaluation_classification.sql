-- Keep filename-based academic-period detection, but collapse any evaluation
-- type inferred by the previous uploader into the general Evaluations folder.
-- Rows without evaluation_type were manually organised and are left untouched.
with candidates as materialized (
    select
        material.id,
        material.cycle_id,
        material.tipo
    from public.materials as material
    where material.material_scope = 'standard'
      and material.cycle_id is not null
      and material.academic_period is not null
      and material.evaluation_type is not null
),
reclassified as (
    update public.materials as material
    set
        tipo = '📝 Exámenes',
        evaluation_type = null
    from candidates as candidate
    where material.id = candidate.id
    returning material.id
)
update public.course_cycles as cycle
set active_subfolders = coalesce((
    select array_agg(existing.folder order by existing.position)
    from unnest(coalesce(cycle.active_subfolders, '{}'::text[]))
        with ordinality as existing(folder, position)
    where not (
        exists (
            select 1
            from candidates as candidate
            where candidate.cycle_id = cycle.id
              and candidate.tipo = existing.folder
        )
        and not exists (
            select 1
            from public.materials as remaining
            where remaining.cycle_id = cycle.id
              and remaining.tipo = existing.folder
              and not exists (
                  select 1
                  from candidates as candidate
                  where candidate.id = remaining.id
              )
        )
    )
), '{}'::text[])
where exists (
    select 1
    from candidates as candidate
    where candidate.cycle_id = cycle.id
)
and exists (select 1 from reclassified);
