import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Settings2, ChevronUp, ChevronDown, X } from 'lucide-react';
import ViewPublicButton from '../components/shared/ViewPublicButton';
import ColumnFilterDropdown from '../components/matrix/ColumnFilterDropdown';
import { useAuth } from '../lib/supabase/auth';
import {
  fetchMatrix,
  addCustomColumn,
  deleteCustomColumn,
  updateCustomData,
  updateExecution,
  addTestCase,
  deleteTestCase,
  updateTestCaseField,
  updateObservation,
  updateCycleMerges,
} from '../lib/services/matrixService';
import { supabase } from '../lib/supabase/client';
import AddColumnModal from '../components/matrix/AddColumnModal';
import CsvImporter from '../components/matrix/CsvImporter';
import MatrixGrid, { type Merge, type GridColumnDef } from '../components/matrix/MatrixGrid';
import { getCycleStatusOptions } from '../lib/constants/statusOptions';

// ─── Status helpers ────────────────────────────────────────────────────────────
const STATUS_CLS: Record<string, string> = {
  PASS:        'bg-green-100  text-green-800  border-green-300  focus:ring-green-400',
  FAIL:        'bg-red-100    text-red-800    border-red-300    focus:ring-red-400',
  BLOCKED:     'bg-yellow-100 text-yellow-800 border-yellow-300 focus:ring-yellow-400',
  SKIP:        'bg-slate-100  text-slate-700  border-slate-300  focus:ring-slate-400',
  IMPROVEMENT: 'bg-purple-100 text-purple-800 border-purple-300 focus:ring-purple-400',
  PENDING:     'bg-gray-100   text-gray-700   border-gray-300   focus:ring-gray-400',
};
const STATUS_ICON: Record<string, string> = {
  PASS: '✅', FAIL: '❌', BLOCKED: '⚠️', SKIP: '⏭️', IMPROVEMENT: '💡', PENDING: '⏳',
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Matrix() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [cycle, setCycle] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isColModalOpen, setIsColModalOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterReviewer, setFilterReviewer] = useState('ALL');
  const [colFilters, setColFilters] = useState<Record<string, Set<string>>>({});
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [statusOptions, setStatusOptions] = useState<string[]>([]);

  const canManage = ['ADMIN', 'QA_LEAD'].includes(profile?.role ?? '');

  const loadMatrix = async () => {
    if (!id) return;
    setLoading(true);
    const { cycle: c, cases: cs } = await fetchMatrix(id);
    setCycle(c);
    setCases(cs);
    // Load status options from custom_values._status_options (zero migration needed)
    setStatusOptions(getCycleStatusOptions(c?.custom_values));
    setLoading(false);
  };

  useEffect(() => { loadMatrix(); }, [id]);

  // ── Derived data (safe before cycle loads) ─────────────────────────────────
  const allCols: any[] = ((cycle?.custom_columns || []) as any[]).filter(c => c.id !== 'sort_order');
  const isDataDriven = allCols.length > 0;
  // Never auto-prepend _title — only show columns explicitly defined in custom_columns
  const effectiveCols: any[] = allCols;

  // Normalize options: DB stores [{label,value}] but select needs string[]
  const normalizeOptions = (opts: any): string[] => {
    if (!opts || !Array.isArray(opts)) return [];
    return opts.map((o: any) => typeof o === 'string' ? o : (o.value ?? o.label ?? String(o)));
  };

  // Build GridColumnDef[] for MatrixGrid
  const gridColumns: GridColumnDef[] = effectiveCols.map(col => ({
    id: col.id,
    name: col.name,
    type: col.type || 'text',
    options: normalizeOptions(col.options),
    width: col.id === '_observation' ? 200 : 150,
  }));

  // How many columns are "hierarchy" columns (non-reserved, non-data).
  // Used by SpreadsheetGrid as the fallback depth for reading hierarchy_path.
  const DATA_ONLY = new Set(['assignees','dark_mode','light_mode','_observation','ticket',
    'severity','notes','qa_reviewer','priority','preconditions','resolution','avance','_title','_expected_result']);
  const hierarchyColCount = effectiveCols.filter(c => !DATA_ONLY.has(c.id)).length;
  // Where in the gridColumns array do hierarchy columns begin?
  // (e.g. 1 when _title is prepended at index 0)
  const hierOffset = effectiveCols.findIndex(c => !DATA_ONLY.has(c.id));

  // Merges from DB — or auto-computed from hierarchy_path when DB has none yet
  const merges: Merge[] = useMemo(() => {
    const raw: Merge[] = cycle?.custom_values?.merges || [];
    // Filter out any _title merges (virtual col — must never have rowspan)
    const saved: Merge[] = raw.filter(m => m.colId !== '_title' && m.colId !== 'sort_order');
    if (saved.length > 0 || cases.length === 0) return saved;

    // Legacy: auto-compute merges from hierarchy_path for old imported data
    const hierCols = effectiveCols.filter(c => !DATA_ONLY.has(c.id));
    if (!hierCols.length) return [];

    const auto: Merge[] = [];
    for (let ci = 0; ci < hierCols.length; ci++) {
      const col = hierCols[ci];
      let groupStart = 0;
      let groupVal = (cases[0].custom_data?.hierarchy_path || '').split(' > ')[ci] || cases[0].custom_data?.[col.id] || '';

      for (let ri = 1; ri <= cases.length; ri++) {
        const curPath = ri < cases.length ? (cases[ri].custom_data?.hierarchy_path || '').split(' > ')[ci] || cases[ri].custom_data?.[col.id] || '' : null;
        if (curPath !== groupVal || ri === cases.length) {
          const span = ri - groupStart;
          if (span > 1 && groupVal) {
            auto.push({ colId: col.id, startCaseId: cases[groupStart].id, rowCount: span });
          }
          groupStart = ri;
          groupVal = curPath || '';
        }
      }
    }
    return auto;
  }, [cycle?.custom_values?.merges, cases]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cell value getter (for filter/sort) ────────────────────────────────────

  const getCellValue = (c: any, colId: string, colIdx = -1): string => {
    if (colId === '_title')           return c.title || '';
    if (colId === '_module')          return c.module || '';
    if (colId === '_expected_result') return c.expected_result || '';
    if (colId === '_observation')     return c.executions?.[0]?.observation || '';
    if (colId === '__status__')       return c.executions?.[0]?.status || 'PENDING';
    // Try direct custom_data first, then hierarchy_path fallback
    const direct = String(c.custom_data?.[colId] || '');
    if (direct) return direct;
    if (colIdx >= 0 && colIdx < hierarchyColCount) {
      const path: string = c.custom_data?.hierarchy_path || '';
      if (path) return path.split(' > ')[colIdx] || '';
    }
    return '';
  };

  // ── Unique values per column ────────────────────────────────────────────────
  const columnUniqueValues = useMemo(() => {
    const map: Record<string, string[]> = {};
    const cols = [...gridColumns, { id: '__status__', name: 'Estado' }];
    for (let ci = 0; ci < cols.length; ci++) {
      const col = cols[ci];
      const colIdx = gridColumns.indexOf(col as GridColumnDef);
      const vals = new Set<string>();
      for (const row of cases) {
        const v = getCellValue(row, col.id, colIdx >= 0 ? colIdx : -1);
        if (v) vals.add(v);
      }
      map[col.id] = Array.from(vals).sort();
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases, hierarchyColCount]);

  // ── Filtered + sorted cases ────────────────────────────────────────────────
  const filteredCases = useMemo(() => {
    let result = cases.filter(c => {
      const status = c.executions?.[0]?.status || 'PENDING';
      if (filterStatus !== 'ALL' && status !== filterStatus) return false;
      if (filterReviewer !== 'ALL') {
        const reviewers = (c.custom_data?.qa_reviewer || '').split(';').map((r: string) => r.trim());
        if (!reviewers.includes(filterReviewer)) return false;
      }
      if (filterText) {
        const q = filterText.toLowerCase();
        const inTitle = (c.title || '').toLowerCase().includes(q);
        const inCustom = Object.values(c.custom_data || {}).some(v => String(v || '').toLowerCase().includes(q));
        if (!inTitle && !inCustom) return false;
      }
      for (const [colId, sel] of Object.entries(colFilters)) {
        if (sel.size === 0) continue;
        if (!sel.has(getCellValue(c, colId))) return false;
      }
      return true;
    });
    if (sortCol) {
      result = [...result].sort((a, b) => {
        const cmp = getCellValue(a, sortCol).localeCompare(getCellValue(b, sortCol), undefined, { sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [cases, filterText, filterStatus, filterReviewer, colFilters, sortCol, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Early returns (after all hooks) ────────────────────────────────────────
  if (loading) return <div className="p-8 text-gray-500">Cargando matriz...</div>;
  if (!cycle)  return <div className="p-8 text-gray-500">Ciclo no encontrado.</div>;

  // Stats
  const total = cases.length;
  const statusCounts = { PASS: 0, FAIL: 0, BLOCKED: 0, SKIP: 0, IMPROVEMENT: 0, PENDING: 0 } as Record<string, number>;
  cases.forEach(c => { const s = c.executions?.[0]?.status || 'PENDING'; statusCounts[s] = (statusCounts[s] || 0) + 1; });
  const completed = (statusCounts.PASS || 0) + (statusCounts.FAIL || 0) + (statusCounts.SKIP || 0) + (statusCounts.IMPROVEMENT || 0);
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const allReviewers = Array.from(new Set(
    cases.flatMap(c => (c.custom_data?.qa_reviewer || '').split(';').map((r: string) => r.trim()).filter(Boolean))
  )).sort();

  const hasAnyColFilter = Object.values(colFilters).some(s => s.size > 0);
  const filteredTotal = filteredCases.length;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAddColumn = async (name: string, type: string, options: string[]) => {
    try {
      const updatedCols = await addCustomColumn(cycle, name, type, options, profile.email);
      setCycle({ ...cycle, custom_columns: updatedCols });
    } catch (err: any) { alert(`Error al agregar columna: ${err.message}`); }
  };

  const handleDeleteColumn = async (colId: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta columna?')) return;
    try {
      const updatedCols = await deleteCustomColumn(cycle, colId, profile.email);
      setCycle({ ...cycle, custom_columns: updatedCols });
    } catch (err: any) { alert(`Error al eliminar columna: ${err.message}`); }
  };

  const handleUpdateColumn = async (colId: string, patch: { name: string; type: string; options: string[] }) => {
    try {
      const currentCols: any[] = cycle.custom_columns || [];
      const updatedCols = currentCols.map((c: any) =>
        c.id === colId
          ? { ...c, name: patch.name, type: patch.type,
              options: patch.type === 'dropdown'
                ? patch.options.map(v => ({ label: v, value: v }))
                : [] }
          : c
      );
      const { error } = await supabase
        .from('test_cycles')
        .update({ custom_columns: updatedCols })
        .eq('id', cycle.id);
      if (error) throw error;
      setCycle({ ...cycle, custom_columns: updatedCols });
    } catch (err: any) { alert(`Error al actualizar columna: ${err.message}`); }
  };

  const handleStatusChange = async (testCase: any, newStatus: string) => {
    setCases(prev => prev.map(c =>
      c.id === testCase.id ? { ...c, executions: [{ ...(c.executions?.[0] || {}), status: newStatus }] } : c
    ));
    try {
      const exec = testCase.executions?.[0];
      await updateExecution(cycle, testCase, newStatus, exec?.id || null, profile.email);
    } catch (err: any) { console.error('Error al cambiar estado:', err.message); loadMatrix(); }
  };

  // Universal cell save handler — routes by colId to the right DB field
  const handleCellSave = async (caseId: string, colId: string, value: string, caseObj: any) => {
    try {
      if (colId === '_title')           { await updateTestCaseField(caseId, 'title', value); setCases(prev => prev.map(c => c.id === caseId ? { ...c, title: value } : c)); }
      else if (colId === '_expected_result') { await updateTestCaseField(caseId, 'expected_result', value); setCases(prev => prev.map(c => c.id === caseId ? { ...c, expected_result: value } : c)); }
      else if (colId === '_observation') {
        const exec = caseObj.executions?.[0];
        if (exec?.id) await updateObservation(exec.id, value);
        setCases(prev => prev.map(c => c.id === caseId ? { ...c, executions: [{ ...(c.executions?.[0] || {}), observation: value }] } : c));
      }
      else if (colId === '_module')     { await updateTestCaseField(caseId, 'module', value); setCases(prev => prev.map(c => c.id === caseId ? { ...c, module: value } : c)); }
      else {
        const cd = caseObj.custom_data || {};
        const updated = await updateCustomData(caseId, cd, colId, value);
        setCases(prev => prev.map(c => c.id === caseId ? { ...c, custom_data: updated } : c));
      }
    } catch (err: any) { console.error('Error al guardar celda:', err.message); }
  };

  const handleDeleteRow = async (caseId: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este caso de prueba?')) return;
    try {
      await deleteTestCase(caseId);
      setCases(cases.filter(c => c.id !== caseId));
    } catch (err: any) { alert(`Error al eliminar caso: ${err.message}`); }
  };

  const handleAddRow = async () => {
    try { await addTestCase(id!, cases.length); loadMatrix(); }
    catch (err: any) { alert(`Error al agregar caso: ${err.message}`); }
  };

  const handleUpdateStatusOptions = async (opts: string[]) => {
    // Optimistic update
    setStatusOptions(opts);
    setCycle((prev: any) => ({
      ...prev,
      custom_values: { ...(prev?.custom_values || {}), _status_options: opts },
    }));
    try {
      const newCustomValues = { ...(cycle?.custom_values || {}), _status_options: opts };
      const { error } = await supabase
        .from('test_cycles')
        .update({ custom_values: newCustomValues })
        .eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Error al guardar opciones de estado:', err.message);
    }
  };

  const handleMergesChange = async (newMerges: Merge[]) => {
    // Optimistic update
    setCycle((prev: any) => ({ ...prev, custom_values: { ...(prev.custom_values || {}), merges: newMerges } }));
    try { await updateCycleMerges(cycle, newMerges); }
    catch (err: any) { console.error('Error al guardar merges:', err.message); loadMatrix(); }
  };

  const handleSortCol = (colId: string) => {
    if (sortCol === colId) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(colId); setSortDir('asc'); }
  };

  const clearAllFilters = () => { setFilterText(''); setFilterStatus('ALL'); setFilterReviewer('ALL'); setColFilters({}); setSortCol(null); };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start space-x-3">
          <Link to="/cycles" className="text-gray-500 hover:text-gray-900 mt-1 flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 leading-tight">{cycle.type} TEST</h1>
            <p className="text-sm text-gray-500 truncate">— {cycle.version}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewPublicButton
            url={`${window.location.origin}${window.location.pathname.replace(/\/$/, '')}#/cycles/public/${id}`}
            title="Ver ciclo público (sin login)"
            size="sm"
          />
          {canManage && (
            <div className="flex items-center gap-2 flex-wrap">
              <CsvImporter cycle={cycle} casesCount={cases.length} onImportDone={loadMatrix} />
              <button
                onClick={() => setIsColModalOpen(true)}
                className="flex items-center px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-semibold transition-colors border border-indigo-200"
              >
                <Settings2 className="w-4 h-4 mr-1.5" /> Añadir Columna
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-gray-700">Progreso del Ciclo</span>
          <span className="text-sm font-bold text-blue-600">{percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
          <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(statusCounts).map(([status, count]) => (
            <span key={status} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold border ${STATUS_CLS[status] || STATUS_CLS.PENDING}`}>
              {STATUS_ICON[status]} {status}: {count}
            </span>
          ))}
          <span className="text-gray-400 ml-auto">{completed} / {total} completados</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[180px] relative">
          <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Buscar tarea, proyecto, assignee..." value={filterText}
            onChange={e => setFilterText(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700">
          <option value="ALL">Todos los estados</option>
          {['PENDING','PASS','FAIL','BLOCKED','SKIP','IMPROVEMENT'].map(s => (
            <option key={s} value={s}>{STATUS_ICON[s]} {s} ({statusCounts[s] || 0})</option>
          ))}
        </select>
        {allReviewers.length > 0 && (
          <select value={filterReviewer} onChange={e => setFilterReviewer(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700">
            <option value="ALL">Todos los revisores</option>
            {allReviewers.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        {(filterText || filterStatus !== 'ALL' || filterReviewer !== 'ALL' || hasAnyColFilter || sortCol) && (
          <button onClick={clearAllFilters} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors">
            <X className="w-3 h-3" /> Limpiar todo
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{filteredTotal} / {total} casos</span>
      </div>

      {/* Active filter chips */}
      {hasAnyColFilter && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {[...gridColumns, { id: '__status__', name: 'Estado' }].map(col => {
            const sel = colFilters[col.id];
            if (!sel || sel.size === 0) return null;
            return (
              <span key={col.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium border border-blue-200">
                <span className="font-semibold">{col.name}:</span>
                <span>{Array.from(sel).join(', ')}</span>
                <button onClick={() => setColFilters(prev => { const n = { ...prev }; delete n[col.id]; return n; })} className="ml-0.5 text-blue-400 hover:text-red-500">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* ── MATRIX GRID (AG Grid) ─────────────────────────────────────────── */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
        <MatrixGrid
          cases={filteredCases}
          columns={gridColumns}
          merges={merges}
          hierarchyColCount={hierarchyColCount}
          hierOffset={hierOffset}
          canManage={canManage}
          onStatusChange={handleStatusChange}
          onCellSave={handleCellSave}
          onDeleteRow={handleDeleteRow}
          onMergesChange={handleMergesChange}
          colFilters={colFilters}
          columnUniqueValues={columnUniqueValues}
          onColFilter={(colId, selected) => setColFilters(prev => ({ ...prev, [colId]: selected }))}
          onBulkFill={async (colId, value) => {
            if (!window.confirm(`¿Rellenar TODA la columna "${gridColumns.find(c => c.id === colId)?.name}" con "${value}"?`)) return;
            try {
              for (const c of filteredCases) {
                await updateCustomData(c.id, c.custom_data || {}, colId, value);
              }
              setCases(prev => prev.map(c => ({
                ...c,
                custom_data: { ...(c.custom_data || {}), [colId]: value },
              })));
            } catch (err: any) { console.error('Error en bulk fill:', err.message); }
          }}
          onColumnEdit={handleUpdateColumn}
          statusOptions={statusOptions}
          onStatusOptionsChange={canManage ? handleUpdateStatusOptions : undefined}
        />


        {/* Add row */}
        {canManage && (
          <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100">
            <button
              onClick={handleAddRow}
              className="w-full flex items-center justify-center py-2 text-sm font-semibold text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-gray-300 hover:border-blue-300 rounded-lg transition-all"
            >
              <Plus className="w-4 h-4 mr-2" /> Añadir Caso Manual
            </button>
          </div>
        )}
      </div>

      {/* Add Column Modal */}
      {isColModalOpen && <AddColumnModal onAdd={handleAddColumn} onClose={() => setIsColModalOpen(false)} />}
    </div>
  );
}


