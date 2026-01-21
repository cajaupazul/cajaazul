-- MASTER FIX: RLS & AUTOMATIC PROFILE CREATION
-- Run this in the Supabase SQL Editor

-- 1. Robust Trigger for Automatic Profile Creation (Cause #1)
-- This ensures that whenever a user signs up via EMAIL or Google, a profile is created INSTANTLY.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, universidad, carrera, puntos)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1), 'Estudiante'),
    COALESCE(new.raw_user_meta_data->>'universidad', 'Mi Universidad'),
    COALESCE(new.raw_user_meta_data->>'carrera', 'Carrera General'),
    0
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Backfill missing profiles for existing users
INSERT INTO public.profiles (id, nombre, universidad, carrera, puntos)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'nombre', split_part(email, '@', 1), 'Estudiante'),
  COALESCE(raw_user_meta_data->>'universidad', 'Mi Universidad'),
  COALESCE(raw_user_meta_data->>'carrera', 'Carrera General'),
  0
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

-- 3. Fix RLS Policies for SELECT (Cause #2)
-- Ensure all authenticated users can READ core data
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public select profiles" ON public.profiles;
CREATE POLICY "Public select profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public select courses" ON public.courses;
CREATE POLICY "Public select courses" ON public.courses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public select materials" ON public.materials;
CREATE POLICY "Public select materials" ON public.materials FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public select professors" ON public.professors;
CREATE POLICY "Public select professors" ON public.professors FOR SELECT TO authenticated USING (true);

-- 4. Ensure RLS for Profile UPDATES
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 5. Fix potential table name discrepancy (Cause #3)
-- Some queries use 'ratings', others use 'professor_ratings'.
-- We ensure both are accessible or one is an alias.
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ratings') 
     AND NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'professor_ratings') THEN
    ALTER TABLE public.ratings RENAME TO professor_ratings;
  END IF;
END $$;
