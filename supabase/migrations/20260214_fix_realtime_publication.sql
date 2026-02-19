    -- Add pixel_board_state back to the realtime publication
-- This is necessary because the table was dropped and recreated, which removes it from the publication.

-- 1. Add table to supabase_realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pixel_board_state;

-- 2. Set Replica Identity to FULL to ensure DELETE/UPDATE events contain all columns
-- This helps with composite primary keys in Realtime
ALTER TABLE public.pixel_board_state REPLICA IDENTITY FULL;
