-- Link orphaned materials to the single professor of the course
-- This query finds materials with no professor assigned (professor_id IS NULL)
-- It checks if the course they belong to has EXACTLY one professor assigned.
-- If so, it updates the material to belong to that professor.

UPDATE materials
SET professor_id = (
  SELECT cp.professor_id
  FROM course_professors cp
  WHERE cp.course_id = materials.course_id
  LIMIT 1
)
WHERE professor_id IS NULL
AND course_id IN (
  SELECT course_id
  FROM course_professors
  GROUP BY course_id
  HAVING COUNT(*) = 1
);
