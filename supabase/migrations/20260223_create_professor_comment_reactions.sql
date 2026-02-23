-- Create professor_comment_reactions table
CREATE TABLE IF NOT EXISTS professor_comment_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id uuid REFERENCES professor_comments(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    reaction_type text NOT NULL DEFAULT 'like',
    created_at timestamptz DEFAULT now(),
    UNIQUE(comment_id, user_id)
);

-- Enable RLS
ALTER TABLE professor_comment_reactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Reactions are viewable by everyone"
    ON professor_comment_reactions FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can manage own reactions"
    ON professor_comment_reactions FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Restrict direct updates to likes count in professor_comments
-- Stop "Anyone can update comment likes" policy
DROP POLICY IF EXISTS "Anyone can update comment likes" ON professor_comments;

CREATE POLICY "Comments are updated by owners or admins"
    ON professor_comments FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
    WITH CHECK (auth.uid() = user_id OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_professor_comment_reactions_comment ON professor_comment_reactions(comment_id);
