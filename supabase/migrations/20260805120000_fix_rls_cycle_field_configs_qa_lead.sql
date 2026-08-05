-- Migration: Permite que QA_LEAD gestione cycle_field_configs de sus propios proyectos
-- Fecha: 2026-08-05

-- ── 1. DROP políticas antiguas restrictivas (solo ADMIN) ──────────────────────
DROP POLICY IF EXISTS "Admins can insert cycle_field_configs" ON cycle_field_configs;
DROP POLICY IF EXISTS "Admins can update cycle_field_configs" ON cycle_field_configs;
DROP POLICY IF EXISTS "Admins can delete cycle_field_configs" ON cycle_field_configs;

-- ── 2. INSERT: ADMIN (cualquier proyecto) | QA_LEAD (solo sus proyectos) ───────
CREATE POLICY "Admins and leads can insert cycle_field_configs"
  ON cycle_field_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'ADMIN'
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN user_projects up ON up.user_id = p.id
      WHERE p.id = auth.uid()
        AND p.role = 'QA_LEAD'
        AND up.project_id = cycle_field_configs.project_id
    )
  );

-- ── 3. UPDATE: misma lógica ───────────────────────────────────────────────────
CREATE POLICY "Admins and leads can update cycle_field_configs"
  ON cycle_field_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'ADMIN'
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN user_projects up ON up.user_id = p.id
      WHERE p.id = auth.uid()
        AND p.role = 'QA_LEAD'
        AND up.project_id = cycle_field_configs.project_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'ADMIN'
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN user_projects up ON up.user_id = p.id
      WHERE p.id = auth.uid()
        AND p.role = 'QA_LEAD'
        AND up.project_id = cycle_field_configs.project_id
    )
  );

-- ── 4. DELETE: misma lógica ───────────────────────────────────────────────────
CREATE POLICY "Admins and leads can delete cycle_field_configs"
  ON cycle_field_configs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'ADMIN'
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN user_projects up ON up.user_id = p.id
      WHERE p.id = auth.uid()
        AND p.role = 'QA_LEAD'
        AND up.project_id = cycle_field_configs.project_id
    )
  );
