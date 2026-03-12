-- Migración para asegurar la integridad de la tabla course_professors
-- 1. Asegurar FKs
ALTER TABLE public.course_professors 
ADD CONSTRAINT IF NOT EXISTS course_professors_course_id_fkey 
FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;

ALTER TABLE public.course_professors 
ADD CONSTRAINT IF NOT EXISTS course_professors_professor_id_fkey 
FOREIGN KEY (professor_id) REFERENCES public.professors(id) ON DELETE CASCADE;

-- 2. Evitar duplicados
ALTER TABLE public.course_professors 
ADD CONSTRAINT IF NOT EXISTS course_professors_professor_id_course_id_key 
UNIQUE(professor_id, course_id);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_course_professors_course_id ON public.course_professors(course_id);
CREATE INDEX IF NOT EXISTS idx_course_professors_professor_id ON public.course_professors(professor_id);
