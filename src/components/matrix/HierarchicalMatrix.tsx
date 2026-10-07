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

// ─── IDs that are ALWAYS data columns (never hierarchy) ───────────────────────
const DATA_ONLY_COL_IDS = new Set([
  'assignees', 'dark_mode', 'light_mode', '_observation', 'ticket',
  'severity', 'notes', 'qa_reviewer', 'priority', 'preconditions',
  '_title', '_expected_result',
]);

// ─── Derive hierarchy col IDs from the cycle custom_columns and max path depth ─
// Strategy: take the first N custom_columns that are NOT data-only as hierarchy cols
// where N = max path depth in the case data.
function getHierarchyColIds(effectiveCols: any[], maxDepth: number): Set<string> {
  const candidates = effectiveCols.filter(c => !DATA_ONLY_COL_IDS.has(c.id));
  const hierIds = new Set<string>();
  for (let i = 0; i < Math.min(candidates.length, maxDepth); i++) {
    hierIds.add(candidates[i].id);
  }
  return hierIds;
}

// ─── Row processed for rowSpan rendering ─────────────────────────────────────
interface ProcessedRow {
  caseData: any;
  visibleIndex: number;
  parts: string[];       // hierarchy_path.split(' > ')
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
      if (lvl >= parts.length) {
        closeGroup(r);
        groupKey = '\x00';
        continue;
      }
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

// ─── Color palette per depth level ───────────────────────────────────────────
const LEVEL_BG    = ['#1e293b','#334155','#475569','#64748b','#94a3b8','#cbd5e1','#e2e8f0','#f1f5f9','#f8fafc'];
const LEVEL_TEXT  = ['#f8fafc','#f1f5f9','#f8fafc','#f8fafc','#0f172a','#0f172a','#334155','#475569','#64748b'];
const LEVEL_BORDER= ['#0f172a','#1e293b','#334155','#475569','#64748b','#94a3b8','#cbd5e1','#e2e8f0','#f1f5f9'];

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

  // ── Compute max depth across ALL cases (not just visible) ────────────────────
  const maxDepth = useMemo(() =>
    cases.reduce((max, c) => {
      const path: string = c.custom_data?.hierarchy_path || '';
      return Math.max(max, path ? path.split(' > ').length : 1);
    }, 1)
  , [cases]);

  // ── Separate hierarchy cols from data cols ────────────────────────────────────
  const hierarchyColIds = useMemo(() => getHierarchyColIds(effectiveCols, maxDepth), [effectiveCols, maxDepth]);
  const dataCols = useMemo(() => effectiveCols.filter(c => !hierarchyColIds.has(c.id)), [effectiveCols, hierarchyColIds]);
  const numLevels = maxDepth; // number of tree-column slots to render

  // ── Collapse state ────────────────────────────────────────────────────────────
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

  // ── Build rowSpan metadata ────────────────────────────────────────────────────
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

        // Does this row have children in the FULL case list?
        const fullIdx = cases.findIndex(x => x.id === c.id);
        const nextPath: string = cases[fullIdx + 1]?.custom_data?.hierarchy_path || '';
        const thisPath: string = cd.hierarchy_path || '';
        const hasChildren = thisPath && nextPath.startsWith(thisPath + ' > ');
        const isThisCollapsed = collapsed.has(thisPath);

        return (
          <tr
            key={c.id}
            className="group border-b border-gray-100 hover:bg-blue-50/20 transition-colors"
          >
            {/* ── Row # ───────────────────────────────────────────────────── */}
            <td className="px-3 py-2 text-xs font-bold text-blue-400 whitespace-nowrap border-r border-gray-200 align-middle w-[50px]">
              {row.visibleIndex}
            </td>

            {/* ── Hierarchy level cells (one slot per level, with rowSpan) ─── */}
            {Array.from({ length: numLevels }, (_, lvl) => {
              const isFirst = lvl < row.firstAtLevel.length ? row.firstAtLevel[lvl] : false;
              const span = lvl < row.spanAtLevel.length ? row.spanAtLevel[lvl] : 1;
              const label = lvl < row.parts.length ? row.parts[lvl] : '';

              // Not the owner of this cell → skip (handled by rowSpan)
              if (lvl < row.parts.length && !isFirst) return null;

              // This level doesn't exist for this row
              if (lvl >= row.parts.length) {
                return (
                  <td
                    key={`h${lvl}`}
                    className="border-r border-gray-100 bg-gray-50/30"
                    style={{ minWidth: 90 }}
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
                    maxWidth: 160,
                    verticalAlign: isGroup ? 'top' : 'middle',
                    borderRight: `2px solid ${border}`,
                    padding: '6px 8px',
                    background: isGroup ? bg : undefined,
                  }}
                  className={isGroup ? '' : 'bg-gray-50/40 border-r border-gray-200'}
                >
                  {isGroup ? (
                    <button
                      onClick={() => toggle(cellPath)}
                      className="flex items-start gap-1 w-full text-left sticky top-14 transition-opacity hover:opacity-80"
                      title={`${isCellCollapsed ? 'Expandir' : 'Colapsar'} — ${label} (${span} casos)`}
                    >
                      <span className="inline-flex items-center gap-1 flex-wrap" style={{ color }}>
                        {isCellCollapsed
                          ? <ChevronRight className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          : <ChevronDown className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        }
                        <span className="text-xs font-semibold leading-snug break-words">{label}</span>
                        <span style={{ opacity: 0.55, fontSize: '0.6rem' }}>({span})</span>
                      </span>
                    </button>
                  ) : (
                    // Leaf-level cell — this is the actual test case node
                    <div className="flex items-center gap-1">
                      {hasChildren ? (
                        <button
                          onClick={() => toggle(thisPath)}
                          className="flex-shrink-0 text-gray-400 hover:text-gray-700"
                        >
                          {isThisCollapsed
                            ? <ChevronRight className="w-3 h-3" />
                            : <ChevronDown className="w-3 h-3" />}
                        </button>
                      ) : null}
                      <span className="text-xs text-gray-600 break-words">{label}</span>
                    </div>
                  )}
                </td>
              );
            })}

            {/* ── Data columns ─────────────────────────────────────────────── */}
            {dataCols.map((col: any) => {
              if (col.id === '_title') return (
                <td key="_title" className="px-3 py-2 text-xs text-gray-700 min-w-[150px] max-w-[220px] border-r border-gray-100 align-middle">
                  <TextCellPopover value={c.title || ''} onSave={val => onCellBlur(c.id, 'title', val)} placeholder="Nombre..." />
                </td>
              );
              if (col.id === '_observation') return (
                <td key="_obs" className="px-3 py-2 text-xs text-gray-500 min-w-[130px] border-r border-gray-100 align-middle">
                  <TextCellPopover
                    value={exec.observation || cd['_observation'] || ''}
                    onSave={val => exec.id ? onObservationSave(exec.id, val) : Promise.resolve()}
                    placeholder="Sin notas..."
                  />
                </td>
              );
              if (col.id === '_expected_result') return (
                <td key="_er" className="px-3 py-2 text-xs text-gray-600 min-w-[130px] border-r border-gray-100 align-middle">
                  <TextCellPopover value={c.expected_result || ''} onSave={val => onCellBlur(c.id, 'expected_result', val)} placeholder="Resultado esperado..." />
                </td>
              );

              // Generic custom column
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

            {/* ── Estado (sticky right) ─────────────────────────────────────── */}
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

// ─── Exported header builder ──────────────────────────────────────────────────
export function buildHierarchicalHeaders(
  cases: any[],
  effectiveCols: any[],
): { numLevels: number; levelLabels: string[]; dataCols: any[] } {

  // Compute max path depth from actual case data
  const maxDepth = cases.reduce((max, c) => {
    const path: string = c.custom_data?.hierarchy_path || '';
    return Math.max(max, path ? path.split(' > ').length : 1);
  }, 1);

  // Derive which cols are hierarchy vs data
  const hierarchyColIds = getHierarchyColIds(effectiveCols, maxDepth);

  // Build level labels: use column name for defined levels, "Nivel N" for extras
  const hierCols = effectiveCols.filter(c => hierarchyColIds.has(c.id));
  const levelLabels: string[] = Array.from({ length: maxDepth }, (_, i) =>
    hierCols[i]?.name ?? `Nivel ${i + 1}`
  );

  const dataCols = effectiveCols.filter(c => !hierarchyColIds.has(c.id));

  return { numLevels: maxDepth, levelLabels, dataCols };
}
