-- Nueva tabla para almacenar los ciclos activados por curso
CREATE TABLE IF NOT EXISTS course_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses ON DELETE CASCADE NOT NULL,
  ciclo_name text NOT NULL, -- Ej: '2026-1'
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles ON DELETE SET NULL,
  UNIQUE(course_id, ciclo_name)
);

ALTER TABLE course_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view course cycles"
  ON course_cycles FOR SELECT
  TO authenticated
  USING (true);

-- Permite que CUALQUIER USUARIO agruege ciclos a un curso (req del cliente)
CREATE POLICY "Users can add course cycles"
  ON course_cycles FOR INSERT
  TO authenticated
  WITH CHECK (true);
