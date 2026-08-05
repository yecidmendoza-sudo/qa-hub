-- Migration: Audit fixes v2 — corrected
-- Date: 2026-08-05
-- Note: La migración 20260805000000 falló por cycle_id inexistente en test_executions.
--       Esta migración corrige todo idempotentemente.

-- 1. Agregar cycle_id a test_executions (denormalización para queries de ciclo)
--    Se backfill via JOIN con test_cases.
ALTER TABLE test_executions
  ADD COLUMN IF NOT EXISTS cycle_id uuid REFERENCES test_cycles(id) ON DELETE CASCADE;

-- Backfill cycle_id desde test_cases para filas existentes
UPDATE test_executions te
SET cycle_id = tc.cycle_id
FROM test_cases tc
WHERE te.case_id = tc.id
  AND te.cycle_id IS NULL;

-- 2. Índice en test_executions.cycle_id
CREATE INDEX IF NOT EXISTS idx_test_executions_cycle_id
  ON test_executions(cycle_id);

-- 3. Índice en test_cases.cycle_id
--    (puede existir implícitamente, IF NOT EXISTS garantiza idempotencia)
CREATE INDEX IF NOT EXISTS idx_test_cases_cycle_id
  ON test_cases(cycle_id);

-- 4. UNIQUE constraint en personal_matrix_versions(folder_id, version_num)
--    Previene race condition en version_num = count + 1
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

-- 5. UNIQUE constraint en personal_matrix_folders(qa_email, ticket_id)
--    Previene folders duplicados para el mismo tester+ticket
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

-- 6. Índice en test_executions.case_id si no existe
CREATE INDEX IF NOT EXISTS idx_test_executions_case_id
  ON test_executions(case_id);
