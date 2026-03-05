-- Add course_name column to professor_ratings and professor_comments
ALTER TABLE public.professor_ratings ADD COLUMN IF NOT EXISTS course_name text;
ALTER TABLE public.professor_comments ADD COLUMN IF NOT EXISTS course_name text;

-- Update unique constraint on professor_ratings to allow one rating per course per user
-- First, find the existing unique constraint name
DO $$ 
DECLARE
    const_name text;
BEGIN
    -- This assumes there's only one unique constraint on (professor_id, user_id)
    SELECT conname INTO const_name
    FROM pg_constraint 
    WHERE conrelid = 'public.professor_ratings'::regclass 
    AND contype = 'u'
    AND array_to_string(conkey, ',') = (
        SELECT array_to_string(array_agg(attnum), ',')
        FROM pg_attribute
        WHERE attrelid = 'public.professor_ratings'::regclass
        AND attname IN ('professor_id', 'user_id')
    );

    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.professor_ratings DROP CONSTRAINT ' || const_name;
    END IF;
END $$;

-- Add the new composite unique constraint
ALTER TABLE public.professor_ratings ADD CONSTRAINT professor_ratings_professor_id_user_id_course_name_key UNIQUE (professor_id, user_id, course_name);
