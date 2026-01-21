-- Enable RLS on main tables
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE professors ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- COURSES POLICIES
-- -------------------------------------------------------------------------

-- Drop potential existing policies to ensure clean state
DROP POLICY IF EXISTS "Courses are viewable by everyone" ON courses;
DROP POLICY IF EXISTS "Admins can insert courses" ON courses;
DROP POLICY IF EXISTS "Admins can update courses" ON courses;
DROP POLICY IF EXISTS "Admins can delete courses" ON courses;

-- Everyone can view courses
CREATE POLICY "Courses are viewable by everyone"
ON courses FOR SELECT
TO authenticated
USING (true);

-- Only Admins can insert courses
CREATE POLICY "Admins can insert courses"
ON courses FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin'))
);

-- Only Admins can update courses
CREATE POLICY "Admins can update courses"
ON courses FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin'))
)
WITH CHECK (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin'))
);

-- Only Admins can delete courses
CREATE POLICY "Admins can delete courses"
ON courses FOR DELETE
TO authenticated
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin'))
);

-- -------------------------------------------------------------------------
-- PROFESSORS POLICIES
-- -------------------------------------------------------------------------

-- Drop potential existing policies
DROP POLICY IF EXISTS "Professors are viewable by everyone" ON professors;
DROP POLICY IF EXISTS "Admins can insert professors" ON professors;
DROP POLICY IF EXISTS "Admins can update professors" ON professors;
DROP POLICY IF EXISTS "Admins can delete professors" ON professors;

-- Everyone can view professors
CREATE POLICY "Professors are viewable by everyone"
ON professors FOR SELECT
TO authenticated
USING (true);

-- Only Admins can insert professors
CREATE POLICY "Admins can insert professors"
ON professors FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin'))
);

-- Only Admins can update professors
CREATE POLICY "Admins can update professors"
ON professors FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin'))
)
WITH CHECK (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin'))
);

-- Only Admins can delete professors
CREATE POLICY "Admins can delete professors"
ON professors FOR DELETE
TO authenticated
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin'))
);

-- -------------------------------------------------------------------------
-- PROFESSOR COMMENTS POLICIES (Additional)
-- -------------------------------------------------------------------------

-- Note: Existing policies handle user viewing and deleting their own comments.
-- We add a policy to explicitly allow Admins to delete ANY comment.

DROP POLICY IF EXISTS "Admins can delete any professor comment" ON professor_comments;

CREATE POLICY "Admins can delete any professor comment"
ON professor_comments FOR DELETE
TO authenticated
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin'))
);
