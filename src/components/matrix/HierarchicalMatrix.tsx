import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import TextCellPopover from './TextCellPopover';

// ─── Props ────────────────────────────────────────────────────────────────────
interface HierarchicalMatrixProps {
  cases: any[];
  cycle: any;
  effectiveCols: any[];
  canManage: boolean;
  onStatusChange: (testCase: any, status: string) => void;
  onCellBlur: (caseId: string, field: string, value: string) => void;
  onCustomDataChange: (caseId: string, existingData: any, colId: string, value: string) => void;
  onObservationSave: (executionId: string, val: string) => Promise<void>;
  onDeleteRow: (caseId: string) => void;
}

// ─── Status styles ────────────────────────────────────────────────────────────
const STATUS_SELECT_CLS: Record<string, string> = {
  PASS:        'bg-green-100  text-green-800  border-green-300  focus:ring-green-400',
  FAIL:        'bg-red-100    text-red-800    border-red-300    focus:ring-red-400',
  BLOCKED:     'bg-yellow-100 text-yellow-800 border-yellow-300 focus:ring-yellow-400',
  SKIP:        'bg-slate-100  text-slate-700  border-slate-300  focus:ring-slate-400',
  IMPROVEMENT: 'bg-purple-100 text-purple-800 border-purple-300 focus:ring-purple-400',
  PENDING:     'bg-gray-100   text-gray-700   border-gray-300   focus:ring-gray-400',
};

// ─── IDs that are ALWAYS data columns (never hierarchy) ───────────────────────
const DATA_ONLY_COL_IDS = new Set([
  'assignees', 'dark_mode', 'light_mode', '_observation', 'ticket',
  'severity', 'notes', 'qa_reviewer', 'priority', 'preconditions',
  'resolution', 'avance', '_title', '_expected_result',
]);

function getHierarchyColIds(effectiveCols: any[], maxDepth: number): Set<string> {
  const candidates = effectiveCols.filter(c => !DATA_ONLY_COL_IDS.has(c.id));
  const hierIds = new Set<string>();
  for (let i = 0; i < Math.min(candidates.length, maxDepth); i++) {
    hierIds.add(candidates[i].id);
  }
  return hierIds;
}

// ─── Row with rowSpan metadata ────────────────────────────────────────────────
interface ProcessedRow {
  caseData: any;
  visibleIndex: number;
  parts: string[];
  firstAtLevel: boolean[];
  spanAtLevel: number[];
}

function buildRows(cases: any[]): ProcessedRow[] {
  if (!cases.length) return [];

  const rows: ProcessedRow[] = cases.map((c, i) => {
    const path: string = c.custom_data?.hierarchy_path || c.title || '';
    const parts = path ? path.split(' > ') : [c.title || ''];
    return {
      caseData: c,
      visibleIndex: i + 1,
      parts,
      firstAtLevel: new Array(parts.length).fill(false),
      spanAtLevel: new Array(parts.length).fill(1),
    };
  });

  const maxLevels = rows.reduce((max, r) => Math.max(max, r.parts.length), 0);

  for (let lvl = 0; lvl < maxLevels; lvl++) {
    let groupStart = -1;
    let groupKey = '\x00';

    const closeGroup = (endIdx: number) => {
      if (groupStart >= 0) {
        rows[groupStart].firstAtLevel[lvl] = true;
        rows[groupStart].spanAtLevel[lvl] = endIdx - groupStart;
        groupStart = -1;
      }
    };

    for (let r = 0; r < rows.length; r++) {
      const parts = rows[r].parts;
      if (lvl >= parts.length) { closeGroup(r); groupKey = '\x00'; continue; }
      const key = parts.slice(0, lvl + 1).join('\x01');
      if (key !== groupKey) { closeGroup(r); groupStart = r; groupKey = key; }
    }
    closeGroup(rows.length);
  }

  return rows;
}

// ─── Color palette per depth ──────────────────────────────────────────────────
// Darker for higher levels (root), lighter as we go deeper
const LEVEL_STYLES = [
  { bg: '#1e293b', color: '#f1f5f9', border: '#0f172a' }, // level 0 - darkest
  { bg: '#334155', color: '#f1f5f9', border: '#1e293b' },
  { bg: '#475569', color: '#f8fafc', border: '#334155' },
  { bg: '#64748b', color: '#f8fafc', border: '#475569' },
  { bg: '#94a3b8', color: '#0f172a', border: '#64748b' },
  { bg: '#cbd5e1', color: '#0f172a', border: '#94a3b8' },
  { bg: '#e2e8f0', color: '#334155', border: '#cbd5e1' },
  { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
  { bg: '#f8fafc', color: '#64748b', border: '#f1f5f9' },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HierarchicalMatrix({
  cases,
  effectiveCols,
  canManage,
  onStatusChange,
  onCellBlur,
  onCustomDataChange,
  onObservationSave,
  onDeleteRow,
}: HierarchicalMatrixProps) {

  const maxDepth = useMemo(() =>
    cases.reduce((max, c) => {
      const path: string = c.custom_data?.hierarchy_path || '';
      return Math.max(max, path ? path.split(' > ').length : 1);
    }, 1)
  , [cases]);

  const hierarchyColIds = useMemo(() => getHierarchyColIds(effectiveCols, maxDepth), [effectiveCols, maxDepth]);
  const dataCols = useMemo(() => effectiveCols.filter(c => !hierarchyColIds.has(c.id)), [effectiveCols, hierarchyColIds]);
  const numLevels = maxDepth;

  // No collapse state — all rows always visible
  const rows = useMemo(() => buildRows(cases), [cases]);

  if (!rows.length) {
    return (
      <tr>
        <td colSpan={99} className="px-6 py-10 text-center text-gray-400 text-sm">
          No hay casos de prueba.
        </td>
      </tr>
    );
  }

  return (
    <>
      {rows.map(row => {
        const c = row.caseData;
        const exec = c.executions?.[0] || {};
        const status: string = exec.status || 'PENDING';
        const cd = c.custom_data || {};

        return (
          <tr
            key={c.id}
            className="group border-b border-gray-100 hover:bg-blue-50/10 transition-colors"
          >
            {/* ── Row # ─────────────────────────────────────────────────────── */}
            <td className="px-3 py-2 text-xs font-bold text-blue-400 whitespace-nowrap border-r border-gray-200 align-middle w-[50px] bg-white">
              {row.visibleIndex}
            </td>

            {/* ── Hierarchy cells — pure rowSpan, NO click/collapse ─────────── */}
            {Array.from({ length: numLevels }, (_, lvl) => {
              const isFirst = lvl < row.firstAtLevel.length ? row.firstAtLevel[lvl] : false;
              const span    = lvl < row.spanAtLevel.length  ? row.spanAtLevel[lvl]  : 1;
              const label   = lvl < row.parts.length        ? row.parts[lvl]        : '';

              // Not the owner of this slot → skip (rowSpan covers it)
              if (lvl < row.parts.length && !isFirst) return null;

              // This level doesn't exist for this row
              if (lvl >= row.parts.length) {
                return (
                  <td
                    key={`h${lvl}`}
                    className="border-r border-gray-100"
                    style={{ minWidth: 90, background: '#fafafa' }}
                  />
                );
              }

              const style = LEVEL_STYLES[Math.min(lvl, LEVEL_STYLES.length - 1)];
              const isGroup = span > 1;

              return (
                <td
                  key={`h${lvl}`}
                  rowSpan={span}
                  style={{
                    minWidth: 110,
                    maxWidth: 170,
                    verticalAlign: isGroup ? 'top' : 'middle',
                    background: style.bg,
                    borderRight: `2px solid ${style.border}`,
                    padding: '6px 10px',
                  }}
                >
                  {isGroup ? (
                    // Group header — static, no click
                    <div className="sticky top-14">
                      <span
                        className="inline-flex items-center gap-1 text-xs font-semibold leading-snug break-words"
                        style={{ color: style.color }}
                      >
                        {label}
                        <span style={{ opacity: 0.5, fontSize: '0.6rem', flexShrink: 0 }}>
                          ({span})
                        </span>
                      </span>
                    </div>
                  ) : (
                    // Leaf node
                    <span className="text-xs font-medium break-words" style={{ color: style.color }}>
                      {label}
                    </span>
                  )}
                </td>
              );
            })}

            {/* ── Data columns ─────────────────────────────────────────────── */}
            {dataCols.map((col: any) => {
              if (col.id === '_title') return (
                <td key="_title" className="px-3 py-2 text-xs text-gray-700 min-w-[150px] max-w-[220px] border-r border-gray-100 align-middle bg-white">
                  <TextCellPopover value={c.title || ''} onSave={val => onCellBlur(c.id, 'title', val)} placeholder="Nombre..." />
                </td>
              );
              if (col.id === '_observation') return (
                <td key="_obs" className="px-3 py-2 text-xs text-gray-500 min-w-[130px] border-r border-gray-100 align-middle bg-white">
                  <TextCellPopover
                    value={exec.observation || cd['_observation'] || ''}
                    onSave={val => exec.id ? onObservationSave(exec.id, val) : Promise.resolve()}
                    placeholder="Sin notas..."
                  />
                </td>
              );
              if (col.id === '_expected_result') return (
                <td key="_er" className="px-3 py-2 text-xs text-gray-600 min-w-[130px] border-r border-gray-100 align-middle bg-white">
                  <TextCellPopover value={c.expected_result || ''} onSave={val => onCellBlur(c.id, 'expected_result', val)} placeholder="Resultado esperado..." />
                </td>
              );

              const val = cd[col.id] ?? '';
              return (
                <td key={col.id} className="px-2 py-2 border-r border-gray-100 bg-white min-w-[110px] max-w-[180px] align-middle">
                  {col.type === 'dropdown' ? (
                    <select
                      value={val}
                      onChange={e => onCustomDataChange(c.id, cd, col.id, e.target.value)}
                      className="w-full text-xs bg-white border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-700"
                    >
                      <option value="">— —</option>
                      {col.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <TextCellPopover value={val} onSave={v => onCustomDataChange(c.id, cd, col.id, v)} placeholder="..." />
                  )}
                </td>
              );
            })}

            {/* ── Estado sticky right ───────────────────────────────────────── */}
            <td className={`px-3 py-2 whitespace-nowrap sticky right-0 z-10 border-l-2 border-gray-300 align-middle transition-colors ${
              status === 'PASS'        ? 'bg-green-50'   :
              status === 'FAIL'        ? 'bg-red-50'     :
              status === 'BLOCKED'     ? 'bg-yellow-50'  :
              status === 'SKIP'        ? 'bg-slate-50'   :
              status === 'IMPROVEMENT' ? 'bg-purple-50'  :
              'bg-gray-50'
            }`}>
              <div className="flex items-center gap-1.5">
                <select
                  className={`text-xs font-semibold rounded-lg px-2 py-1.5 border cursor-pointer focus:outline-none focus:ring-2 transition-all w-[140px] ${STATUS_SELECT_CLS[status] || STATUS_SELECT_CLS.PENDING}`}
                  value={status}
                  onChange={e => onStatusChange(c, e.target.value)}
                >
                  <option value="PENDING">⏳ PENDING</option>
                  <option value="PASS">✅ PASS</option>
                  <option value="FAIL">❌ FAIL</option>
                  <option value="BLOCKED">⚠️ BLOCKED</option>
                  <option value="SKIP">⏭️ SKIP</option>
                  <option value="IMPROVEMENT">💡 IMPROVEMENT</option>
                </select>
                {canManage && (
                  <button
                    onClick={() => onDeleteRow(c.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1 rounded flex-shrink-0"
                    title="Eliminar caso"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

// ─── Header builder (exported for Matrix.tsx thead) ───────────────────────────
export function buildHierarchicalHeaders(
  cases: any[],
  effectiveCols: any[],
): { numLevels: number; levelLabels: string[]; dataCols: any[] } {
  const maxDepth = cases.reduce((max, c) => {
    const path: string = c.custom_data?.hierarchy_path || '';
    return Math.max(max, path ? path.split(' > ').length : 1);
  }, 1);

  const hierarchyColIds = getHierarchyColIds(effectiveCols, maxDepth);
  const hierCols = effectiveCols.filter(c => hierarchyColIds.has(c.id));
  const levelLabels: string[] = Array.from({ length: maxDepth }, (_, i) =>
    hierCols[i]?.name ?? `Nivel ${i + 1}`
  );
  const dataCols = effectiveCols.filter(c => !hierarchyColIds.has(c.id));
  return { numLevels: maxDepth, levelLabels, dataCols };
}
