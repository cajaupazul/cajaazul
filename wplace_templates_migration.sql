-- 1. Drop existing table to start fresh (Clean fix for the 500 error)
DROP TABLE IF EXISTS public.pixel_templates;

-- 2. Create the Templates Table with Slot Indexing
CREATE TABLE public.pixel_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL,
    slot_index INTEGER NOT NULL CHECK (slot_index BETWEEN 1 AND 3), -- Limit to 3 spaces
    image_data TEXT NOT NULL, -- Large Base64 (Not indexed)
    opacity FLOAT NOT NULL DEFAULT 0.5,
    grid_step INTEGER NOT NULL DEFAULT 1,
    world_x FLOAT NOT NULL DEFAULT 0,
    world_y FLOAT NOT NULL DEFAULT 0,
    scale FLOAT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- UNIQUE constraint on identifier + slot (Fixes the 8191 bytes error)
    UNIQUE(user_id, event_id, slot_index)
);

-- 3. Enable RLS
ALTER TABLE public.pixel_templates ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Users can manage their own templates"
    ON public.pixel_templates
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. Automatic Update of the 'updated_at' column
CREATE OR REPLACE FUNCTION update_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_update_template_timestamp
    BEFORE UPDATE ON public.pixel_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_template_timestamp();

-- 6. Index for fast fetching
CREATE INDEX idx_pixel_templates_user_event 
ON public.pixel_templates(user_id, event_id);
