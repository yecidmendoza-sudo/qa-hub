import { supabase } from '../supabase/client';
import { logAudit } from './auditService';

export const fetchVersionsWithCycles = async (projectId: string) => {
  const { data, error } = await supabase
    .from('test_versions')
    .select('*, test_cycles(*)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const fetchAuditLogs = async (projectId: string) => {
  const { data } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(200);
  return data || [];
};

export const createVersion = async (
  projectId: string,
  name: string,
  userEmail: string
) => {
  const { data, error } = await supabase
    .from('test_versions')
    .insert({ project_id: projectId, name })
    .select()
    .single();
  if (error) throw error;
  await logAudit(projectId, userEmail, 'NEW', 'VERSION', data.id, { name });
  return data;
};

// Helper: cascade delete all records for a cycle (executions → cases → ready to delete cycle)
async function deleteCycleCascade(cycleId: string) {
  // test_executions has a direct cycle_id column — no need to fetch case IDs first
  const { error: execErr } = await supabase
    .from('test_executions')
    .delete()
    .eq('cycle_id', cycleId);
  if (execErr) throw new Error(`Error borrando ejecuciones: ${execErr.message}`);

  const { error: casesErr } = await supabase
    .from('test_cases')
    .delete()
    .eq('cycle_id', cycleId);
  if (casesErr) throw new Error(`Error borrando casos: ${casesErr.message}`);
}

export const deleteVersion = async (
  projectId: string,
  versionId: string,
  versionName: string,
  userEmail: string
) => {
  // Get all cycles for this version and cascade-delete them
  const { data: cycles } = await supabase
    .from('test_cycles')
    .select('id')
    .eq('version_id', versionId);
  for (const cycle of (cycles || [])) {
    await deleteCycleCascade(cycle.id);
  }
  // Now delete cycles
  await supabase.from('test_cycles').delete().eq('version_id', versionId);
  // Finally delete the version
  const { error } = await supabase.from('test_versions').delete().eq('id', versionId);
  if (error) throw new Error(`No se pudo eliminar la versión: ${error.message}`);
  await logAudit(projectId, userEmail, 'DELETED', 'VERSION', versionId, { name: versionName });
};

export const createCycle = async (
  projectId: string,
  versionId: string,
  versionName: string,
  cycleType: string,
  customValues: Record<string, string>,
  userEmail: string
) => {
  const { data, error } = await supabase
    .from('test_cycles')
    .insert({
      project_id: projectId,
      version_id: versionId,
      version: versionName,
      type: cycleType,
      status: 'IN_PROGRESS',
      custom_values: customValues,
      custom_columns: [],
    })
    .select()
    .single();
  if (error) throw error;
  await logAudit(projectId, userEmail, 'NEW', 'CYCLE', data.id, {
    type: cycleType,
    version_name: versionName,
  });
  return data;
};

export const deleteCycle = async (
  projectId: string,
  cycleId: string,
  cycleType: string,
  userEmail: string
) => {
  // Cascade delete: executions → cases → cycle
  await deleteCycleCascade(cycleId);
  const { error } = await supabase.from('test_cycles').delete().eq('id', cycleId);
  if (error) throw new Error(`No se pudo eliminar el ciclo: ${error.message}`);
  await logAudit(projectId, userEmail, 'DELETED', 'CYCLE', cycleId, { type: cycleType });
};

export const fetchCycleFieldConfigs = async (projectId: string) => {
  const { data } = await supabase
    .from('cycle_field_configs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  return data || [];
};
