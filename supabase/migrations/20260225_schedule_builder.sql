-- ============================================
-- Schedule Builder: Normalized Schema (The Shield)
-- Tables: sche_courses, sche_sections, sche_schedule_blocks
-- ============================================

-- 1. Courses Table
CREATE TABLE IF NOT EXISTS public.sche_courses (
  id TEXT PRIMARY KEY, -- ej: "120133" (Course Code)
  name TEXT NOT NULL,
  credits NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Sections Table
CREATE TABLE IF NOT EXISTS public.sche_sections (
  id TEXT PRIMARY KEY, -- ej: "120133-A" (Composite Key)
  course_id TEXT REFERENCES public.sche_courses(id) ON DELETE CASCADE,
  letter TEXT NOT NULL,
  teacher TEXT NOT NULL,
  periodo TEXT NOT NULL,
  UNIQUE(course_id, letter, periodo) -- The Shield: prevents duplicate sections in same period
);

-- 3. Schedule Blocks Table
CREATE TABLE IF NOT EXISTS public.sche_schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id TEXT REFERENCES public.sche_sections(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('CLASE','PARCIAL','FINAL','PRACTICA')),
  day TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  classroom TEXT,
  UNIQUE(section_id, type, day, start_time, end_time) -- The Shield: prevents duplicate schedule lines
);

-- RLS
ALTER TABLE public.sche_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sche_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sche_schedule_blocks ENABLE ROW LEVEL SECURITY;

-- Select policies
DROP POLICY IF EXISTS "sche_courses_select" ON public.sche_courses;
CREATE POLICY "sche_courses_select" ON public.sche_courses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sche_sections_select" ON public.sche_sections;
CREATE POLICY "sche_sections_select" ON public.sche_sections FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sche_schedule_blocks_select" ON public.sche_schedule_blocks;
CREATE POLICY "sche_schedule_blocks_select" ON public.sche_schedule_blocks FOR SELECT TO authenticated USING (true);

-- Admin policies
DROP POLICY IF EXISTS "sche_admin_all_courses" ON public.sche_courses;
CREATE POLICY "sche_admin_all_courses" ON public.sche_courses FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

DROP POLICY IF EXISTS "sche_admin_all_sections" ON public.sche_sections;
CREATE POLICY "sche_admin_all_sections" ON public.sche_sections FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

DROP POLICY IF EXISTS "sche_admin_all_blocks" ON public.sche_schedule_blocks;
CREATE POLICY "sche_admin_all_blocks" ON public.sche_schedule_blocks FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

-- Index for period filtering
CREATE INDEX IF NOT EXISTS idx_sche_sections_periodo ON public.sche_sections(periodo);
