-- Fix access control for Pixel Art Admin features

-- 1. Enable DELETE for Admins on pixel_board_state (for "Clear Canvas")
DROP POLICY IF EXISTS "Admins can delete board state" ON public.pixel_board_state;
CREATE POLICY "Admins can delete board state"
ON public.pixel_board_state
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'superadmin')
  )
);

-- 2. Allow Admins to UPDATE any pixel (Moderation)
-- We drop the simple "own user" policy and replace with "own user OR admin"
DROP POLICY IF EXISTS "Update board state" ON public.pixel_board_state;
CREATE POLICY "Update board state"
ON public.pixel_board_state
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'superadmin')
  )
)
WITH CHECK (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'superadmin')
  )
);
