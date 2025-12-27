-- Add professor_id column to materials table
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS professor_id uuid REFERENCES public.professors(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_materials_professor ON public.materials(professor_id);
