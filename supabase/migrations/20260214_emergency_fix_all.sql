-- EMERGENCY FIX SCRIPT
-- This script resolves both the "missing metadata column" error and the "400 Bad Request" on Realtime.

-- 1. Ensure 'metadata' column exists in 'events' table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'metadata') THEN
        ALTER TABLE public.events ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Restore 'pixel_board_state' to Supabase Realtime publication
-- (Required because recreating the table removed it from the publication)
ALTER PUBLICATION supabase_realtime ADD TABLE public.pixel_board_state;

-- 3. Set Replica Identity to FULL to support Realtime deletes and updates
ALTER TABLE public.pixel_board_state REPLICA IDENTITY FULL;

-- 4. Force Schema Cache Reload (by notifying the reloader channel)
NOTIFY pgrst, 'reload config';
