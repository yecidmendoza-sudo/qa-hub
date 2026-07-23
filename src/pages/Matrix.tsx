import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Check, X, AlertTriangle, Clock, Plus, Trash2, Settings2 } from 'lucide-react';
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

// ─── Status Badge ────────────────────────────────────────────────────────────
const getStatusBadge = (status: string) => {
  const map: Record<string, { icon: any; label: string; cls: string }> = {
    PASS:    { icon: Check,         label: 'PASS',    cls: 'bg-green-100 text-green-800 border-green-200' },
    FAIL:    { icon: X,             label: 'FAIL',    cls: 'bg-red-100 text-red-800 border-red-200' },
    BLOCKED: { icon: AlertTriangle, label: 'BLOCKED', cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    PENDING: { icon: Clock,         label: 'PENDING', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  };
  const s = map[status] || map['PENDING'];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${s.cls}`}>
      <Icon className="w-3 h-3 mr-1" />{s.label}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Matrix() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [cycle, setCycle] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isColModalOpen, setIsColModalOpen] = useState(false);

  const isAdmin = profile?.role === 'ADMIN';

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
    const updatedCols = await addCustomColumn(cycle, name, type, options, profile.email);
    setCycle({ ...cycle, custom_columns: updatedCols });
  };

  const handleDeleteColumn = async (colIdentifier: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta columna?')) return;
    const updatedCols = await deleteCustomColumn(cycle, colIdentifier, profile.email);
    setCycle({ ...cycle, custom_columns: updatedCols });
  };

  const handleCustomDataChange = async (caseId: string, existingData: any, colId: string, value: string) => {
    const updated = await updateCustomData(caseId, existingData, colId, value);
    setCases(cases.map(c => c.id === caseId ? { ...c, custom_data: updated } : c));
  };

  const handleStatusChange = async (testCase: any, newStatus: string) => {
    const exec = testCase.executions?.[0];
    await updateExecution(cycle, testCase, newStatus, exec?.id || null, profile.email);
    loadMatrix();
  };

  const handleAddRow = async () => {
    await addTestCase(id!, cases.length);
    loadMatrix();
  };

  const handleDeleteRow = async (caseId: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este caso de prueba?')) return;
    await deleteTestCase(caseId);
    setCases(cases.filter(c => c.id !== caseId));
  };

  const handleObservationBlur = async (executionId: string | undefined, value: string) => {
    if (executionId) await updateObservation(executionId, value);
  };

  const handleCellBlur = async (caseId: string, field: string, value: string) => {
    await updateTestCaseField(caseId, field, value);
  };

  // ── Derived state ────────────────────────────────────────────────────────────
  if (loading) return <div className="p-8 text-gray-500">Cargando matriz...</div>;
  if (!cycle)  return <div className="p-8 text-gray-500">Ciclo no encontrado.</div>;

  const customCols = cycle.custom_columns || [];
  const total = cases.length;
  const completed = cases.filter(c => ['PASS', 'FAIL'].includes(c.executions?.[0]?.status)).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/cycles" className="text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {cycle.type} TEST — {cycle.project?.name} {cycle.version}
            </h1>
            <p className="text-sm text-gray-500">Editor Dinámico de Matriz</p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center space-x-2">
            <CsvImporter cycle={cycle} casesCount={cases.length} onImportDone={loadMatrix} />
            <button
              onClick={() => setIsColModalOpen(true)}
              className="flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-semibold transition-colors border border-indigo-200"
            >
              <Settings2 className="w-4 h-4 mr-2" />
              Añadir Columna
            </button>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-gray-700">Progreso del Ciclo</span>
          <span className="text-sm font-bold text-blue-600">{percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
        </div>
        <div className="mt-2 text-xs text-gray-500">{completed} de {total} casos completados</div>
      </div>

      {/* Table */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden overflow-x-auto pb-32">
        <table className="min-w-full text-left border-collapse">
          <thead>
            <tr className="bg-blue-50 border-b border-blue-100">
              <th className="px-4 py-3 text-xs font-bold text-blue-900 uppercase min-w-[80px]">#</th>
              <th className="px-4 py-3 text-xs font-bold text-blue-900 uppercase min-w-[120px]">Ticket</th>
              <th className="px-4 py-3 text-xs font-bold text-blue-900 uppercase min-w-[200px]">Task Name</th>
              <th className="px-4 py-3 text-xs font-bold text-blue-900 uppercase min-w-[150px]">Módulo / Vía</th>

              {customCols.map((col: any) => (
                <th key={col.id || col.name} className="px-4 py-3 text-xs font-bold text-indigo-900 uppercase min-w-[150px] bg-indigo-50 border-l border-indigo-100 group">
                  <div className="flex items-center justify-between">
                    <span>{col.name}</span>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteColumn(col.id || col.name)}
                        className="opacity-0 group-hover:opacity-100 text-indigo-300 hover:text-red-500 transition-opacity ml-2 p-1 rounded"
                        title="Eliminar columna"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}

              <th className="px-4 py-3 text-xs font-bold text-blue-900 uppercase min-w-[200px] border-l border-blue-100">Expected Result</th>
              <th className="px-4 py-3 text-xs font-bold text-blue-900 uppercase min-w-[120px]">Status</th>
              <th className="px-4 py-3 text-xs font-bold text-blue-900 uppercase min-w-[150px]">Observación</th>
              <th className="px-4 py-3 text-xs font-bold text-blue-900 uppercase">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {cases.length === 0 ? (
              <tr>
                <td colSpan={9 + customCols.length} className="px-6 py-8 text-center text-gray-400">
                  No hay casos de prueba. Añade uno manualmente o importa un CSV.
                </td>
              </tr>
            ) : (
              cases.map((c, index) => {
                const execution = c.executions?.[0] || { status: 'PENDING', observation: '' };
                const customData = c.custom_data || {};
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-bold text-blue-600 whitespace-nowrap">TC-{index + 1}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                      {c.ticket_url ? (
                        <a href={c.ticket_url} target="_blank" className="text-blue-600 hover:underline">{c.ticket_id}</a>
                      ) : (
                        <input
                          type="text"
                          defaultValue={c.ticket_id}
                          onBlur={e => handleCellBlur(c.id, 'ticket_id', e.target.value)}
                          placeholder="ID de Tarea..."
                          className="w-24 bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <input
                        type="text"
                        defaultValue={c.title}
                        onBlur={e => handleCellBlur(c.id, 'title', e.target.value)}
                        className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <input
                        type="text"
                        defaultValue={c.module}
                        onBlur={e => handleCellBlur(c.id, 'module', e.target.value)}
                        className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none"
                      />
                    </td>

                    {customCols.map((col: any) => (
                      <td key={col.id || col.name} className="px-4 py-3 border-l border-gray-100 bg-gray-50/30">
                        {col.type === 'dropdown' ? (
                          <select
                            value={customData[col.id] || ''}
                            onChange={e => handleCustomDataChange(c.id, customData, col.id, e.target.value)}
                            className="w-full text-sm bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none px-1 py-1"
                          >
                            <option value="">— Seleccionar —</option>
                            {col.options?.map((opt: string) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={customData[col.id] || ''}
                            onChange={e => handleCustomDataChange(c.id, customData, col.id, e.target.value)}
                            placeholder="..."
                            className="w-full text-sm bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none px-1 py-1"
                          />
                        )}
                      </td>
                    ))}

                    <td className="px-4 py-3 text-sm text-gray-600 border-l border-gray-100">
                      <input
                        type="text"
                        defaultValue={c.expected_result}
                        onBlur={e => handleCellBlur(c.id, 'expected_result', e.target.value)}
                        className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{getStatusBadge(execution.status)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <input
                        type="text"
                        defaultValue={execution.observation}
                        onBlur={e => handleObservationBlur(execution.id, e.target.value)}
                        placeholder="Sin notas"
                        className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none text-xs"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <select
                          className="text-xs border-gray-300 rounded-md shadow-sm bg-white px-2 py-1 border"
                          value={execution.status}
                          onChange={e => handleStatusChange(c, e.target.value)}
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="PASS">PASS</option>
                          <option value="FAIL">FAIL</option>
                          <option value="BLOCKED">BLOCKED</option>
                        </select>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteRow(c.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors p-1"
                            title="Eliminar caso"
                          >
                            <Trash2 className="w-4 h-4" />
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
              <td colSpan={9 + customCols.length} className="px-4 py-3 bg-gray-50/50">
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

      {/* Modal */}
      {isColModalOpen && (
        <AddColumnModal
          onAdd={handleAddColumn}
          onClose={() => setIsColModalOpen(false)}
        />
      )}
    </div>
  );
}
