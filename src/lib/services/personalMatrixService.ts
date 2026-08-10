import { supabase } from '../supabase/client';

/**
 * Elimina una versión de matriz personal.
 * Si es la única versión del folder, elimina también el folder.
 */
export const deletePersonalMatrixVersion = async (
  versionId: string,
  folderId: string
): Promise<{ folderDeleted: boolean }> => {
  // Contar cuántas versiones quedan en el folder
  const { count } = await supabase
    .from('personal_matrix_versions')
    .select('id', { count: 'exact', head: true })
    .eq('folder_id', folderId);

  // Borrar la versión
  const { error: vErr } = await supabase
    .from('personal_matrix_versions')
    .delete()
    .eq('id', versionId);

  if (vErr) throw vErr;

  // Si era la única versión, borrar también el folder
  if ((count ?? 0) <= 1) {
    const { error: fErr } = await supabase
      .from('personal_matrix_folders')
      .delete()
      .eq('id', folderId);
    if (fErr) throw fErr;
    return { folderDeleted: true };
  }

  return { folderDeleted: false };
};

/**
 * Elimina un folder completo (todas sus versiones + el folder).
 */
export const deletePersonalMatrixFolder = async (
  folderId: string
): Promise<void> => {
  // Borrar todas las versiones del folder primero
  const { error: vErr } = await supabase
    .from('personal_matrix_versions')
    .delete()
    .eq('folder_id', folderId);

  if (vErr) throw vErr;

  // Borrar el folder
  const { error: fErr } = await supabase
    .from('personal_matrix_folders')
    .delete()
    .eq('id', folderId);

  if (fErr) throw fErr;
};

/**
 * Actualiza las notas de una versión de matriz personal.
 */
export const updatePersonalMatrixVersionNotes = async (
  versionId: string,
  notes: string
): Promise<void> => {
  const { error } = await supabase
    .from('personal_matrix_versions')
    .update({ notes })
    .eq('id', versionId);

  if (error) throw error;
};

// ── Types para el editor dinámico ─────────────────────────────────────────

export type MatrixCol = {
  id: string;
  name: string;
  type: 'text' | 'dropdown' | 'status';
  locked?: boolean;
  options?: string[];
};

export type MatrixRow = {
  id: string;
  cells: Record<string, string>;
};

export type MatrixData = {
  columns: MatrixCol[];
  rows: MatrixRow[];
};

// Mapea valores de status con emojis a strings limpios
function cleanStatusValue(val: string): string {
  const v = val.trim();
  if (v.includes('PASS') || v === '✅') return 'PASS';
  if (v.includes('FAIL') || v === '❌') return 'FAIL';
  if (v.includes('BLOCKED') || v === '🚫') return 'BLOCKED';
  return 'PENDING';
}

/**
 * Parsea el content_md de una versión personal en MatrixData.
 * Busca la primera tabla Markdown del contenido.
 */
export const parseMarkdownToMatrixData = (contentMd: string): MatrixData => {
  const lines = contentMd.split('\n');
  const tableLines: string[] = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true;
      tableLines.push(trimmed);
    } else if (inTable) {
      break;
    }
  }

  if (tableLines.length < 2) {
    return { columns: [{ id: 'col_0', name: 'Descripción', type: 'text' }], rows: [] };
  }

  // Parse headers (skip leading/trailing |)
  const headerLine = tableLines[0];
  const headerCells = headerLine.split('|').map(s => s.trim()).filter(Boolean);
  const columns: MatrixCol[] = headerCells.map((name, i) => {
    const nameLower = name.toLowerCase();
    const isStatus = nameLower === 'estado' || nameLower === 'status' || nameLower === 'state';
    return {
      id: `col_${i}`,
      name,
      type: isStatus ? 'status' : 'text',
    };
  });

  // Skip separator line (index 1), parse data rows
  const rows: MatrixRow[] = [];
  for (let i = 2; i < tableLines.length; i++) {
    const cells = tableLines[i].split('|').map(s => s.trim()).filter(Boolean);
    const rowCells: Record<string, string> = {};
    columns.forEach((col, ci) => {
      let val = cells[ci] ?? '';
      if (col.type === 'status') val = cleanStatusValue(val);
      rowCells[col.id] = val;
    });
    rows.push({ id: `row_${i - 2}`, cells: rowCells });
  }

  return { columns, rows };
};

/**
 * Serializa MatrixData a Markdown para mantener content_md sincronizado.
 */
export const serializeMatrixDataToMarkdown = (data: MatrixData, ticketId: string): string => {
  const header = `# Matriz — ${ticketId}`;
  const colHeader = `| ${data.columns.map(c => c.name).join(' | ')} |`;
  const colSep = `| ${data.columns.map(() => '---').join(' | ')} |`;
  const rowLines = data.rows.map(row =>
    `| ${data.columns.map(col => row.cells[col.id] ?? '').join(' | ')} |`
  );
  return [header, '', colHeader, colSep, ...rowLines].join('\n');
};

/**
 * Guarda matrix_data JSONB y regenera content_md como snapshot.
 */
export const updatePersonalMatrixData = async (
  versionId: string,
  matrixData: MatrixData,
  ticketId: string
): Promise<void> => {
  const contentMd = serializeMatrixDataToMarkdown(matrixData, ticketId);
  const { error } = await supabase
    .from('personal_matrix_versions')
    .update({ matrix_data: matrixData as unknown as Record<string, unknown>, content_md: contentMd })
    .eq('id', versionId);
  if (error) throw error;
};

/**
 * Carga una versión específica con su folder.
 */
export const getPersonalMatrixVersion = async (versionId: string) => {
  const { data, error } = await supabase
    .from('personal_matrix_versions')
    .select('*, personal_matrix_folders(ticket_id, project_name, qa_email)')
    .eq('id', versionId)
    .single();
  if (error) throw error;
  return data;
};
