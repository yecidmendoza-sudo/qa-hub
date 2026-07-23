import { supabase } from '../supabase/client';
import { logAudit } from './auditService';

export const fetchMatrix = async (cycleId: string) => {
  const [{ data: cycle }, { data: cases }] = await Promise.all([
    supabase.from('test_cycles').select('*').eq('id', cycleId).single(),
    supabase
      .from('test_cases')
      .select('*, executions:test_executions(*)')
      .eq('cycle_id', cycleId)
      .order('created_at', { ascending: true }),
  ]);
  return { cycle, cases: cases || [] };
};

export const addCustomColumn = async (
  cycle: any,
  colName: string,
  colType: string,
  colOptions: string[],
  userEmail: string
) => {
  const newCol = {
    id: `col_${Date.now()}`,
    name: colName,
    type: colType,
    options: colOptions,
  };
  const updatedCols = [...(cycle.custom_columns || []), newCol];
  const { error } = await supabase
    .from('test_cycles')
    .update({ custom_columns: updatedCols })
    .eq('id', cycle.id);
  if (error) throw error;
  await logAudit(cycle.project_id, userEmail, 'Añadió Columna', 'MATRIX', cycle.id, {
    columna: colName,
    tipo: colType,
  });
  return updatedCols;
};

export const deleteCustomColumn = async (
  cycle: any,
  colIdentifier: string,
  userEmail: string
) => {
  const target = String(colIdentifier).trim();
  const updatedCols = (cycle.custom_columns || []).filter((c: any) => {
    const cId = c.id ? String(c.id).trim() : null;
    const cName = c.name ? String(c.name).trim() : null;
    if (cId && cId === target) return false;
    if (cName === target) return false;
    return true;
  });
  const { error } = await supabase
    .from('test_cycles')
    .update({ custom_columns: updatedCols })
    .eq('id', cycle.id);
  if (error) throw error;
  await logAudit(cycle.project_id, userEmail, 'Eliminó Columna', 'MATRIX', cycle.id, {
    columna: target,
  });
  return updatedCols;
};

export const updateCustomData = async (
  caseId: string,
  existingData: Record<string, any>,
  colId: string,
  value: string
) => {
  const updatedData = { ...existingData, [colId]: value };
  await supabase.from('test_cases').update({ custom_data: updatedData }).eq('id', caseId);
  return updatedData;
};

export const updateExecution = async (
  cycle: any,
  testCase: any,
  newStatus: string,
  existingExecutionId: string | null,
  userEmail: string
) => {
  if (existingExecutionId) {
    await supabase
      .from('test_executions')
      .update({ status: newStatus })
      .eq('id', existingExecutionId);
  } else {
    await supabase
      .from('test_executions')
      .insert({ case_id: testCase.id, status: newStatus });
  }
  await logAudit(
    cycle.project_id,
    userEmail,
    `Cambió Estado a ${newStatus}`,
    'MATRIX',
    cycle.id,
    { ticket_id: testCase.ticket_id, title: testCase.title }
  );
};

export const addTestCase = async (cycleId: string, count: number) => {
  const { data, error } = await supabase
    .from('test_cases')
    .insert({
      cycle_id: cycleId,
      ticket_id: `TC-${count + 1}`,
      module: '',
      title: '',
      expected_result: '',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteTestCase = async (caseId: string) => {
  await supabase.from('test_executions').delete().eq('case_id', caseId);
  await supabase.from('test_cases').delete().eq('id', caseId);
};

export const updateTestCaseField = async (
  caseId: string,
  field: string,
  value: string
) => {
  await supabase.from('test_cases').update({ [field]: value }).eq('id', caseId);
};

export const updateObservation = async (executionId: string, value: string) => {
  await supabase.from('test_executions').update({ observation: value }).eq('id', executionId);
};

export const downloadTemplate = (cycle: any) => {
  const customCols = cycle?.custom_columns || [];
  const headers = ['Ticket ID', 'Task Name', 'Modulo', 'Expected Result'];
  customCols.forEach((col: any) => headers.push(col.name));
  const csvContent = headers.join(',') + '\n';
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `plantilla_${cycle?.type}_${cycle?.version}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
