import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Settings2 } from 'lucide-react';
import ViewPublicButton from '../components/shared/ViewPublicButton';
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
} from '../lib/services/matrixService';
import AddColumnModal from '../components/matrix/AddColumnModal';
import CsvImporter from '../components/matrix/CsvImporter';
import TextCellPopover from '../components/matrix/TextCellPopover';

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_SELECT_CLS: Record<string, string> = {
  PASS:    'bg-green-100 text-green-800 border-green-300 focus:ring-green-400',
  FAIL:    'bg-red-100   text-red-800   border-red-300   focus:ring-red-400',
  BLOCKED: 'bg-yellow-100 text-yellow-800 border-yellow-300 focus:ring-yellow-400',
  PENDING: 'bg-gray-100  text-gray-700  border-gray-300  focus:ring-gray-400',
};

const STATUS_ICON: Record<string, string> = {
  PASS: '✅', FAIL: '❌', BLOCKED: '⚠️', PENDING: '⏳',
};


// ── Main Component ───────────────────────────────────────────────────────────
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

  const canManage = ['ADMIN', 'QA_LEAD'].includes(profile?.role ?? '');

  const loadMatrix = async () => {
    if (!id) return;
    setLoading(true);
    const { cycle: c, cases: cs } = await fetchMatrix(id);
    setCycle(c);
    setCases(cs);
    setLoading(false);
  };

  useEffect(() => { loadMatrix(); }, [id]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleAddColumn = async (name: string, type: string, options: string[]) => {
    try {
      const updatedCols = await addCustomColumn(cycle, name, type, options, profile.email);
      setCycle({ ...cycle, custom_columns: updatedCols });
    } catch (err: any) {
      alert(`Error al agregar columna: ${err.message}`);
    }
  };

  const handleDeleteColumn = async (colIdentifier: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta columna?')) return;
    try {
      const updatedCols = await deleteCustomColumn(cycle, colIdentifier, profile.email);
      setCycle({ ...cycle, custom_columns: updatedCols });
    } catch (err: any) {
      alert(`Error al eliminar columna: ${err.message}`);
    }
  };

  const handleCustomDataChange = async (caseId: string, existingData: any, colId: string, value: string) => {
    try {
      const updated = await updateCustomData(caseId, existingData, colId, value);
      setCases(cases.map(c => c.id === caseId ? { ...c, custom_data: updated } : c));
    } catch (err: any) {
      console.error('Error al actualizar dato:', err.message);
    }
  };

  const handleStatusChange = async (testCase: any, newStatus: string) => {
    // Optimistic update
    setCases(prev => prev.map(c =>
      c.id === testCase.id
        ? { ...c, executions: [{ ...(c.executions?.[0] || {}), status: newStatus }] }
        : c
    ));
    try {
      const exec = testCase.executions?.[0];
      await updateExecution(cycle, testCase, newStatus, exec?.id || null, profile.email);
    } catch (err: any) {
      console.error('Error al cambiar estado:', err.message);
      loadMatrix();
    }
  };

  const handleAddRow = async () => {
    try {
      await addTestCase(id!, cases.length);
      loadMatrix();
    } catch (err: any) {
      alert(`Error al agregar caso: ${err.message}`);
    }
  };

  const handleDeleteRow = async (caseId: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este caso de prueba?')) return;
    try {
      await deleteTestCase(caseId);
      setCases(cases.filter(c => c.id !== caseId));
    } catch (err: any) {
      alert(`Error al eliminar caso: ${err.message}`);
    }
  };

  const handleCellBlur = async (caseId: string, field: string, value: string) => {
    try {
      await updateTestCaseField(caseId, field, value);
    } catch (err: any) {
      console.error('Error al guardar celda:', err.message);
    }
  };

  // ── Derived state ────────────────────────────────────────────────────────────
  if (loading) return <div className="p-8 text-gray-500">Cargando matriz...</div>;
  if (!cycle)  return <div className="p-8 text-gray-500">Ciclo no encontrado.</div>;

  // Data-driven mode: activated whenever there are ANY custom_columns defined.
  // Reserved IDs (_title, _module, _expected_result, _observation) map to DB fields directly.
  // Legacy mode only applies to very old cycles with ZERO custom_columns.

  const allCols: any[] = (cycle.custom_columns || []).filter(
    (c: any) => c.id !== 'sort_order'
  );
  // Data-driven: any cycle that has custom_columns → use this mode
  const isDataDriven = allCols.length > 0;
  // If _title is not in the list (old release-publisher cycles), prepend it automatically
  const hasTitleCol = allCols.some((c: any) => c.id === '_title');
  const effectiveCols: any[] = isDataDriven && !hasTitleCol
    ? [{ id: '_title', name: 'Task Name', type: 'text' }, ...allCols]
    : allCols;
  // For legacy mode only: non-reserved custom cols
  const customCols: any[] = allCols.filter((c: any) => !c.id?.startsWith('_'));

  const total = cases.length;

  const statusCounts = { PASS: 0, FAIL: 0, BLOCKED: 0, PENDING: 0 } as Record<string, number>;
  cases.forEach(c => {
    const s = c.executions?.[0]?.status || 'PENDING';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });
  const completed = (statusCounts.PASS || 0) + (statusCounts.FAIL || 0);
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // ── Filters ───────────────────────────────────────────────────────────────────
  // Split semicolon-separated reviewer strings (e.g. "Fabricio Mariscal; Lisette Nina")
  const allReviewers = Array.from(new Set(
    cases.flatMap(c =>
      (c.custom_data?.qa_reviewer || '')
        .split(';')
        .map((r: string) => r.trim())
        .filter(Boolean)
    )
  )).sort();

  const filteredCases = cases.filter(c => {
    const status = c.executions?.[0]?.status || 'PENDING';
    if (filterStatus !== 'ALL' && status !== filterStatus) return false;
    if (filterReviewer !== 'ALL') {
      // match if reviewer appears anywhere in a possibly semicolon-separated value
      const reviewers = (c.custom_data?.qa_reviewer || '')
        .split(';').map((r: string) => r.trim());
      if (!reviewers.includes(filterReviewer)) return false;
    }
    if (filterText) {
      const q = filterText.toLowerCase();
      const inTitle = (c.title || '').toLowerCase().includes(q);
      const inModule = (c.module || '').toLowerCase().includes(q);
      const inCustom = Object.values(c.custom_data || {}).some(
        v => String(v || '').toLowerCase().includes(q)
      );
      if (!inTitle && !inModule && !inCustom) return false;
    }
    return true;
  });
  const filteredTotal = filteredCases.length;


  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start space-x-3">
          <Link to="/cycles" className="text-gray-500 hover:text-gray-900 mt-1 flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 leading-tight">
              {cycle.type} TEST
            </h1>
            <p className="text-sm text-gray-500 truncate">{cycle.project?.name} — {cycle.version}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Share public link — visible to everyone */}
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
                <Settings2 className="w-4 h-4 mr-1.5" />
                Añadir Columna
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress + Stats */}
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
            <span
              key={status}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold border ${STATUS_SELECT_CLS[status] || STATUS_SELECT_CLS.PENDING}`}
            >
              {STATUS_ICON[status]} {status}: {count}
            </span>
          ))}
          <span className="text-gray-400 ml-auto">{completed} / {total} completados</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex flex-wrap gap-3 items-center">
        {/* Text search */}
        <div className="flex-1 min-w-[180px] relative">
          <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar tarea, proyecto, assignee..."
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
          />
        </div>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
        >
          <option value="ALL">Todos los estados</option>
          {['PENDING', 'PASS', 'FAIL', 'BLOCKED'].map(s => (
            <option key={s} value={s}>{STATUS_ICON[s]} {s} ({statusCounts[s] || 0})</option>
          ))}
        </select>

        {/* QA Reviewer filter */}
        {allReviewers.length > 0 && (
          <select
            value={filterReviewer}
            onChange={e => setFilterReviewer(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
          >
            <option value="ALL">Todos los revisores</option>
            {allReviewers.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}

        {/* Clear filters */}
        {(filterText || filterStatus !== 'ALL' || filterReviewer !== 'ALL') && (
          <button
            onClick={() => { setFilterText(''); setFilterStatus('ALL'); setFilterReviewer('ALL'); }}
            className="text-xs text-gray-500 hover:text-red-500 underline transition-colors"
          >
            Limpiar filtros
          </button>
        )}

        {/* Result count */}
        <span className="ml-auto text-xs text-gray-400">
          {filteredTotal} / {total} casos
        </span>
      </div>

      {/* Table */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-x-auto pb-32">
        <table className="min-w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-blue-100">
              {/* # — always first */}
              <th className="px-3 py-3 text-xs font-bold text-blue-900 uppercase min-w-[60px] sticky top-0 z-20 bg-blue-50">#</th>

              {isDataDriven ? (
                /* DATA-DRIVEN: render columns exactly as defined in custom_columns */
                effectiveCols.map((col: any) => (
                  <th
                    key={col.id}
                    className={`group px-3 py-3 text-xs font-bold uppercase min-w-[160px] sticky top-0 z-20 ${
                      col.id?.startsWith('_')
                        ? 'text-blue-900 bg-blue-50'
                        : 'text-indigo-900 bg-indigo-50 border-l border-indigo-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>{col.name}</span>
                      {col.id?.startsWith('_') ? (
                        /* Reserved column — show lock icon, not deletable */
                        <span
                          title="Columna estructural — no se puede eliminar"
                          className="opacity-0 group-hover:opacity-60 text-blue-400 text-[10px] cursor-help transition-opacity"
                        >🔒</span>
                      ) : canManage && (
                        /* Custom column — deletable */
                        <button
                          onClick={() => handleDeleteColumn(col.id)}
                          className="opacity-0 group-hover:opacity-100 text-indigo-300 hover:text-red-500 transition-opacity p-0.5 rounded"
                          title="Eliminar columna"
                        >✕</button>
                      )}
                    </div>
                  </th>
                ))
              ) : (
                /* LEGACY: hardcoded fixed cols + custom cols + observation */
                <>
                  <th className="px-3 py-3 text-xs font-bold text-blue-900 uppercase min-w-[200px] sticky top-0 z-20 bg-blue-50">Task Name</th>
                  <th className="px-3 py-3 text-xs font-bold text-blue-900 uppercase min-w-[130px] sticky top-0 z-20 bg-blue-50">Módulo / Vía</th>
                  <th className="px-3 py-3 text-xs font-bold text-blue-900 uppercase min-w-[180px] border-l border-blue-100 sticky top-0 z-20 bg-blue-50">Expected Result</th>
                  {customCols.map((col: any) => (
                    <th
                      key={col.id || col.name}
                      className="px-3 py-3 text-xs font-bold text-indigo-900 uppercase min-w-[160px] bg-indigo-50 border-l border-indigo-100 group sticky top-0 z-20"
                    >
                      <div className="flex items-center justify-between">
                        <span>{col.name}</span>
                        {canManage && (
                          <button
                            onClick={() => handleDeleteColumn(col.id || col.name)}
                            className="opacity-0 group-hover:opacity-100 text-indigo-300 hover:text-red-500 transition-opacity ml-1 p-0.5 rounded"
                            title="Eliminar columna"
                          >✕</button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-xs font-bold text-blue-900 uppercase min-w-[180px] border-l border-blue-100 sticky top-0 z-20 bg-blue-50">Observación</th>
                </>
              )}

              {/* Estado — always last, sticky right */}
              <th className="px-3 py-3 text-xs font-bold text-blue-900 uppercase min-w-[140px] sticky top-0 right-0 z-30 bg-blue-50 border-l border-blue-200 shadow-l">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredCases.length === 0 ? (
              <tr>
                <td colSpan={3 + effectiveCols.length} className="px-6 py-8 text-center text-gray-400">
                  {cases.length === 0
                    ? 'No hay casos de prueba. Añade uno manualmente o importa un CSV.'
                    : `No hay resultados para los filtros aplicados. (${total} casos en total)`
                  }
                </td>
              </tr>
            ) : (
              filteredCases.map((c, index) => {
                const execution = c.executions?.[0] || { status: 'PENDING', observation: '' };
                const customData = c.custom_data || {};
                const currentStatus: string = execution.status || 'PENDING';

                return (
                  <tr key={c.id} className="hover:bg-gray-50/60 transition-colors group">
                    {/* # */}
                    <td className="px-3 py-2 text-xs font-bold text-blue-500 whitespace-nowrap">
                      {index + 1}
                    </td>

                {isDataDriven ? (
                  /* DATA-DRIVEN CELLS: render in effectiveCols order, reserved IDs map to DB fields */
                  effectiveCols.map((col: any) => {
                    if (col.id === '_title') return (
                      <td key="_title" className="px-3 py-2 text-xs text-gray-700 max-w-[220px]">
                        <div className="max-w-[210px] overflow-hidden">
                          <TextCellPopover value={c.title || ''} onSave={val => handleCellBlur(c.id, 'title', val)} placeholder="Nombre del caso..." />
                        </div>
                      </td>
                    );
                    if (col.id === '_module') return (
                      <td key="_module" className="px-3 py-2 text-xs text-gray-600 max-w-[140px]">
                        <div className="max-w-[130px] overflow-hidden">
                          <input type="text" defaultValue={c.module} onBlur={e => handleCellBlur(c.id, 'module', e.target.value)}
                            className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none text-xs" />
                        </div>
                      </td>
                    );
                    if (col.id === '_expected_result') return (
                      <td key="_expected_result" className="px-3 py-2 text-xs text-gray-600 border-l border-gray-100 max-w-[200px]">
                        <div className="max-w-[190px] overflow-hidden">
                          <TextCellPopover value={c.expected_result || ''} onSave={val => handleCellBlur(c.id, 'expected_result', val)} placeholder="Resultado esperado..." />
                        </div>
                      </td>
                    );
                    if (col.id === '_observation') return (
                      <td key="_observation" className="px-3 py-2 text-xs text-gray-600 border-l border-gray-100 max-w-[200px]">
                        <TextCellPopover value={execution.observation || ''} onSave={val => execution.id ? updateObservation(execution.id, val) : Promise.resolve()} placeholder="Sin notas..." />
                      </td>
                    );
                    // Custom (non-reserved) column
                    return (
                      <td key={col.id} className="px-3 py-2 border-l border-gray-100 bg-indigo-50/20 min-w-[160px]">
                        <div className="max-w-[200px] overflow-hidden">
                          {col.type === 'dropdown' ? (
                            <select
                              value={customData[col.id] || ''}
                              onChange={e => handleCustomDataChange(c.id, customData, col.id, e.target.value)}
                              className="w-full text-xs bg-white border border-gray-200 rounded-md px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-700"
                            >
                              <option value="">— Seleccionar —</option>
                              {col.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : (
                            <TextCellPopover value={customData[col.id] || ''} onSave={val => handleCustomDataChange(c.id, customData, col.id, val)} placeholder="..." />
                          )}
                        </div>
                      </td>
                    );
                  })
                ) : (
                  /* LEGACY CELLS */
                  <>
                    <td className="px-3 py-2 text-xs text-gray-700 max-w-[220px]">
                      <div className="max-w-[210px] overflow-hidden">
                        <TextCellPopover value={c.title || ''} onSave={val => handleCellBlur(c.id, 'title', val)} placeholder="Nombre del caso..." />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 max-w-[140px]">
                      <div className="max-w-[130px] overflow-hidden">
                        <input type="text" defaultValue={c.module} onBlur={e => handleCellBlur(c.id, 'module', e.target.value)}
                          className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none text-xs" />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 border-l border-gray-100 max-w-[200px]">
                      <div className="max-w-[190px] overflow-hidden">
                        <TextCellPopover value={c.expected_result || ''} onSave={val => handleCellBlur(c.id, 'expected_result', val)} placeholder="Resultado esperado..." />
                      </div>
                    </td>
                    {customCols.map((col: any) => (
                      <td key={col.id || col.name} className="px-3 py-2 border-l border-gray-100 bg-indigo-50/20 min-w-[160px]">
                        <div className="max-w-[200px] overflow-hidden">
                          {col.type === 'dropdown' ? (
                            <select value={customData[col.id] || ''} onChange={e => handleCustomDataChange(c.id, customData, col.id, e.target.value)}
                              className="w-full text-xs bg-white border border-gray-200 rounded-md px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-700">
                              <option value="">— Seleccionar —</option>
                              {col.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : (
                            <TextCellPopover value={customData[col.id] || ''} onSave={val => handleCustomDataChange(c.id, customData, col.id, val)} placeholder="..." />
                          )}
                        </div>
                      </td>
                    ))}
                    <td className="px-3 py-2 text-xs text-gray-600 border-l border-gray-100 max-w-[200px]">
                      <TextCellPopover value={execution.observation || ''} onSave={val => execution.id ? updateObservation(execution.id, val) : Promise.resolve()} placeholder="Sin notas..." />
                    </td>
                  </>
                )}

                    {/* Estado — sticky, colored select (merged Status + Action) */}
                    <td className={`px-3 py-2 whitespace-nowrap sticky right-0 border-l border-gray-200 transition-colors ${
                      currentStatus === 'PASS'    ? 'bg-green-50/80' :
                      currentStatus === 'FAIL'    ? 'bg-red-50/80' :
                      currentStatus === 'BLOCKED' ? 'bg-yellow-50/80' :
                      'bg-gray-50/80'
                    }`}>
                      <div className="flex items-center gap-1.5">
                        <select
                          className={`text-xs font-semibold rounded-lg px-2 py-1.5 border cursor-pointer focus:outline-none focus:ring-2 transition-all flex-1 ${STATUS_SELECT_CLS[currentStatus] || STATUS_SELECT_CLS.PENDING}`}
                          value={currentStatus}
                          onChange={e => handleStatusChange(c, e.target.value)}
                        >
                          <option value="PENDING">⏳ PENDING</option>
                          <option value="PASS">✅ PASS</option>
                          <option value="FAIL">❌ FAIL</option>
                          <option value="BLOCKED">⚠️ BLOCKED</option>
                        </select>
                        {canManage && (
                          <button
                            onClick={() => handleDeleteRow(c.id)}
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
              })
            )}

            {/* Add Row */}
            <tr>
              <td colSpan={6 + customCols.length} className="px-4 py-3 bg-gray-50/50">
                <button
                  onClick={handleAddRow}
                  className="w-full flex items-center justify-center py-2 text-sm font-semibold text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-gray-300 hover:border-blue-300 rounded-lg transition-all"
                >
                  <Plus className="w-4 h-4 mr-2" /> Añadir Caso Manual
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Add Column Modal */}
      {isColModalOpen && (
        <AddColumnModal
          onAdd={handleAddColumn}
          onClose={() => setIsColModalOpen(false)}
        />
      )}
    </div>
  );
}
