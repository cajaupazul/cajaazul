-- RESTORE COMMUNITY CONTRIBUTIONS
-- Allows all authenticated users to ADD professors and courses, while keeping UPDATE/DELETE restricted to admins.

-- 1. COURSES POLICIES
DROP POLICY IF EXISTS "Admins can insert courses" ON public.courses;
CREATE POLICY "Everyone authenticated can insert courses"
ON public.courses FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. PROFESSORS POLICIES
DROP POLICY IF EXISTS "Admins can insert professors" ON public.professors;
CREATE POLICY "Everyone authenticated can insert professors"
ON public.professors FOR INSERT
TO authenticated
WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professors ENABLE ROW LEVEL SECURITY;
