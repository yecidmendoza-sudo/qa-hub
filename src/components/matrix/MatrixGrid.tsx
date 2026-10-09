/**
 * MatrixGrid — Custom HTML <table> implementation
 *
 * Replaces AG Grid Community with a native table for:
 *   ✅ Perfect rowspan/colspan merges (browser-native, zero z-index bugs)
 *   ✅ Vertical + horizontal cell merging via drag-select
 *   ✅ Virtual scroll via overflow + maxHeight (handles 1000+ rows)
 *   ✅ Sort, filter, bulk fill, column resize
 *   ✅ Status column, cell editing (TextCellPopover), delete row
 *
 * Props are 100% backward compatible with the AG Grid version.
 */
import {
  useState, useRef, useEffect, useMemo, useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Pencil } from 'lucide-react';
import TextCellPopover from './TextCellPopover';
import ColumnFilterDropdown from './ColumnFilterDropdown';
import ColumnEditor from './ColumnEditor';
import StatusOptionsEditor from './StatusOptionsEditor';
import {
  DEFAULT_STATUS_OPTIONS, statusLabel, statusCls, statusRowCls,
} from '../../lib/constants/statusOptions';

// ── Public interfaces (same as before) ────────────────────────────────────────

export interface Merge {
  colId:       string;
  startCaseId: string;
  rowCount:    number;
  colCount?:   number;   // NEW: for colSpan support (defaults to 1)
}

export interface GridColumnDef {
  id:       string;
  name:     string;
  type?:    'text' | 'dropdown' | 'number';
  options?: string[];
  width?:   number;
}

interface MatrixGridProps {
  cases:              any[];
  columns:            GridColumnDef[];
  merges:             Merge[];
  hierarchyColCount?: number;
  hierOffset?:        number;   // index of first hierarchy column in columns[] (default 0)
  canManage?:         boolean;
  readOnly?:          boolean;
  onStatusChange?:    (testCase: any, status: string) => void;
  onCellSave?:        (caseId: string, colId: string, value: string, caseObj: any) => void;
  onDeleteRow?:       (caseId: string) => void;
  onMergesChange?:    (merges: Merge[]) => void;
  onBulkFill?:        (colId: string, value: string) => void;
  onColumnEdit?:      (colId: string, patch: { name: string; type: string; options: string[] }) => void;
  colFilters?:         Record<string, Set<string>>;
  columnUniqueValues?: Record<string, string[]>;
  onColFilter?:        (colId: string, selected: Set<string>) => void;
  statusOptions?:      string[];       // custom options for the Estado column
  onStatusOptionsChange?: (opts: string[]) => void;
}

// ── Constants now imported from lib/constants/statusOptions.ts ───────────────

// ── Cell value extractor ──────────────────────────────────────────────────────

function getCellVal(c: any, colId: string, colIdx: number, hierCount: number, hierOffset = 0): string {
  const exec = c.executions?.[0] || {};
  const cd   = c.custom_data   || {};
  if (colId === '_title')           return c.title  || '';
  if (colId === '_expected_result') return c.expected_result || '';
  if (colId === '_observation')     return exec.observation || cd['_observation'] || '';
  if (colId === '_module')          return c.module || '';
  if (cd[colId])                    return cd[colId];
  // Fallback: read from hierarchy_path using position among hierarchy cols (offset-corrected)
  const pathIdx = colIdx - hierOffset;
  if (pathIdx >= 0 && pathIdx < hierCount) {
    const path: string = cd['hierarchy_path'] || '';
    if (path) return path.split(' > ')[pathIdx] || '';
  }
  return '';
}

// ── Layout builder ────────────────────────────────────────────────────────────

interface CellLayout {
  skip:    boolean;
  rowspan: number;
  colspan: number;
}

function buildLayout(
  cases:   any[],
  columns: GridColumnDef[],
  merges:  Merge[],
): Map<string, CellLayout> {
  const map     = new Map<string, CellLayout>();
  const caseIdx = new Map(cases.map((c, i)   => [c.id, i]));
  const colIdx  = new Map(columns.map((c, i) => [c.id, i]));

  for (const m of merges) {
    const r0 = caseIdx.get(m.startCaseId);
    const c0 = colIdx.get(m.colId);
    if (r0 === undefined || c0 === undefined) continue;

    const rs = Math.max(1, m.rowCount  || 1);
    const cs = Math.max(1, m.colCount  || 1);

    map.set(`${r0}:${c0}`, { skip: false, rowspan: rs, colspan: cs });

    for (let r = r0; r < r0 + rs && r < cases.length; r++) {
      for (let c: number = c0; c < c0 + cs && c < columns.length; c++) {
        if (r === r0 && c === c0) continue;
        map.set(`${r}:${c}`, { skip: true, rowspan: 1, colspan: 1 });
      }
    }
  }
  return map;
}

// ── Filter + sort ─────────────────────────────────────────────────────────────

function applyFiltersAndSort(
  cases:      any[],
  columns:    GridColumnDef[],
  hierCount:  number,
  hierOffset: number,
  filters:    Record<string, Set<string>>,
  sortCol:    string | null,
  sortAsc:    boolean,
): any[] {
  let result = cases;
  for (const [colId, sel] of Object.entries(filters)) {
    if (!sel || sel.size === 0) continue;
    const ci = columns.findIndex(c => c.id === colId);
    result = result.filter(c => sel.has(getCellVal(c, colId, ci, hierCount, hierOffset)));
  }
  if (sortCol) {
    const ci = columns.findIndex(c => c.id === sortCol);
    result = [...result].sort((a, b) => {
      const av = getCellVal(a, sortCol, ci, hierCount, hierOffset);
      const bv = getCellVal(b, sortCol, ci, hierCount, hierOffset);
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }
  return result;
}

// ── BulkFillButton ────────────────────────────────────────────────────────────

function BulkFillButton({ colId, options, onFill }: {
  colId: string; options: string[];
  onFill: (colId: string, val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex-shrink-0">
      <button onClick={() => setOpen(o => !o)} title="Rellenar toda la columna"
        className="text-indigo-400 hover:text-indigo-600 transition-colors">
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
        </svg>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-[9999] bg-white rounded-xl shadow-2xl border border-gray-200 py-1 min-w-[160px]">
          <div className="px-3 py-1 text-xs font-bold text-gray-400 uppercase border-b border-gray-100 mb-1">Rellenar todo</div>
          {options.map(opt => (
            <button key={opt} onClick={() => { onFill(colId, opt); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
              {opt}
            </button>
          ))}
          <button onClick={() => setOpen(false)}
            className="w-full text-left px-3 py-1 text-xs text-gray-400 border-t border-gray-100 mt-1">
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}

// ── ResizeHandle ──────────────────────────────────────────────────────────────

function ResizeHandle({ onResize }: { onResize: (delta: number) => void }) {
  return (
    <div
      className="w-1 h-full cursor-col-resize absolute right-0 top-0 hover:bg-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
      onMouseDown={e => {
        const startX = e.clientX;
        let last = startX;
        const onMove = (me: MouseEvent) => { onResize(me.clientX - last); last = me.clientX; };
        const onUp   = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
        e.stopPropagation(); e.preventDefault();
      }}
    />
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MatrixGrid({
  cases, columns, merges, hierarchyColCount = 0, hierOffset = 0,
  canManage = false, readOnly = false,
  onStatusChange, onCellSave, onDeleteRow, onMergesChange, onBulkFill, onColumnEdit,
  colFilters = {}, columnUniqueValues = {}, onColFilter,
  statusOptions, onStatusOptionsChange,
}: MatrixGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeBarRef  = useRef<HTMLDivElement>(null);

  const [sortCol,    setSortCol]    = useState<string | null>(null);
  const [sortAsc,    setSortAsc]    = useState(true);
  const [colWidths,  setColWidths]  = useState<Record<string, number>>({});
  // selection is tracked via DOM only during drag (no React re-render per pixel)
  const [mergeBar, setMergeBar] = useState<{ x:number; y:number; r1:number; r2:number; c1:number; c2:number } | null>(null);
  const clearSelectionRef = useRef<() => void>(() => {}); // set by drag useEffect
  // Column editor panel state
  const [editingCol, setEditingCol] = useState<{ col: GridColumnDef; anchor: HTMLElement } | null>(null);
  // Status options editor state
  const [editingStatus, setEditingStatus] = useState(false);
  // Resolved status options: custom from parent, or defaults
  const resolvedStatusOpts = (statusOptions && statusOptions.length > 0)
    ? statusOptions
    : DEFAULT_STATUS_OPTIONS;


  const handleSort = useCallback((colId: string) => {
    setSortCol(prev => { if (prev === colId) { setSortAsc(a => !a); return colId; } setSortAsc(true); return colId; });
  }, []);

  const visibleCases = useMemo(() =>
    applyFiltersAndSort(cases, columns, hierarchyColCount, hierOffset, colFilters, sortCol, sortAsc),
    [cases, columns, hierarchyColCount, hierOffset, colFilters, sortCol, sortAsc],
  );

  const layout = useMemo(() =>
    buildLayout(visibleCases, columns, merges),
    [visibleCases, columns, merges],
  );

  // Drag-to-select — DOM-only during drag to avoid re-rendering 848 rows on every mousemove
  useEffect(() => {
    if (!canManage || readOnly) return;
    const container = containerRef.current;
    if (!container) return;

    let dragActive = false;
    let downCell: { r: number; c: number } | null = null;
    let downX = 0, downY = 0;
    let lastSel = { r1: 0, c1: 0, r2: 0, c2: 0 };

    const getCell = (t: EventTarget | null) => {
      let el = t as HTMLElement | null;
      while (el) {
        if (el.dataset?.matRow !== undefined && el.dataset?.matCol !== undefined)
          return { r: +el.dataset.matRow, c: +el.dataset.matCol };
        el = el.parentElement;
      }
      return null;
    };

    // Cell lookup map built once on mousedown — avoids querySelectorAll on every mousemove
    let cellMap = new Map<string, HTMLElement>();

    const buildCellMap = () => {
      cellMap.clear();
      container.querySelectorAll<HTMLElement>('td[data-mat-row]').forEach(td => {
        cellMap.set(`${td.dataset.matRow}:${td.dataset.matCol}`, td);
      });
    };

    // Paint ONLY the delta — cells that changed from last selection
    const paintSelection = (r1: number, c1: number, r2: number, c2: number) => {
      const prev = lastSel;
      lastSel = { r1, c1, r2, c2 };
      cellMap.forEach((td, key) => {
        const [rs, cs] = key.split(':');
        const r = +rs, c = +cs;
        const wasIn = r >= prev.r1 && r <= prev.r2 && c >= prev.c1 && c <= prev.c2;
        const nowIn = r >= r1 && r <= r2 && c >= c1 && c <= c2;
        if (wasIn !== nowIn) td.classList.toggle('qhm-selected', nowIn);
      });
    };

    const clearSelection = () => {
      cellMap.forEach(td => td.classList.remove('qhm-selected'));
      lastSel = { r1: -1, c1: -1, r2: -1, c2: -1 };
    };

    // ⚠️  KEY FIX: Prevent browser native drag (HTML5 DnD) which causes blank screen on mouseup
    const onDragStart = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (!container.contains(e.target as Node)) return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'select' || tag === 'textarea' || tag === 'input') return;
      const cell = getCell(e.target);
      if (!cell) return;
      // Prevent text-selection drag / native browser drag
      e.preventDefault();
      // Build cell index fresh (covers virtual/dynamic rows if any)
      buildCellMap();
      lastSel = { r1: -1, c1: -1, r2: -1, c2: -1 };
      downCell = cell;
      downX = e.clientX;
      downY = e.clientY;
      dragActive = false;
    };

    const onMove = (e: MouseEvent) => {
      if (!downCell) return;
      if (!dragActive) {
        const dx = Math.abs(e.clientX - downX);
        const dy = Math.abs(e.clientY - downY);
        if (dx < 4 && dy < 4) return;
        dragActive = true;
        setMergeBar(null); // hide any existing merge bar
      }
      const cell = getCell(e.target);
      if (!cell || !downCell) return;
      paintSelection(
        Math.min(downCell.r, cell.r), Math.min(downCell.c, cell.c),
        Math.max(downCell.r, cell.r), Math.max(downCell.c, cell.c),
      );
    };

    const onUp = (e: MouseEvent) => {
      if (!downCell) return;
      const wasActive = dragActive;
      dragActive = false;
      downCell = null;
      if (!wasActive) { clearSelection(); return; }
      // Use rAF to decouple the React state update from the native event handler
      // (prevents the blank-screen crash on mouseup)
      const { r1, c1, r2, c2 } = lastSel;
      if (r2 > r1 || c2 > c1) {
        requestAnimationFrame(() => {
          setMergeBar({ x: e.clientX, y: e.clientY - 60, r1, r2, c1, c2 });
        });
      } else {
        clearSelection();
      }
    };

    // Expose clearSelection for use outside this effect
    clearSelectionRef.current = clearSelection;

    container.addEventListener('dragstart', onDragStart);
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      container.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [canManage, readOnly]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (mergeBarRef.current && !mergeBarRef.current.contains(e.target as Node)) { setMergeBar(null); clearSelectionRef.current(); }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const applyMerge = useCallback(() => {
    if (!mergeBar) return;
    const { r1, r2, c1, c2 } = mergeBar;
    const startCase = visibleCases[r1]; if (!startCase) return;
    const rowCount = r2 - r1 + 1;
    const next = merges.filter(m => { for (let ci = c1; ci <= c2; ci++) if (m.colId === columns[ci]?.id && m.startCaseId === startCase.id) return false; return true; });
    for (let ci = c1; ci <= c2; ci++) { const col = columns[ci]; if (col) next.push({ colId: col.id, startCaseId: startCase.id, rowCount }); }
    onMergesChange?.(next); setMergeBar(null); clearSelectionRef.current();
  }, [mergeBar, visibleCases, columns, merges, onMergesChange]);

  const removeMerge = useCallback(() => {
    if (!mergeBar) return;
    const { r1, c1, c2 } = mergeBar;
    const startCase = visibleCases[r1]; if (!startCase) return;
    const next = merges.filter(m => { for (let ci = c1; ci <= c2; ci++) if (m.colId === columns[ci]?.id && m.startCaseId === startCase.id) return false; return true; });
    onMergesChange?.(next); setMergeBar(null); clearSelectionRef.current();
  }, [mergeBar, visibleCases, columns, merges, onMergesChange]);

  const barHasMerge = useMemo(() => {
    if (!mergeBar) return false;
    const { r1, c1, c2 } = mergeBar;
    for (let ci = c1; ci <= c2; ci++) { const e = layout.get(`${r1}:${ci}`); if (e && !e.skip && e.rowspan > 1) return true; }
    return false;
  }, [mergeBar, layout]);

  if (cases.length === 0)
    return <div className="flex items-center justify-center py-20 text-gray-400 text-sm">No hay casos de prueba.</div>;

  return (
    <div ref={containerRef} className="relative w-full">
      {canManage && !readOnly && (
        <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 text-xs text-blue-600 flex items-center gap-2 flex-wrap">
          <span>💡 <strong>Combinar:</strong> arrastra para seleccionar → Combinar</span>
          <span className="text-blue-300">|</span>
          <span><strong>Separar:</strong> click derecho en celda combinada</span>
          <span className="text-blue-300">|</span>
          <span><strong>Filtrar:</strong> hover en encabezado → ícono embudo</span>
        </div>
      )}

      <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 180px)', minHeight: 400 }}>
        <table className="qhm-table" draggable={false} onDragStart={e => e.preventDefault()}
          style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          {/* Explicit colgroup so browser always knows every column width,
              even in rows where cells are covered by rowspan merges */}
          <colgroup>
            <col style={{ width: 40 }} />
            {columns.map(col => (
              <col key={col.id} style={{ width: colWidths[col.id] || col.width || 150 }} />
            ))}
            <col style={{ width: 190 }} />
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="qhm-th qhm-th-sticky-left" style={{ width: 40, minWidth: 40 }}>#</th>
              {columns.map(col => (
                <th key={col.id} className="qhm-th group"
                  style={{ width: colWidths[col.id] || col.width || 150, minWidth: 110, position: 'relative' }}>
                  <div className="flex flex-col gap-0.5 w-full">
                    <div className="flex items-center gap-1 w-full">
                    <button onClick={() => handleSort(col.id)}
                      className="text-[11px] font-bold text-blue-900 uppercase tracking-wide text-left leading-tight hover:text-indigo-600 transition-colors break-words whitespace-normal"
                      title={col.name} style={{ wordBreak: 'break-word' }}>
                      {col.name}
                      {sortCol === col.id && <span className="ml-1 text-indigo-400 normal-case tracking-normal">{sortAsc ? '↑' : '↓'}</span>}
                    </button>
                    {canManage && !readOnly && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditingCol({ col, anchor: e.currentTarget.closest('th') as HTMLElement });
                        }}
                        title="Editar columna"
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-indigo-100 text-gray-400 hover:text-indigo-600 flex-shrink-0"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                    </div>
                    <div className="flex items-center gap-1">
                    <ColumnFilterDropdown
                      colId={col.id} colName={col.name}
                      uniqueValues={columnUniqueValues[col.id] || []}
                      selected={colFilters[col.id] || new Set<string>()}
                      onApply={sel => onColFilter?.(col.id, sel)}
                      onClear={() => onColFilter?.(col.id, new Set<string>())}
                    />
                    {canManage && (col.options?.length ?? 0) > 0 && (
                      <BulkFillButton colId={col.id} options={col.options!}
                        onFill={(cid, val) => onBulkFill?.(cid, val)} />
                    )}
                    <ResizeHandle onResize={d => setColWidths(p => ({ ...p, [col.id]: Math.max(80, (p[col.id] || col.width || 150) + d) }))} />
                    </div>
                  </div>
                </th>
              ))}
              <th className="qhm-th qhm-th-sticky-right" style={{ width: 190, minWidth: 190 }}>
                <div className="flex items-center justify-between w-full gap-1 group/estado">
                  <span>Estado</span>
                  {canManage && !readOnly && onStatusOptionsChange && (
                    <button
                      onClick={() => setEditingStatus(true)}
                      title="Editar opciones de estado"
                      className="opacity-0 group-hover/estado:opacity-100 text-gray-400 hover:text-indigo-600 p-0.5 rounded transition-all">
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {visibleCases.map((caseObj, rowIdx) => {
              const exec   = caseObj.executions?.[0] || {};
              const status = (exec.status || 'PENDING') as string;
              return (
                <tr key={caseObj.id} className={`group qhm-row ${statusRowCls(status)}`}>
                  <td className="qhm-td qhm-td-sticky-left text-center text-blue-400 font-bold text-xs select-none" style={{ width: 40 }}>{rowIdx + 1}</td>

                  {columns.map((col, colIdx) => {
                    const entry = layout.get(`${rowIdx}:${colIdx}`);
                    if (entry?.skip) return null;
                    const rowspan  = entry?.rowspan ?? 1;
                    const colspan  = entry?.colspan ?? 1;
                    const isMerged = rowspan > 1 || colspan > 1;
                    const value    = getCellVal(caseObj, col.id, colIdx, hierarchyColCount, hierOffset);
                    // selection highlight is handled via DOM classList (qhm-selected) — no React state needed

                    return (
                      <td key={col.id} rowSpan={rowspan} colSpan={colspan}
                        data-mat-row={rowIdx} data-mat-col={colIdx}
                        className={['qhm-td', isMerged ? 'qhm-merged' : ''].filter(Boolean).join(' ')}
                        style={{ verticalAlign: isMerged ? 'top' : 'middle', padding: '2px 8px' }}
                        onContextMenu={isMerged && canManage && !readOnly ? (e) => {
                          e.preventDefault();
                          // Show merge bar at cursor so "Separar" button is available
                          setMergeBar({ x: e.clientX, y: e.clientY - 60, r1: rowIdx, r2: rowIdx, c1: colIdx, c2: colIdx });
                        } : undefined}
                      >
                        {col.type === 'dropdown' && !readOnly ? (
                          <select value={value}
                            onChange={e => onCellSave?.(caseObj.id, col.id, e.target.value, caseObj)}
                            className="w-full text-xs bg-white border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400">
                            <option value="">— —</option>
                            {/* Always include the current value even if not in options (data integrity) */}
                            {value && !(col.options || []).includes(value) && (
                              <option value={value}>{value}</option>
                            )}
                            {(col.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <TextCellPopover value={value}
                            onSave={val => onCellSave?.(caseObj.id, col.id, val, caseObj)}
                            readOnly={readOnly} />
                        )}
                      </td>
                    );
                  })}

                  <td className="qhm-td qhm-td-sticky-right" style={{ padding: '2px 6px', width: 190 }}>
                    <div className="flex items-center gap-1.5">
                      {readOnly ? (
                        <span className={`text-xs font-semibold rounded-lg px-2 py-1 border ${statusCls(status)}`}>{status}</span>
                      ) : (
                        <select
                          className={`text-xs font-semibold rounded-lg px-2 py-1.5 border cursor-pointer focus:outline-none flex-1 ${statusCls(status)}`}
                          value={status} onChange={e => onStatusChange?.(caseObj, e.target.value)}>
                          {/* Always include current value if not in the list (backward compat) */}
                          {!resolvedStatusOpts.includes(status) && (
                            <option value={status}>{statusLabel(status)}</option>
                          )}
                          {resolvedStatusOpts.map(o => (
                            <option key={o} value={o}>{statusLabel(o)}</option>
                          ))}
                        </select>
                      )}
                      {canManage && !readOnly && (
                        <button onClick={() => onDeleteRow?.(caseObj.id)} title="Eliminar fila"
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-1 rounded transition-all flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mergeBar && canManage && !readOnly && createPortal(
        <div ref={mergeBarRef}
          className="fixed z-[9999] bg-white rounded-2xl shadow-2xl border border-gray-200 px-3 py-2 flex items-center gap-2 text-sm pointer-events-auto"
          style={{ top: Math.max(8, mergeBar.y), left: Math.max(8, mergeBar.x - 180) }}
          onMouseDown={e => e.stopPropagation()}>
          <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-gray-200 rotate-45" />
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {mergeBar.r2 - mergeBar.r1 + 1} filas{mergeBar.c2 > mergeBar.c1 && ` × ${mergeBar.c2 - mergeBar.c1 + 1} cols`}
          </span>
          {barHasMerge ? (
            <button onClick={removeMerge}
              className="px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-700 border border-red-200 rounded-xl hover:bg-red-100 transition-colors whitespace-nowrap">
              Separar
            </button>
          ) : (
            <button onClick={applyMerge}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors whitespace-nowrap">
              Combinar
            </button>
          )}
          <button onClick={() => { setMergeBar(null); clearSelectionRef.current(); }}
            className="text-gray-400 hover:text-gray-600 px-1.5 py-1 rounded-lg hover:bg-gray-100 transition-colors text-xs">
            ✕
          </button>
        </div>,
        document.body,
      )}

      {/* Column editor panel */}
      {editingCol && (
        <ColumnEditor
          col={editingCol.col}
          anchorEl={editingCol.anchor}
          existingValues={columnUniqueValues[editingCol.col.id] || []}
          onSave={patch => { onColumnEdit?.(editingCol.col.id, patch); setEditingCol(null); }}
          onClose={() => setEditingCol(null)}
        />
      )}

      {/* Status options editor */}
      {editingStatus && (
        <StatusOptionsEditor
          options={resolvedStatusOpts}
          onSave={(opts) => { onStatusOptionsChange?.(opts); setEditingStatus(false); }}
          onClose={() => setEditingStatus(false)}
        />
      )}
    </div>
  );
}
