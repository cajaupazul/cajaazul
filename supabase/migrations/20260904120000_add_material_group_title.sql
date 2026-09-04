-- A descriptive batch label for shared notes and other shared resources.
-- It is deliberately separate from `titulo`, which remains the individual file title.
alter table public.materials
  add column if not exists group_title text;

comment on column public.materials.group_title is
  'Optional uploader-defined group title for shared notes and other resources.';

create index if not exists materials_course_cycle_group_title_idx
  on public.materials (course_id, cycle_id, group_title)
  where group_title is not null;
