-- Migration: Add frame_settings column to shop_items
-- This stores the visual adjustments (scale, x, y) for each context

ALTER TABLE public.shop_items
ADD COLUMN IF NOT EXISTS frame_settings JSONB DEFAULT '{
  "profile": {"scale": 1.0, "x": 0, "y": 0},
  "card": {"scale": 1.0, "x": 0, "y": 0},
  "navbar": {"scale": 1.0, "x": 0, "y": 0}
}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.shop_items.frame_settings IS 'Visual adjustment settings for frame display in different contexts (profile, card, navbar). Each context has scale, x offset, and y offset.';
