-- Migration: 20260603_create_course_grading_formulas.sql
-- Description: Create course_grading_formulas table for course evaluation configuration

CREATE TABLE IF NOT EXISTS public.course_grading_formulas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE UNIQUE,
    formula_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.course_grading_formulas ENABLE ROW LEVEL SECURITY;

-- Policies
-- Everyone can view grading formulas
CREATE POLICY "Public read access for course_grading_formulas" 
ON public.course_grading_formulas FOR SELECT 
USING (true);

-- Only admins/superadmins can manage grading formulas
CREATE POLICY "Admin write access for course_grading_formulas" 
ON public.course_grading_formulas FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR role = 'superadmin')
    )
);

-- Trigger for updated_at
CREATE TRIGGER set_course_grading_formulas_updated_at
BEFORE UPDATE ON public.course_grading_formulas
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
