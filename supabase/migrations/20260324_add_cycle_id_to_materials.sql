ALTER TABLE materials ADD COLUMN IF NOT EXISTS cycle_id uuid REFERENCES course_cycles(id) ON DELETE SET NULL;
