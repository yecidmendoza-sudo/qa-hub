-- Migration: Fix DB integrity issues found in audit
-- Date: 2026-08-05

-- 1. UNIQUE constraint en personal_matrix_versions
-- Previene race condition donde dos inserciones concurrentes
-- podrían crear dos versiones con el mismo version_num para el mismo folder.
ALTER TABLE personal_matrix_versions
  ADD CONSTRAINT personal_matrix_versions_folder_version_unique
  UNIQUE (folder_id, version_num);

-- 2. Índice en test_cases.cycle_id (queries frecuentes por ciclo)
CREATE INDEX IF NOT EXISTS idx_test_cases_cycle_id
  ON test_cases(cycle_id);

-- 3. Índice en test_executions.cycle_id (joins frecuentes)
CREATE INDEX IF NOT EXISTS idx_test_executions_cycle_id
  ON test_executions(cycle_id);

-- 4. Índice en test_executions.case_id (upserts frecuentes)
CREATE INDEX IF NOT EXISTS idx_test_executions_case_id
  ON test_executions(case_id);

-- 5. Índice en personal_matrix_versions.folder_id (queries por folder)
CREATE INDEX IF NOT EXISTS idx_personal_matrix_versions_folder_id
  ON personal_matrix_versions(folder_id);

-- 6. Índice en personal_matrix_folders.qa_email (queries por usuario)
CREATE INDEX IF NOT EXISTS idx_personal_matrix_folders_qa_email
  ON personal_matrix_folders(qa_email);

-- 7. UNIQUE constraint en personal_matrix_folders (previene duplicados)
ALTER TABLE personal_matrix_folders
  ADD CONSTRAINT personal_matrix_folders_email_ticket_unique
  UNIQUE (qa_email, ticket_id);
