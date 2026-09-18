-- Migration: expand test_executions status check constraint
-- Adds SKIP and IMPROVEMENT to the allowed status values.
-- Previously: PASS | FAIL | BLOCKED | PENDING
-- Now:        PASS | FAIL | BLOCKED | PENDING | SKIP | IMPROVEMENT

ALTER TABLE test_executions
  DROP CONSTRAINT IF EXISTS test_executions_status_check;

ALTER TABLE test_executions
  ADD CONSTRAINT test_executions_status_check
  CHECK (status = ANY (ARRAY[
    'PASS'::text,
    'FAIL'::text,
    'BLOCKED'::text,
    'PENDING'::text,
    'SKIP'::text,
    'IMPROVEMENT'::text
  ]));
