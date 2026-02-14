-- EMERGENCY FIX SCRIPT
-- This script resolves both the "missing metadata column" error and the "400 Bad Request" on Realtime.

-- 1. Ensure 'metadata' column exists in 'events' table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'metadata') THEN
        ALTER TABLE public.events ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Restore 'pixel_board_state' to Supabase Realtime publication (Safe Mode)
DO $$
BEGIN
    -- Only add to publication if it's not already there
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'pixel_board_state'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pixel_board_state;
    END IF;
END $$;

-- 3. Set Replica Identity to FULL to support Realtime deletes and updates
ALTER TABLE public.pixel_board_state REPLICA IDENTITY FULL;

-- 4. Force Schema Cache Reload (by notifying the reloader channel)
NOTIFY pgrst, 'reload config';
