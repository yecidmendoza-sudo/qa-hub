-- Migration: Add UNIQUE constraint on test_executions.case_id
-- Date: 2026-09-08
-- Reason: agent-report-results uses upsert with onConflict: "case_id"
--         but only an INDEX existed, not a UNIQUE constraint.
--         Each test_case has exactly one execution (1:1 relationship).

-- 1. Remove any duplicate executions per case_id (keep the one with the lowest id)
DELETE FROM test_executions
WHERE id NOT IN (
  SELECT MIN(id::text)::uuid
  FROM test_executions
  GROUP BY case_id
);

-- 2. Add UNIQUE constraint on case_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'test_executions_case_id_unique'
  ) THEN
    ALTER TABLE test_executions
      ADD CONSTRAINT test_executions_case_id_unique UNIQUE (case_id);
  END IF;
END $$;
