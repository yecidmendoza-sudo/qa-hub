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

export const deleteVersion = async (
  projectId: string,
  versionId: string,
  versionName: string,
  userEmail: string
) => {
  await supabase.from('test_versions').delete().eq('id', versionId);
  await logAudit(projectId, userEmail, 'DELETED', 'VERSION', versionId, {
    name: versionName,
  });
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
  await supabase.from('test_cycles').delete().eq('id', cycleId);
  await logAudit(projectId, userEmail, 'DELETED', 'CYCLE', cycleId, {
    type: cycleType,
  });
};

export const fetchCycleFieldConfigs = async (projectId: string) => {
  const { data } = await supabase
    .from('cycle_field_configs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  return data || [];
};
