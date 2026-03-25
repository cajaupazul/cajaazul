ALTER TABLE course_cycles ADD COLUMN IF NOT EXISTS active_subfolders text[] DEFAULT '{}';

-- Users should be able to update to add subfolders
CREATE POLICY "Users can add subfolders to course cycles"
  ON course_cycles FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
