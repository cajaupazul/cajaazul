-- PRODUCTION RLS CONFIGURATION
-- Run this in your Supabase SQL Editor to enable data loading in Vercel

----------------------------------------------------------------
-- 1. COURSES: Public Read (Authenticated), Admin Write
----------------------------------------------------------------
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read courses" ON public.courses;
CREATE POLICY "Authenticated users can read courses" 
ON public.courses FOR SELECT 
TO authenticated 
USING (true);

-- Note: No INSERT/UPDATE/DELETE policies are added here. 
-- This makes the table "Read Only" for regular users.

----------------------------------------------------------------
-- 2. PROFESSORS: Public Read (Authenticated), Admin Write
----------------------------------------------------------------
ALTER TABLE public.professors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read professors" ON public.professors;
CREATE POLICY "Authenticated users can read professors" 
ON public.professors FOR SELECT 
TO authenticated 
USING (true);

----------------------------------------------------------------
-- 3. MATERIALS: Public Read, Owner Write/Delete
----------------------------------------------------------------
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- Allow reading all materials
DROP POLICY IF EXISTS "Authenticated users can read materials" ON public.materials;
CREATE POLICY "Authenticated users can read materials" 
ON public.materials FOR SELECT 
TO authenticated 
USING (true);

-- Allow inserting own materials
DROP POLICY IF EXISTS "Users can upload their own materials" ON public.materials;
CREATE POLICY "Users can upload their own materials" 
ON public.materials FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Allow updating own materials
DROP POLICY IF EXISTS "Users can update their own materials" ON public.materials;
CREATE POLICY "Users can update their own materials" 
ON public.materials FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow deleting own materials
DROP POLICY IF EXISTS "Users can delete their own materials" ON public.materials;
CREATE POLICY "Users can delete their own materials" 
ON public.materials FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

----------------------------------------------------------------
-- 4. PROFILE SECURITY (Redundant but safe)
----------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can see profiles" ON public.profiles;
CREATE POLICY "Authenticated users can see profiles" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

----------------------------------------------------------------
-- 5. ADMIN RECOMMENDATION (How to handle writes later)
----------------------------------------------------------------
-- If you want to allow a specific user to edit courses/professors, 
-- you can add a 'is_admin' column to 'profiles' and add a policy like:
-- CREATE POLICY "Admins can do everything" ON courses FOR ALL TO authenticated USING 
-- ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = true);
