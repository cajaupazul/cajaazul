-- Migration: 20260510_create_library_books.sql
-- Description: Create library_books table for the Digital Library section

CREATE TABLE IF NOT EXISTS public.library_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    year INTEGER,
    cover_url TEXT,
    pdf_url TEXT,
    synopsis TEXT,
    editorial TEXT,
    rating NUMERIC DEFAULT 0,
    buy_links JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;

-- Policies
-- Everyone can view books
CREATE POLICY "Public read access for library_books" 
ON public.library_books FOR SELECT 
USING (true);

-- Only admins can manage books
CREATE POLICY "Admin write access for library_books" 
ON public.library_books FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR role = 'superadmin')
    )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_library_books_updated_at
BEFORE UPDATE ON public.library_books
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
