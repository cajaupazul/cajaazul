-- Relaciona de forma estable las importaciones Blackboard con el ciclo y
-- conserva una ruta lógica independiente de la ubicación física en R2.
alter table public.bb_material_sets
    add column if not exists cycle_id uuid references public.course_cycles(id) on delete set null;

alter table public.bb_files
    add column if not exists relative_path text;

update public.bb_material_sets as material_set
set cycle_id = cycle.id
from public.course_cycles as cycle
where material_set.cycle_id is null
  and material_set.course_id = cycle.course_id
  and material_set.ciclo = cycle.ciclo_name;

update public.bb_files as file
set relative_path = concat_ws('/', folder.path, file.name)
from public.bb_folders as folder
where file.relative_path is null
  and file.folder_id = folder.id;

update public.bb_files
set relative_path = name
where relative_path is null;

alter table public.bb_material_sets
    drop constraint if exists bb_material_sets_professor_id_course_name_ciclo_key;

alter table public.bb_material_sets
    add constraint bb_material_sets_course_professor_source_cycle_key
    unique (course_id, professor_id, course_name, ciclo);

create unique index if not exists bb_files_set_relative_path_key
    on public.bb_files (set_id, relative_path)
    where relative_path is not null;

create index if not exists bb_material_sets_course_cycle_idx
    on public.bb_material_sets (course_id, cycle_id);

create index if not exists bb_files_set_uploader_created_idx
    on public.bb_files (set_id, uploaded_by, created_at desc);

