alter table public.bb_material_sets
    alter column professor_id drop not null;

comment on column public.bb_material_sets.professor_id is
    'Optional professor association. Required by the application only for class and slide materials.';

create unique index if not exists bb_material_sets_general_course_source_cycle_key
    on public.bb_material_sets (course_id, course_name, ciclo)
    where professor_id is null;
