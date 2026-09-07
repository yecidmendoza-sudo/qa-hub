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

/**
 * Una sección representa un bloque de tabla del markdown.
 * El título proviene del heading (## / ###) inmediatamente anterior a la tabla.
 */
export type MatrixSection = {
  id: string;
  title: string;
  columns: MatrixCol[];
  rows: MatrixRow[];
};

/**
 * MatrixData soporta múltiples secciones.
 * `sections` es el formato nuevo (multi-tabla).
 * `columns` / `rows` son legacy (v1) — normalizar con normalizeSections().
 */
export type MatrixData = {
  sections?: MatrixSection[];
  // Legacy single-table format (backward compat)
  columns?: MatrixCol[];
  rows?: MatrixRow[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Mapea valores de status con emojis/texto a strings limpios */
function cleanStatusValue(val: string): string {
  const v = val.trim();
  if (v.includes('PASS') || v === '✅') return 'PASS';
  if (v.includes('FAIL') || v === '❌') return 'FAIL';
  if (v.includes('BLOCKED') || v === '🚫') return 'BLOCKED';
  return 'PENDING';
}

const STATUS_COL_NAMES = new Set(['estado', 'status', 'state']);

/**
 * Normaliza cualquier formato de MatrixData al array de secciones.
 * Backward compat: si el JSONB tiene { columns, rows } (formato viejo),
 * lo envuelve en una sección sin título.
 */
export function normalizeSections(data: MatrixData): MatrixSection[] {
  if (data.sections && data.sections.length > 0) {
    return data.sections;
  }
  // Legacy format: wrap in a single nameless section
  if (data.columns && data.rows) {
    return [
      {
        id: 'section_0',
        title: '',
        columns: data.columns,
        rows: data.rows,
      },
    ];
  }
  return [];
}

/**
 * Parsea content_md extrayendo TODAS las tablas como secciones.
 * Asocia cada tabla con el heading (## / ###) inmediatamente anterior.
 * No hace `break` en el primer salto — extrae el markdown completo.
 */
export const parseMarkdownToMatrixData = (contentMd: string): MatrixData => {
  const lines = contentMd.split('\n');
  const sections: MatrixSection[] = [];
  let currentHeading = '';
  let tableBuffer: string[] = [];
  let inTable = false;

  const flushTable = (heading: string, buf: string[]) => {
    if (buf.length < 2) return;

    // Row 0: headers
    const headerCells = buf[0].split('|').map(s => s.trim()).filter(Boolean);
    const columns: MatrixCol[] = headerCells.map((name, i) => ({
      id: `col_${i}`,
      name,
      type: STATUS_COL_NAMES.has(name.toLowerCase()) ? 'status' : 'text',
    }));

    // Row 1: separator — skip; Rows 2+: data
    const rows: MatrixRow[] = [];
    for (let ri = 2; ri < buf.length; ri++) {
      const cells = buf[ri].split('|').map(s => s.trim()).filter(s => s !== '');
      const rowCells: Record<string, string> = {};
      columns.forEach((col, ci) => {
        let val = cells[ci] ?? '';
        if (col.type === 'status') val = cleanStatusValue(val);
        rowCells[col.id] = val;
      });
      rows.push({ id: `row_${ri - 2}`, cells: rowCells });
    }

    sections.push({
      id: `section_${sections.length}`,
      title: heading,
      columns,
      rows,
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect heading (only outside a table)
    if (!inTable && /^#{2,3}\s+/.test(trimmed)) {
      currentHeading = trimmed.replace(/^#{2,3}\s+/, '').trim();
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true;
      tableBuffer.push(trimmed);
    } else if (inTable) {
      // End of current table block — flush it
      flushTable(currentHeading, tableBuffer);
      tableBuffer = [];
      inTable = false;
      currentHeading = '';
    }
  }
  // Flush last table if file ends while still in a table
  if (inTable && tableBuffer.length > 0) {
    flushTable(currentHeading, tableBuffer);
  }

  if (sections.length === 0) {
    return {
      sections: [
        {
          id: 'section_0',
          title: '',
          columns: [{ id: 'col_0', name: 'Descripción', type: 'text' }],
          rows: [],
        },
      ],
    };
  }

  return { sections };
};

/**
 * Serializa MatrixData (multi-sección) a Markdown para mantener content_md sincronizado.
 */
export const serializeMatrixDataToMarkdown = (
  sections: MatrixSection[],
  ticketId: string
): string => {
  const parts: string[] = [`# Matriz — ${ticketId}`, ''];

  for (const sec of sections) {
    if (sec.title) {
      parts.push(`### ${sec.title}`, '');
    }
    parts.push(`| ${sec.columns.map(c => c.name).join(' | ')} |`);
    parts.push(`| ${sec.columns.map(() => '---').join(' | ')} |`);
    for (const row of sec.rows) {
      parts.push(`| ${sec.columns.map(col => row.cells[col.id] ?? '').join(' | ')} |`);
    }
    parts.push('');
  }

  return parts.join('\n').trim();
};

/**
 * Guarda matrix_data JSONB y regenera content_md como snapshot.
 */
export const updatePersonalMatrixData = async (
  versionId: string,
  sections: MatrixSection[],
  ticketId: string
): Promise<void> => {
  const matrixData: MatrixData = { sections };
  const contentMd = serializeMatrixDataToMarkdown(sections, ticketId);
  const { error } = await supabase
    .from('personal_matrix_versions')
    .update({
      matrix_data: matrixData as unknown as Record<string, unknown>,
      content_md: contentMd,
    })
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


