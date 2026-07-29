-- ============================================================
-- FIX: Políticas RLS para tabla cycle_field_configs
-- 
-- PROBLEMA: La tabla tiene RLS habilitado pero no tiene
-- políticas que permitan INSERT, SELECT, UPDATE o DELETE
-- para usuarios autenticados. Esto causa error 403 al
-- hacer clic en "Añadir Campo" en Settings.
--
-- SOLUCIÓN: Agregar políticas para usuarios autenticados
-- que sean miembros del proyecto (via user_projects) o ADMIN.
-- ============================================================

-- 1) Asegurar que RLS está habilitado
ALTER TABLE cycle_field_configs ENABLE ROW LEVEL SECURITY;

-- 2) Política de SELECT: usuarios autenticados pueden leer
--    los campos de los proyectos a los que tienen acceso
CREATE POLICY "Users can view cycle_field_configs of their projects"
ON cycle_field_configs
FOR SELECT
TO authenticated
USING (
  project_id IN (
    SELECT up.project_id FROM user_projects up WHERE up.user_id = auth.uid()
  )
  OR
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
);

-- 3) Política de INSERT: solo ADMIN puede crear campos personalizados
CREATE POLICY "Admins can insert cycle_field_configs"
ON cycle_field_configs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
);

-- 4) Política de UPDATE: solo ADMIN puede modificar campos
CREATE POLICY "Admins can update cycle_field_configs"
ON cycle_field_configs
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
);

-- 5) Política de DELETE: solo ADMIN puede eliminar campos
CREATE POLICY "Admins can delete cycle_field_configs"
ON cycle_field_configs
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
);
