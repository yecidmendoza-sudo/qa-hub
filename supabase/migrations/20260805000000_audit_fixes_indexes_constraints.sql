-- Migration: Audit fixes — indexes and constraints (safe version)
-- Date: 2026-08-05
-- NOTE: cycle_id en test_executions se maneja en la migración 000001

-- 1. Índice en test_cases.cycle_id
CREATE INDEX IF NOT EXISTS idx_test_cases_cycle_id
  ON test_cases(cycle_id);

-- 2. Índice en test_executions.case_id
CREATE INDEX IF NOT EXISTS idx_test_executions_case_id
  ON test_executions(case_id);

-- 3. UNIQUE constraint en personal_matrix_versions(folder_id, version_num)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'personal_matrix_versions_folder_version_unique'
  ) THEN
    ALTER TABLE personal_matrix_versions
      ADD CONSTRAINT personal_matrix_versions_folder_version_unique
      UNIQUE (folder_id, version_num);
  END IF;
END $$;

-- 4. UNIQUE constraint en personal_matrix_folders(qa_email, ticket_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'personal_matrix_folders_email_ticket_unique'
  ) THEN
    ALTER TABLE personal_matrix_folders
      ADD CONSTRAINT personal_matrix_folders_email_ticket_unique
      UNIQUE (qa_email, ticket_id);
  END IF;
END $$;
