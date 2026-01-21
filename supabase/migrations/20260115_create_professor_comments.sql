-- Create professor_comments table
CREATE TABLE IF NOT EXISTS professor_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid REFERENCES professors(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  contenido text NOT NULL,
  parent_id uuid REFERENCES professor_comments(id) ON DELETE CASCADE,
  likes integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE professor_comments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Professor comments are viewable by everyone"
  ON professor_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own professor comments"
  ON professor_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can update comment likes"
  ON professor_comments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own professor comments"
  ON professor_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_professor_comments_professor ON professor_comments(professor_id);
CREATE INDEX IF NOT EXISTS idx_professor_comments_parent ON professor_comments(parent_id);
