-- Migration: Add DELETE policies for personal_matrix_versions and personal_matrix_folders
-- Allows QAs to delete versions and folders they own, or ADMIN to delete any.

-- 1. DELETE policy for personal_matrix_versions
DROP POLICY IF EXISTS "QA can delete their own matrix versions" ON personal_matrix_versions;
CREATE POLICY "QA can delete their own matrix versions"
  ON personal_matrix_versions
  FOR DELETE
  TO authenticated
  USING (
    folder_id IN (
      SELECT personal_matrix_folders.id
      FROM personal_matrix_folders
      WHERE personal_matrix_folders.qa_email = (auth.jwt() ->> 'email'::text)
         OR personal_matrix_folders.qa_email = auth.email()
    )
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'ADMIN'::text
    )
  );

-- 2. DELETE policy for personal_matrix_folders
DROP POLICY IF EXISTS "QA can delete their own matrix folders" ON personal_matrix_folders;
CREATE POLICY "QA can delete their own matrix folders"
  ON personal_matrix_folders
  FOR DELETE
  TO authenticated
  USING (
    qa_email = (auth.jwt() ->> 'email'::text)
    OR qa_email = auth.email()
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'ADMIN'::text
    )
  );
