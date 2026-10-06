import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Trash2 } from 'lucide-react';
import TextCellPopover from './TextCellPopover';

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

const STATUS_SELECT_CLS: Record<string, string> = {
  PASS:        'bg-green-100  text-green-800  border-green-300  focus:ring-green-400',
  FAIL:        'bg-red-100    text-red-800    border-red-300    focus:ring-red-400',
  BLOCKED:     'bg-yellow-100 text-yellow-800 border-yellow-300 focus:ring-yellow-400',
  SKIP:        'bg-slate-100  text-slate-700  border-slate-300  focus:ring-slate-400',
  IMPROVEMENT: 'bg-purple-100 text-purple-800 border-purple-300 focus:ring-purple-400',
  PENDING:     'bg-gray-100   text-gray-700   border-gray-300   focus:ring-gray-400',
};

const HIERARCHY_COL_IDS = new Set(['side', '_module', 'feature',
  'sub-feature_1','sub-feature_2','sub-feature_3','sub-feature_4',
  'sub-feature_5','sub-feature_6','sub-feature_7']);

interface ProcessedRow {
  caseData: any;
  index: number;
  hierarchyParts: string[];
  depth: number;
  isFirstAtDepth: boolean[];
  spanAtDepth: number[];
}

function buildProcessedRows(cases: any[]): ProcessedRow[] {
  if (!cases.length) return [];

  const rows: ProcessedRow[] = cases.map((c, i) => {
    const path: string = c.custom_data?.hierarchy_path || '';
    const parts = path ? path.split(' > ') : [c.title || ''];
    const depth = parseInt(c.custom_data?.hierarchy_depth || '0', 10);
    return {
      caseData: c,
      index: i + 1,
      hierarchyParts: parts,
      depth,
      isFirstAtDepth: new Array(parts.length).fill(false),
      spanAtDepth: new Array(parts.length).fill(1),
    };
  });

  for (let d = 0; d < 12; d++) {
    let groupStart = -1;
    let groupValue = '';
    let groupPrefix = '';

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const parts = row.hierarchyParts;
      if (d >= parts.length) {
        if (groupStart >= 0) {
          rows[groupStart].isFirstAtDepth[d] = true;
          rows[groupStart].spanAtDepth[d] = r - groupStart;
          groupStart = -1;
        }
        continue;
      }

      const prefix = parts.slice(0, d).join(' > ');
      const val = parts[d];

      if (prefix !== groupPrefix || val !== groupValue || groupStart < 0) {
        if (groupStart >= 0) {
          rows[groupStart].isFirstAtDepth[d] = true;
          rows[groupStart].spanAtDepth[d] = r - groupStart;
        }
        groupStart = r;
        groupValue = val;
        groupPrefix = prefix;
      }
    }

    if (groupStart >= 0) {
      rows[groupStart].isFirstAtDepth[d] = true;
      rows[groupStart].spanAtDepth[d] = rows.length - groupStart;
    }
  }

  return rows;
}

const DEPTH_COLORS = [
  { bg: '#1e293b', text: '#f8fafc', border: '#0f172a' },
  { bg: '#334155', text: '#f1f5f9', border: '#1e293b' },
  { bg: '#475569', text: '#f8fafc', border: '#334155' },
  { bg: '#64748b', text: '#f8fafc', border: '#475569' },
  { bg: '#94a3b8', text: '#1e293b', border: '#64748b' },
  { bg: '#cbd5e1', text: '#1e293b', border: '#94a3b8' },
  { bg: '#e2e8f0', text: '#334155', border: '#cbd5e1' },
  { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
];

const DEPTH_ROW_BG = [
  'bg-indigo-50/60',
  'bg-blue-50/40',
  'bg-sky-50/30',
  'bg-white',
  'bg-white',
];

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
  const hierarchyCols = effectiveCols.filter(col =>
    HIERARCHY_COL_IDS.has(col.id) || col.id.startsWith('sub-feature')
  );
  const dataCols = effectiveCols.filter(col =>
    !HIERARCHY_COL_IDS.has(col.id) && !col.id.startsWith('sub-feature')
  );

  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

  const togglePath = (path: string) => {
    setCollapsedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const visibleCases = useMemo(() => {
    return cases.filter(c => {
      const path: string = c.custom_data?.hierarchy_path || '';
      if (!path) return true;
      const parts = path.split(' > ');
      for (let i = 1; i < parts.length; i++) {
        const ancestorPath = parts.slice(0, i).join(' > ');
        if (collapsedPaths.has(ancestorPath)) return false;
      }
      return true;
    });
  }, [cases, collapsedPaths]);

  const processedRows = useMemo(() => buildProcessedRows(visibleCases), [visibleCases]);

  const maxDepth = useMemo(() => {
    return cases.reduce((max, c) => {
      const d = parseInt(c.custom_data?.hierarchy_depth || '0', 10);
      return Math.max(max, d);
    }, 0);
  }, [cases]);

  const hierarchyLevels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 0; i <= maxDepth; i++) {
      labels.push(hierarchyCols[i]?.name || `Level ${i + 1}`);
    }
    return labels;
  }, [maxDepth, hierarchyCols]);

  if (!processedRows.length) {
    return (
      <tr>
        <td colSpan={99} className="px-6 py-8 text-center text-gray-400">
          No hay casos de prueba. Añade uno manualmente o importa un CSV.
        </td>
      </tr>
    );
  }

  return (
    <>
      {processedRows.map((row) => {
        const c = row.caseData;
        const execution = c.executions?.[0] || { status: 'PENDING', observation: '' };
        const customData = c.custom_data || {};
        const currentStatus: string = execution.status || 'PENDING';
        const path = customData.hierarchy_path || '';

        const nextCaseInFull = cases[cases.findIndex(x => x.id === c.id) + 1];
        const nextPath: string = nextCaseInFull?.custom_data?.hierarchy_path || '';
        const hasChildren = path && nextPath.startsWith(path + ' > ');
        const rowBgCls = DEPTH_ROW_BG[Math.min(row.depth, DEPTH_ROW_BG.length - 1)];

        return (
          <tr
            key={c.id}
            className={`group border-b border-gray-100 hover:bg-blue-50/20 transition-colors ${rowBgCls}`}
          >
            {/* # */}
            <td className="px-3 py-2 text-xs font-bold text-blue-400 whitespace-nowrap border-r border-gray-100 align-middle">
              {row.index}
            </td>

            {/* Hierarchy cells with real rowSpan */}
            {hierarchyLevels.map((_, depthIdx) => {
              const isFirst = row.isFirstAtDepth[depthIdx];
              const span = row.spanAtDepth[depthIdx];
              const label = row.hierarchyParts[depthIdx] || '';

              if (!isFirst) return null;

              if (depthIdx >= row.hierarchyParts.length) {
                return (
                  <td
                    key={`hier-${depthIdx}`}
                    rowSpan={span}
                    className="border-r border-gray-100 bg-gray-50/10 align-middle"
                    style={{ minWidth: 100 }}
                  />
                );
              }

              const colorStyle = DEPTH_COLORS[Math.min(depthIdx, DEPTH_COLORS.length - 1)];
              const isGroup = span > 1;
              const cellPath = row.hierarchyParts.slice(0, depthIdx + 1).join(' > ');
              const collapsed = collapsedPaths.has(cellPath);

              return (
                <td
                  key={`hier-${depthIdx}`}
                  rowSpan={span}
                  style={{
                    minWidth: 110,
                    verticalAlign: isGroup ? 'top' : 'middle',
                    borderRight: `1px solid ${colorStyle.border}`,
                  }}
                  className="px-2 py-1.5 align-top"
                >
                  {isGroup ? (
                    <button
                      onClick={() => togglePath(cellPath)}
                      className="flex items-start gap-1 w-full text-left rounded transition-opacity hover:opacity-80"
                      title={`Click para ${collapsed ? 'expandir' : 'colapsar'} — ${label} (${span} casos)`}
                    >
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap sticky top-10 flex-shrink-0"
                        style={{ background: colorStyle.bg, color: colorStyle.text }}
                      >
                        {collapsed
                          ? <ChevronRight className="w-3 h-3 flex-shrink-0" />
                          : <ChevronDown className="w-3 h-3 flex-shrink-0" />
                        }
                        {label}
                        <span style={{ opacity: 0.6, fontSize: '0.65rem', marginLeft: 2 }}>
                          ({span})
                        </span>
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      {hasChildren && (
                        <button onClick={() => togglePath(path)} className="text-gray-400 hover:text-gray-700 flex-shrink-0">
                          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                      <span className="text-xs text-gray-600">{label}</span>
                    </div>
                  )}
                </td>
              );
            })}

            {/* Data cols */}
            {dataCols.map((col: any) => {
              if (col.id === '_title') return (
                <td key="_title" className="px-3 py-2 text-xs text-gray-700 min-w-[180px] border-r border-gray-100 align-middle">
                  <TextCellPopover value={c.title || ''} onSave={val => onCellBlur(c.id, 'title', val)} placeholder="Nombre..." />
                </td>
              );
              if (col.id === '_observation') return (
                <td key="_observation" className="px-3 py-2 text-xs text-gray-600 border-r border-gray-100 min-w-[140px] align-middle">
                  <TextCellPopover value={execution.observation || ''} onSave={val => execution.id ? onObservationSave(execution.id, val) : Promise.resolve()} placeholder="Sin notas..." />
                </td>
              );
              if (col.id === '_expected_result') return (
                <td key="_expected_result" className="px-3 py-2 text-xs text-gray-600 border-r border-gray-100 min-w-[140px] align-middle">
                  <TextCellPopover value={c.expected_result || ''} onSave={val => onCellBlur(c.id, 'expected_result', val)} placeholder="Resultado esperado..." />
                </td>
              );
              return (
                <td key={col.id} className="px-3 py-2 border-r border-gray-100 bg-indigo-50/10 min-w-[120px] align-middle">
                  {col.type === 'dropdown' ? (
                    <select
                      value={customData[col.id] || ''}
                      onChange={e => onCustomDataChange(c.id, customData, col.id, e.target.value)}
                      className="w-full text-xs bg-white border border-gray-200 rounded-md px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-700"
                    >
                      <option value="">— —</option>
                      {col.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <TextCellPopover value={customData[col.id] || ''} onSave={val => onCustomDataChange(c.id, customData, col.id, val)} placeholder="..." />
                  )}
                </td>
              );
            })}

            {/* Estado sticky right */}
            <td className={`px-3 py-2 whitespace-nowrap sticky right-0 border-l border-gray-200 transition-colors align-middle ${
              currentStatus === 'PASS'        ? 'bg-green-50/90'  :
              currentStatus === 'FAIL'        ? 'bg-red-50/90'    :
              currentStatus === 'BLOCKED'     ? 'bg-yellow-50/90' :
              currentStatus === 'SKIP'        ? 'bg-slate-50/90'  :
              currentStatus === 'IMPROVEMENT' ? 'bg-purple-50/90' :
              'bg-gray-50/90'
            }`}>
              <div className="flex items-center gap-1.5">
                <select
                  className={`text-xs font-semibold rounded-lg px-2 py-1.5 border cursor-pointer focus:outline-none focus:ring-2 transition-all flex-1 ${STATUS_SELECT_CLS[currentStatus] || STATUS_SELECT_CLS.PENDING}`}
                  value={currentStatus}
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
                  <button onClick={() => onDeleteRow(c.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1 rounded" title="Eliminar caso">
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

export function buildHierarchicalHeaders(cases: any[], effectiveCols: any[]): { hierarchyHeaders: string[]; dataHeaders: any[] } {
  const maxDepth = cases.reduce((max, c) => {
    const d = parseInt(c.custom_data?.hierarchy_depth || '0', 10);
    return Math.max(max, d);
  }, 0);

  const hierarchyCols = effectiveCols.filter(col =>
    HIERARCHY_COL_IDS.has(col.id) || col.id.startsWith('sub-feature')
  );

  const hierarchyHeaders: string[] = [];
  for (let i = 0; i <= maxDepth; i++) {
    hierarchyHeaders.push(hierarchyCols[i]?.name || `Level ${i + 1}`);
  }

  const dataHeaders = effectiveCols.filter(col =>
    !HIERARCHY_COL_IDS.has(col.id) && !col.id.startsWith('sub-feature')
  );

  return { hierarchyHeaders, dataHeaders };
}
