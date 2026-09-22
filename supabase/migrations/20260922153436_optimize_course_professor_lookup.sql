-- Course detail filters this table by catalog_course_id. The primary key starts
-- with professor_id, so it cannot efficiently serve that lookup as data grows.
create index if not exists course_professors_catalog_course_id_idx
  on public.course_professors (catalog_course_id);
