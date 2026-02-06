-- 1. Create the Templates Table
CREATE TABLE IF NOT EXISTS public.pixel_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL,
    image_data TEXT NOT NULL, -- Base64 or URL
    opacity FLOAT NOT NULL DEFAULT 0.5,
    grid_step INTEGER NOT NULL DEFAULT 1,
    world_x FLOAT NOT NULL DEFAULT 0,
    world_y FLOAT NOT NULL DEFAULT 0,
    scale FLOAT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Composite unique constraint to manage the 3 slots per user/event/image
    UNIQUE(user_id, event_id, image_data)
);

-- 2. Enable RLS
ALTER TABLE public.pixel_templates ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Users can manage their own templates"
    ON public.pixel_templates
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. Automatic Update of the 'updated_at' column
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

-- 5. Index for fast fetching of recent slots
CREATE INDEX IF NOT EXISTS idx_pixel_templates_user_event 
ON public.pixel_templates(user_id, event_id, updated_at DESC);
