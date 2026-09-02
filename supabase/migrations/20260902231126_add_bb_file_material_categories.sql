-- Categoría elegida por la persona que importa una carpeta Blackboard.
-- Es opcional para conservar todos los archivos históricos sin inferir nada
-- a partir de sus nombres.
alter table public.bb_files
  add column if not exists material_category text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bb_files_material_category_check'
      and conrelid = 'public.bb_files'::regclass
  ) then
    alter table public.bb_files
      add constraint bb_files_material_category_check
      check (
        material_category is null
        or material_category in (
          'evaluations',
          'classes',
          'notes',
          'syllabus',
          'resources'
        )
      );
  end if;
end $$;

comment on column public.bb_files.material_category is
  'Categoría manual del archivo: evaluations, classes, notes, syllabus o resources. Nulo para importaciones históricas sin clasificar.';
