-- The web app already reads and writes this optional course-level syllabus URL.
alter table public.courses
  add column if not exists syllabus_url text;
