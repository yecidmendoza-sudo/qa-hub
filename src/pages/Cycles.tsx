import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, ChevronDown, ChevronRight, Trash2, History, ExternalLink, X, Calendar } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/supabase/auth';
import {
  fetchVersionsWithCycles,
  fetchAuditLogs,
  fetchCycleFieldConfigs,
  createVersion,
  deleteVersion,
  createCycle,
  deleteCycle,
} from '../lib/services/cycleService';
import AuditDrawer from '../components/cycles/AuditDrawer';

// ── Status helpers ──────────────────────────────────────────────────────────
const CYCLE_STATUS_STYLES: Record<string, string> = {
  PASSED:      'bg-green-100 text-green-800 border-green-200',
  FAILED:      'bg-red-100 text-red-800 border-red-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-200',
  DRAFT:       'bg-gray-100 text-gray-600 border-gray-200',
};

// ── Main Component ──────────────────────────────────────────────────────────
export default function Cycles() {
  const { selectedProject, profile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === 'ADMIN';

  // Data
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fieldConfigs, setFieldConfigs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [dateSort, setDateSort] = useState<'desc' | 'asc'>('desc');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({});
  const [defaultExpanded, setDefaultExpanded] = useState(false);

  // Modals
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [cycleVersionId, setCycleVersionId] = useState('');
  const [newCycleType, setNewCycleType] = useState('SANITY');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Load data ────────────────────────────────────────────────────────────
  const loadVersions = async () => {
    if (!selectedProject) return;
    setLoading(true);
    const data = await fetchVersionsWithCycles(selectedProject.id);
    const sorted = data.map((v: any) => ({
      ...v,
      test_cycles: (v.test_cycles || []).sort(
        (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    }));
    setVersions(sorted);
    setLoading(false);
  };

  const loadFieldConfigs = async () => {
    if (!selectedProject) return;
    const data = await fetchCycleFieldConfigs(selectedProject.id);
    setFieldConfigs(data);
    const init: Record<string, string> = {};
    data.forEach((f: any) => {
      if (f.field_type === 'DROPDOWN' && f.options?.length > 0) init[f.name] = f.options[0];
    });
    setCustomValues(init);
  };

  const openAudit = async () => {
    if (!selectedProject) return;
    const logs = await fetchAuditLogs(selectedProject.id);
    setAuditLogs(logs);
    setIsAuditOpen(true);
  };

  useEffect(() => {
    if (selectedProject) {
      loadVersions();
      loadFieldConfigs();
    }
  }, [selectedProject]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !profile) return;
    setIsSubmitting(true);
    try {
      await createVersion(selectedProject.id, newVersionName, profile.email);
      setIsVersionModalOpen(false);
      setNewVersionName('');
      loadVersions();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !profile || !cycleVersionId) return;
    setIsSubmitting(true);
    try {
      const versionObj = versions.find(v => v.id === cycleVersionId);
      const data = await createCycle(
        selectedProject.id,
        cycleVersionId,
        versionObj?.name || 'Desconocida',
        newCycleType,
        customValues,
        profile.email
      );
      setIsCycleModalOpen(false);
      navigate(`/cycles/${data.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVersion = async (versionId: string, versionName: string) => {
    if (!profile || !selectedProject) return;
    if (!window.confirm(`¿Eliminar el Release "${versionName}" y TODAS sus matrices? Esta acción es irreversible.`)) return;
    await deleteVersion(selectedProject.id, versionId, versionName, profile.email);
    loadVersions();
  };

  const handleDeleteCycle = async (cycleId: string, cycleType: string) => {
    if (!profile || !selectedProject) return;
    if (!window.confirm(`¿Eliminar la matriz de tipo ${cycleType}?`)) return;
    await deleteCycle(selectedProject.id, cycleId, cycleType, profile.email);
    loadVersions();
  };

  const toggleVersion = (id: string) =>
    setExpandedVersions(prev => ({ ...prev, [id]: !(prev[id] ?? defaultExpanded) }));

  const toggleAllFolders = () => {
    setDefaultExpanded(v => !v);
    setExpandedVersions({});
  };

  // ── Filtering ────────────────────────────────────────────────────────────
  const filteredVersions = useMemo(() => {
    let result = versions.filter(v => {
      const term = searchQuery.toLowerCase();
      const matchName = v.name.toLowerCase().includes(term);
      const matchType = v.test_cycles?.some((c: any) => c.type.toLowerCase().includes(term));
      return matchName || matchType;
    });
    if (startDate) result = result.filter(v => new Date(v.created_at) >= new Date(`${startDate}T00:00:00`));
    if (endDate)   result = result.filter(v => new Date(v.created_at) <= new Date(`${endDate}T23:59:59`));
    return result.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return dateSort === 'desc' ? db - da : da - db;
    });
  }, [versions, searchQuery, dateSort, startDate, endDate]);

  if (!selectedProject) return <div className="p-8 text-center text-gray-500">Selecciona un proyecto.</div>;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Top Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
          Ciclos: <span className="text-blue-600">{selectedProject.name}</span>
        </h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={openAudit} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg font-medium flex items-center hover:bg-gray-50 transition-colors text-sm">
            <History className="w-4 h-4 mr-1.5" /> Historial
          </button>
          {isAdmin && (
            <button onClick={() => setIsVersionModalOpen(true)} className="bg-blue-600 text-white px-3 py-2 rounded-lg font-medium flex items-center hover:bg-blue-700 transition-colors shadow-sm text-sm">
              <Plus className="w-4 h-4 mr-1" /> Nuevo Release
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-3">
        {/* Search + Sort row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar versión o tipo..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select value={dateSort} onChange={e => setDateSort(e.target.value as 'desc' | 'asc')} className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="desc">Más reciente primero</option>
            <option value="asc">Más antiguo primero</option>
          </select>
        </div>
        {/* Date + Toggle row */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-gray-400 text-sm">→</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={toggleAllFolders}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${defaultExpanded ? 'bg-blue-600' : 'bg-gray-300'}`}
              title={defaultExpanded ? 'Colapsar todo' : 'Expandir todo'}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${defaultExpanded ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm text-gray-500 whitespace-nowrap">{defaultExpanded ? 'Colapsar todo' : 'Expandir todo'}</span>
      </div>

      {/* Versions List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando ciclos...</div>
      ) : filteredVersions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {searchQuery ? 'No hay resultados para tu búsqueda.' : 'No hay releases creados todavía.'}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredVersions.map(version => {
            const isExpanded = expandedVersions[version.id] ?? defaultExpanded;
            return (
              <div key={version.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Version Header */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleVersion(version.id)}
                >
                  <div className="flex items-center space-x-3">
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{version.name}</h3>
                      <p className="text-xs text-gray-500">{version.test_cycles?.length || 0} ciclos · {new Date(version.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isAdmin && (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); setCycleVersionId(version.id); setIsCycleModalOpen(true); }}
                          className="flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Ciclo
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteVersion(version.id, version.name); }}
                          className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          title="Eliminar release"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Cycles */}
                {isExpanded && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {(version.test_cycles || []).length === 0 ? (
                      <div className="px-5 py-4 text-sm text-gray-400">No hay ciclos en este release.</div>
                    ) : (
                      version.test_cycles.map((cycle: any) => (
                        <div key={cycle.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center space-x-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${CYCLE_STATUS_STYLES[cycle.status] || CYCLE_STATUS_STYLES['DRAFT']}`}>
                              {cycle.status}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{cycle.type}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(cycle.created_at).toLocaleString()}
                                {cycle.custom_values && Object.keys(cycle.custom_values).length > 0 && (
                                  <span className="ml-2 text-indigo-500">
                                    · {Object.entries(cycle.custom_values).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Link
                              to={`/cycles/${cycle.id}`}
                              className="flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir Matriz
                            </Link>
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteCycle(cycle.id, cycle.type)}
                                className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                title="Eliminar ciclo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {/* New Version Modal */}
      {isVersionModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Nuevo Release / Versión</h3>
              <button onClick={() => setIsVersionModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateVersion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Release</label>
                <input
                  type="text" required
                  value={newVersionName}
                  onChange={e => setNewVersionName(e.target.value)}
                  placeholder="ej. v2.5.0 (Producción)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setIsVersionModalOpen(false)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {isSubmitting ? 'Creando...' : 'Crear Release'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Cycle Modal */}
      {isCycleModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Nuevo Ciclo de Pruebas</h3>
              <button onClick={() => setIsCycleModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateCycle} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Release Destino</label>
                <select
                  value={cycleVersionId}
                  onChange={e => setCycleVersionId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar...</option>
                  {versions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Ciclo</label>
                <select
                  value={newCycleType}
                  onChange={e => setNewCycleType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SANITY">SANITY</option>
                  <option value="SMOKE">SMOKE</option>
                  <option value="REGRESSION">REGRESSION</option>
                  <option value="EXPLORATORIO">EXPLORATORIO</option>
                </select>
              </div>
              {/* Dynamic custom fields */}
              {fieldConfigs.map(f => (
                <div key={f.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {f.name}{f.is_required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {f.field_type === 'DROPDOWN' ? (
                    <select
                      value={customValues[f.name] || ''}
                      onChange={e => setCustomValues(prev => ({ ...prev, [f.name]: e.target.value }))}
                      required={f.is_required}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                    >
                      {f.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={customValues[f.name] || ''}
                      onChange={e => setCustomValues(prev => ({ ...prev, [f.name]: e.target.value }))}
                      required={f.is_required}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              ))}
              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setIsCycleModalOpen(false)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {isSubmitting ? 'Creando...' : 'Crear y Abrir Matriz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Drawer */}
      {isAuditOpen && (
        <AuditDrawer
          logs={auditLogs}
          searchQuery={auditSearch}
          onSearchChange={setAuditSearch}
          onClose={() => setIsAuditOpen(false)}
        />
      )}
    </div>
  );
}
