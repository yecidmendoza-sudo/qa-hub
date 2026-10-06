import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Trash2 } from 'lucide-react';
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

// ─── Hierarchy col IDs — these are the "tree" columns that build the path ─────
// They are separated from "data" columns (ASSIGNEES, DARK MODE, etc.)
const HIERARCHY_COL_IDS = new Set([
  'side', '_module', 'feature',
  'sub-feature_1','sub-feature_2','sub-feature_3','sub-feature_4',
  'sub-feature_5','sub-feature_6','sub-feature_7',
]);

// ─── Row processed for rowSpan rendering ─────────────────────────────────────
interface ProcessedRow {
  caseData: any;
  visibleIndex: number;
  parts: string[];       // hierarchy_path.split(' > ')
  depth: number;         // last index of parts (parts.length - 1)
  // Per level: whether THIS row is the first to render it (rowspan owner)
  firstAtLevel: boolean[];
  spanAtLevel: number[];
}

// Build rowSpan metadata for every visible row
function buildRows(cases: any[]): ProcessedRow[] {
  if (!cases.length) return [];

  const rows: ProcessedRow[] = cases.map((c, i) => {
    const path: string = c.custom_data?.hierarchy_path || c.title || '';
    const parts = path ? path.split(' > ') : [''];
    const depth = parts.length - 1;
    return {
      caseData: c,
      visibleIndex: i + 1,
      parts,
      depth,
      firstAtLevel: new Array(parts.length).fill(false),
      spanAtLevel: new Array(parts.length).fill(1),
    };
  });

  // For each depth level, compute which row is the "owner" (firstAtLevel=true)
  // and how many rows its cell should span
  const maxLevels = rows.reduce((max, r) => Math.max(max, r.parts.length), 0);

  for (let lvl = 0; lvl < maxLevels; lvl++) {
    let groupStart = -1;
    let groupKey = '\x00';  // impossible initial key

    const closeGroup = (endIdx: number) => {
      if (groupStart >= 0) {
        rows[groupStart].firstAtLevel[lvl] = true;
        rows[groupStart].spanAtLevel[lvl] = endIdx - groupStart;
        groupStart = -1;
      }
    };

    for (let r = 0; r < rows.length; r++) {
      const parts = rows[r].parts;
      if (lvl >= parts.length) {
        closeGroup(r);
        groupKey = '\x00';
        continue;
      }
      // Key = full path up to this level (prevents false grouping across different parents)
      const key = parts.slice(0, lvl + 1).join('\x01');
      if (key !== groupKey) {
        closeGroup(r);
        groupStart = r;
        groupKey = key;
      }
    }
    closeGroup(rows.length);
  }

  return rows;
}

// ─── Color palette per depth ──────────────────────────────────────────────────
const LEVEL_BG = [
  '#1e293b', '#334155', '#475569', '#64748b',
  '#94a3b8', '#cbd5e1', '#e2e8f0', '#f1f5f9',
];
const LEVEL_TEXT = [
  '#f8fafc', '#f1f5f9', '#f8fafc', '#f8fafc',
  '#0f172a', '#0f172a', '#334155', '#475569',
];
const LEVEL_BORDER = [
  '#0f172a', '#1e293b', '#334155', '#475569',
  '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0',
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
  // Separate hierarchy cols from data cols
  const hierarchyCols = effectiveCols.filter(c => HIERARCHY_COL_IDS.has(c.id));
  const dataCols = effectiveCols.filter(c => !HIERARCHY_COL_IDS.has(c.id));

  // Max depth across all cases → number of tree-level columns to render
  const maxDepth = useMemo(() =>
    cases.reduce((max, c) => {
      const path: string = c.custom_data?.hierarchy_path || '';
      return Math.max(max, path ? path.split(' > ').length - 1 : 0);
    }, 0)
  , [cases]);

  // Number of hierarchy columns to render = maxDepth + 1
  const numLevels = maxDepth + 1;

  // ── Collapse state: track which paths are collapsed ──────────────────────────
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (path: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });

  // ── Filter cases: hide rows whose ancestor path is collapsed ─────────────────
  const visibleCases = useMemo(() => cases.filter(c => {
    const path: string = c.custom_data?.hierarchy_path || '';
    if (!path) return true;
    const parts = path.split(' > ');
    for (let i = 1; i < parts.length; i++) {
      if (collapsed.has(parts.slice(0, i).join(' > '))) return false;
    }
    return true;
  }), [cases, collapsed]);

  // ── Build rowSpan metadata for visible rows ───────────────────────────────────
  const rows = useMemo(() => buildRows(visibleCases), [visibleCases]);

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
        const path: string = cd.hierarchy_path || '';

        // Does this row have children in the FULL case list (not just visible)?
        const fullIdx = cases.findIndex(x => x.id === c.id);
        const nextPath: string = cases[fullIdx + 1]?.custom_data?.hierarchy_path || '';
        const hasChildren = path && nextPath.startsWith(path + ' > ');
        const isCollapsed = collapsed.has(path);

        return (
          <tr
            key={c.id}
            className="group border-b border-gray-100 hover:bg-blue-50/20 transition-colors"
          >
            {/* Row # */}
            <td className="px-3 py-2 text-xs font-bold text-blue-400 whitespace-nowrap border-r border-gray-200 align-middle w-[50px]">
              {row.visibleIndex}
            </td>

            {/* ── Hierarchy cells (one per depth level, with rowSpan) ───────── */}
            {Array.from({ length: numLevels }, (_, lvl) => {
              const isFirst = row.firstAtLevel[lvl];
              const span = row.spanAtLevel[lvl];
              const label = row.parts[lvl] ?? '';

              // Not the owner of this cell → skip (handled by rowSpan above)
              if (!isFirst) return null;

              // This level doesn't exist for this row (e.g. row has depth 2, lvl=3)
              if (lvl >= row.parts.length) {
                return (
                  <td
                    key={`h${lvl}`}
                    rowSpan={span}
                    className="border-r border-gray-200"
                    style={{ minWidth: 90, background: '#f9fafb' }}
                  />
                );
              }

              const bg = LEVEL_BG[Math.min(lvl, LEVEL_BG.length - 1)];
              const color = LEVEL_TEXT[Math.min(lvl, LEVEL_TEXT.length - 1)];
              const border = LEVEL_BORDER[Math.min(lvl, LEVEL_BORDER.length - 1)];
              const isGroup = span > 1;
              const cellPath = row.parts.slice(0, lvl + 1).join(' > ');
              const isCellCollapsed = collapsed.has(cellPath);

              return (
                <td
                  key={`h${lvl}`}
                  rowSpan={span}
                  style={{
                    minWidth: 110,
                    verticalAlign: isGroup ? 'top' : 'middle',
                    borderRight: `2px solid ${border}`,
                    padding: '4px 6px',
                  }}
                >
                  {isGroup ? (
                    // Group header cell: click to collapse/expand
                    <button
                      onClick={() => toggle(cellPath)}
                      className="flex items-start gap-1 w-full text-left transition-opacity hover:opacity-80 sticky top-10"
                      title={`${isCellCollapsed ? 'Expandir' : 'Colapsar'} — ${label} (${span} casos)`}
                    >
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap leading-5"
                        style={{ background: bg, color }}
                      >
                        {isCellCollapsed
                          ? <ChevronRight className="w-3 h-3 flex-shrink-0" />
                          : <ChevronDown className="w-3 h-3 flex-shrink-0" />
                        }
                        {label}
                        <span style={{ opacity: 0.55, fontSize: '0.6rem', marginLeft: 2 }}>
                          ({span})
                        </span>
                      </span>
                    </button>
                  ) : (
                    // Leaf cell
                    <div className="flex items-center gap-1">
                      {hasChildren && (
                        <button
                          onClick={() => toggle(path)}
                          className="flex-shrink-0 text-gray-400 hover:text-gray-700"
                        >
                          {isCollapsed
                            ? <ChevronRight className="w-3 h-3" />
                            : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                      <span className="text-xs text-gray-600">{label}</span>
                    </div>
                  )}
                </td>
              );
            })}

            {/* ── Data columns ──────────────────────────────────────────────── */}
            {dataCols.map((col: any) => {
              // Reserved cols read from DB fields
              if (col.id === '_title') return (
                <td key="_title" className="px-3 py-2 text-xs text-gray-700 min-w-[160px] border-r border-gray-100 align-middle">
                  <TextCellPopover
                    value={c.title || ''}
                    onSave={val => onCellBlur(c.id, 'title', val)}
                    placeholder="Nombre..."
                  />
                </td>
              );
              if (col.id === '_observation') return (
                <td key="_observation" className="px-3 py-2 text-xs text-gray-500 min-w-[140px] border-r border-gray-100 align-middle">
                  <TextCellPopover
                    value={exec.observation || cd['_observation'] || ''}
                    onSave={val => exec.id ? onObservationSave(exec.id, val) : Promise.resolve()}
                    placeholder="Sin notas..."
                  />
                </td>
              );
              if (col.id === '_expected_result') return (
                <td key="_expected_result" className="px-3 py-2 text-xs text-gray-600 min-w-[140px] border-r border-gray-100 align-middle">
                  <TextCellPopover
                    value={c.expected_result || ''}
                    onSave={val => onCellBlur(c.id, 'expected_result', val)}
                    placeholder="Resultado esperado..."
                  />
                </td>
              );

              // Generic custom column — read from custom_data by col.id
              const val = cd[col.id] || '';
              return (
                <td key={col.id} className="px-2 py-2 border-r border-gray-100 bg-indigo-50/10 min-w-[120px] align-middle">
                  {col.type === 'dropdown' ? (
                    <select
                      value={val}
                      onChange={e => onCustomDataChange(c.id, cd, col.id, e.target.value)}
                      className="w-full text-xs bg-white border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-700"
                    >
                      <option value="">— —</option>
                      {col.options?.map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <TextCellPopover
                      value={val}
                      onSave={v => onCustomDataChange(c.id, cd, col.id, v)}
                      placeholder="..."
                    />
                  )}
                </td>
              );
            })}

            {/* ── Estado (sticky right) ─────────────────────────────────────── */}
            <td className={`px-3 py-2 whitespace-nowrap sticky right-0 border-l border-gray-200 align-middle transition-colors ${
              status === 'PASS'        ? 'bg-green-50/90'  :
              status === 'FAIL'        ? 'bg-red-50/90'    :
              status === 'BLOCKED'     ? 'bg-yellow-50/90' :
              status === 'SKIP'        ? 'bg-slate-50/90'  :
              status === 'IMPROVEMENT' ? 'bg-purple-50/90' :
              'bg-gray-50/90'
            }`}>
              <div className="flex items-center gap-1.5">
                <select
                  className={`text-xs font-semibold rounded-lg px-2 py-1.5 border cursor-pointer focus:outline-none focus:ring-2 transition-all flex-1 ${STATUS_SELECT_CLS[status] || STATUS_SELECT_CLS.PENDING}`}
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
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1 rounded"
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

// ─── Exported helper: build the hierarchical header <tr> ──────────────────────
export function buildHierarchicalHeaders(
  cases: any[],
  effectiveCols: any[],
): { numLevels: number; levelLabels: string[]; dataCols: any[] } {
  const maxDepth = cases.reduce((max, c) => {
    const path: string = c.custom_data?.hierarchy_path || '';
    return Math.max(max, path ? path.split(' > ').length - 1 : 0);
  }, 0);

  const numLevels = maxDepth + 1;

  // Use the hierarchy col names as level labels (SIDE, MODULE, FEATURE, Sub-feature 1…)
  const hierCols = effectiveCols.filter(c => HIERARCHY_COL_IDS.has(c.id));
  const levelLabels: string[] = Array.from({ length: numLevels }, (_, i) =>
    hierCols[i]?.name ?? `Level ${i + 1}`
  );

  const dataCols = effectiveCols.filter(c => !HIERARCHY_COL_IDS.has(c.id));

  return { numLevels, levelLabels, dataCols };
}
