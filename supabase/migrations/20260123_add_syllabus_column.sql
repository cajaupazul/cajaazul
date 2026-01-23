-- Add syllabus_url column to grupos table
ALTER TABLE public.grupos ADD COLUMN IF NOT EXISTS syllabus_url TEXT;
