import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Settings2, Download, Upload, X } from 'lucide-react';
import Papa from 'papaparse';
import MatrixGrid, { type GridColumnDef } from '../components/matrix/MatrixGrid';

import {
  parseMarkdownToMatrixData,
  updatePersonalMatrixData,
  getPersonalMatrixVersion,
  normalizeSections,
  cleanStatusValue,
  type MatrixSection,
  type MatrixCol,
  type MatrixRow,
} from '../lib/services/personalMatrixService';
import AddColumnModal from '../components/matrix/AddColumnModal';
import { getMatrixDataStatusOptions } from '../lib/constants/statusOptions';
import { supabase } from '../lib/supabase/client';

const STATUS_OPTIONS = ['PENDING', 'PASS', 'FAIL', 'BLOCKED'] as const;

};

function genId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function MySpaceMatrix() {
  const { ticketId, versionId } = useParams<{ ticketId: string; versionId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versionMeta, setVersionMeta] = useState<{ version_num: number; stage: string; matrix_type: string } | null>(null);
  const [sections, setSections] = useState<MatrixSection[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isColModalOpen, setIsColModalOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  // Column filters: colId → Set of selected values (empty = no filter)
  const [colFilters, setColFilters] = useState<Record<string, Set<string>>>({});
  // Sort
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  // Raw matrix_data reference (for merging status_options back without losing sections)
  const matrixDataRef = useRef<Record<string, any>>({});

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!versionId) return;
    async function load() {
      setLoading(true);
      try {
        const version = await getPersonalMatrixVersion(versionId!);
        setVersionMeta({
          version_num: version.version_num,
          stage: version.stage,
          matrix_type: version.matrix_type,
        });

        let secs: MatrixSection[];
        if (version.matrix_data) {
          // Save raw matrix_data so we can merge status_options back later
          matrixDataRef.current = version.matrix_data as Record<string, any>;
          // Use stored JSONB — normalize to sections (handles legacy {columns,rows} format too)
          secs = normalizeSections(version.matrix_data as { sections?: MatrixSection[]; columns?: MatrixCol[]; rows?: MatrixRow[] });
          // Re-normalize status cells: agent-save-matrix may store raw text ("✅ Aprobado")
          // instead of the canonical enum value ('PASS'/'FAIL'/'BLOCKED'/'PENDING').
          secs = secs.map(sec => ({
            ...sec,
            rows: sec.rows.map(row => ({
              ...row,
              cells: Object.fromEntries(
                sec.columns.map(col => [
                  col.id,
                  col.type === 'status'
                    ? cleanStatusValue(row.cells[col.id] ?? 'PENDING')
                    : (row.cells[col.id] ?? '')
                ])
              ),
            })),
          }));
        } else if (version.content_md) {
          // Parse markdown → extract ALL tables as sections. Do NOT auto-save here.
          const parsed = parseMarkdownToMatrixData(version.content_md);
          secs = normalizeSections(parsed);
        } else {
          // Blank matrix — single default section
          secs = [{
            id: 'section_0',
            title: 'Casos de Prueba',
            columns: [
              { id: 'col_id',     name: 'ID',                 type: 'text'   },
              { id: 'col_mod',    name: 'Módulo',             type: 'text'   },
              { id: 'col_action', name: 'Acción',             type: 'text'   },
              { id: 'col_result', name: 'Resultado Esperado', type: 'text'   },
              { id: 'col_status', name: 'Estado',             type: 'status' },
            ],
            rows: [],
          }];
        }
        // Load status options from matrix_data.status_options (invisible in grid)
        setStatusOptions(getMatrixDataStatusOptions(version.matrix_data as Record<string, any> | null));
        setSections(secs);
        setActiveIdx(0);

      } catch (e) {
        setError('No se pudo cargar la matriz.');
      } finally {
        setLoading(false);
      }
    }
    load();

  }, [versionId, ticketId]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = useCallback(async (secs: MatrixSection[]) => {
    if (!versionId || !ticketId) return;
    setSaving(true);
    try {
      await updatePersonalMatrixData(versionId, secs, ticketId);
    } catch (e) {
      console.error('Error saving matrix:', e);
    } finally {
      setSaving(false);
    }
  }, [versionId, ticketId]);

  // Helper: update one section and optionally save
  const updateSection = useCallback((idx: number, updater: (sec: MatrixSection) => MatrixSection, persist = false) => {
    setSections(prev => {
      const next = prev.map((s, i) => i === idx ? updater(s) : s);
      if (persist) save(next);
      return next;
    });
  }, [save]);

  // ── Cell update ───────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleCellChange = (rowId: string, colId: string, value: string) => {
    updateSection(activeIdx, sec => ({
      ...sec,
      rows: sec.rows.map(r => r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r),
    }));
  };

  const handleCellBlur = (rowId: string, colId: string, value: string) => {
    setSections(prev => {
      const next = prev.map((s, i) => i !== activeIdx ? s : {
        ...s,
        rows: s.rows.map(r => r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r),
      });
      save(next);
      return next;
    });
  };

  const handleStatusChange = (rowId: string, colId: string, value: string) => {
    setSections(prev => {
      const next = prev.map((s, i) => i !== activeIdx ? s : {
        ...s,
        rows: s.rows.map(r => r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r),
      });
      save(next);
      return next;
    });
  };

  // ── Row actions ───────────────────────────────────────────────────────────
  const handleAddRow = () => {
    setSections(prev => {
      const sec = prev[activeIdx];
      const newRow: MatrixRow = {
        id: genId(),
        cells: Object.fromEntries(
          sec.columns.map(col => [col.id, col.type === 'status' ? 'PENDING' : ''])
        ),
      };
      const next = prev.map((s, i) => i !== activeIdx ? s : { ...s, rows: [...s.rows, newRow] });
      save(next);
      return next;
    });
  };

  const handleDeleteRow = (rowId: string) => {
    if (!window.confirm('¿Eliminar esta fila? Esta acción no se puede deshacer.')) return;
    setSections(prev => {
      const next = prev.map((s, i) => i !== activeIdx ? s : { ...s, rows: s.rows.filter(r => r.id !== rowId) });
      save(next);
      return next;
    });
  };

  const handleUpdateStatusOptions = async (opts: string[]) => {
    setStatusOptions(opts);
    try {
      // Merge status_options into matrix_data without losing sections
      const newData = { ...matrixDataRef.current, status_options: opts };
      matrixDataRef.current = newData;
      const { error } = await supabase
        .from('personal_matrix_versions')
        .update({ matrix_data: newData })
        .eq('id', versionId);
      if (error) throw error;
    } catch (err: any) {
      console.error('Error al guardar opciones de estado:', err.message);
    }
  };

  // ── Column actions ────────────────────────────────────────────────────────
  const handleAddColumn = (name: string, type: string, options: string[]) => {
    const newCol: MatrixCol = {
      id: `col_${genId()}`,
      name,
      type: type as MatrixCol['type'],
      options: options.length > 0 ? options : undefined,
    };
    setSections(prev => {
      const next = prev.map((s, i) => i !== activeIdx ? s : {
        ...s,
        columns: [...s.columns, newCol],
        rows: s.rows.map(r => ({ ...r, cells: { ...r.cells, [newCol.id]: '' } })),
      });
      save(next);
      return next;
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleDeleteColumn = (colId: string) => {
    const col = sections[activeIdx]?.columns.find(c => c.id === colId);
    const colName = col?.name || colId;
    if (!window.confirm(`¿Eliminar la columna "${colName}"? Se borrarán todos los datos de esa columna en todas las filas.`)) return;
    setSections(prev => {
      const next = prev.map((s, i) => i !== activeIdx ? s : {
        ...s,
        columns: s.columns.filter(c => c.id !== colId),
        rows: s.rows.map(r => { const cells = { ...r.cells }; delete cells[colId]; return { ...r, cells }; }),
      });
      save(next);
      return next;
    });
  };

  // ── Section actions ───────────────────────────────────────────────────────
  const handleAddSection = () => {
    const newSec: MatrixSection = {
      id: `section_${genId()}`,
      title: 'Nueva Sección',
      columns: [
        { id: 'col_id',     name: 'ID',                 type: 'text'   },
        { id: 'col_mod',    name: 'Módulo',             type: 'text'   },
        { id: 'col_action', name: 'Acción',             type: 'text'   },
        { id: 'col_result', name: 'Resultado Esperado', type: 'text'   },
        { id: 'col_status', name: 'Estado',             type: 'status' },
      ],
      rows: [],
    };
    setSections(prev => {
      const next = [...prev, newSec];
      save(next);
      setActiveIdx(next.length - 1);
      return next;
    });
  };

  const handleDeleteSection = (idx: number) => {
    if (sections.length <= 1) return;
    if (!confirm(`¿Eliminar la sección "${sections[idx].title || `Sección ${idx + 1}`}"? Esta acción no se puede deshacer.`)) return;
    setSections(prev => {
      const next = prev.filter((_, i) => i !== idx);
      save(next);
      setActiveIdx(Math.min(activeIdx, next.length - 1));
      return next;
    });
  };

  // ── CSV ref ───────────────────────────────────────────────────────────────
  const csvInputRef = useRef<HTMLInputElement>(null);

  // ── Download template (active section) ───────────────────────────────────
  const handleDownloadTemplate = () => {
    const sec = sections[activeIdx];
    if (!sec) return;
    const headers = sec.columns.map(c => c.name).join(',');
    const blob = new Blob([headers + '\n'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla_${ticketId}_v${versionMeta?.version_num ?? 1}_sec${activeIdx + 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Import CSV (active section) ───────────────────────────────────────────
  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const sec = sections[activeIdx];
    if (!file || !sec) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        if (!rows || rows.length === 0) return;

        const newRows: MatrixRow[] = rows.map(row => {
          const cells: Record<string, string> = {};
          sec.columns.forEach(col => {
            const key = Object.keys(row).find(
              k => k.toLowerCase().trim() === col.name.toLowerCase().trim()
            );
            cells[col.id] = key ? (row[key] ?? '') : (col.type === 'status' ? 'PENDING' : '');
          });
          return { id: genId(), cells };
        });

        // Ask user how to handle existing rows (only if section already has data)
        let replaceExisting = false;
        if (sec.rows.length > 0) {
          replaceExisting = window.confirm(
            `Esta sección ya tiene ${sec.rows.length} fila(s).\n\n` +
            `¿Reemplazar todas las filas con las del CSV?\n\n` +
            `✅ Aceptar = Reemplazar (actualiza la matriz completa)\n` +
            `❌ Cancelar = Agregar al final`
          );
        }

        setSections(prev => {
          const next = prev.map((s, i) => i !== activeIdx ? s : {
            ...s,
            rows: replaceExisting ? newRows : [...s.rows, ...newRows],
          });
          save(next);
          return next;
        });
      },
      error: () => alert('Error al leer el archivo CSV.'),
    });

    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  // ── Per-column helpers ─────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleSortCol = (colId: string) => {
    if (sortCol === colId) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(colId);
      setSortDir('asc');
    }
  };

  const clearAllFilters = () => {
    setFilterText('');
    setFilterStatus('ALL');
    setColFilters({});
    setSortCol(null);
  };

  const hasAnyColFilter = Object.values(colFilters).some(s => s.size > 0);

  // ── Memos for current section (must be at component level, not inside IIFE) ─
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _columnUniqueValues = useMemo(() => {
    if (sections.length === 0) return {} as Record<string, string[]>;
    const sec = sections[activeIdx];
    const map: Record<string, string[]> = {};
    for (const col of sec.columns) {
      const vals = new Set<string>();
      for (const row of sec.rows) {
        const v = String(row.cells[col.id] ?? '');
        if (v) vals.add(v);
      }
      map[col.id] = Array.from(vals).sort();
    }
    return map;
  }, [sections, activeIdx]);

  const displayRows = useMemo(() => {
    if (sections.length === 0) return [] as typeof sections[0]['rows'];
    const sec = sections[activeIdx];
    const statusCol = sec.columns.find(c => c.type === 'status');
    let result = sec.rows.filter(row => {
      if (filterStatus !== 'ALL' && statusCol && (row.cells[statusCol.id] ?? 'PENDING') !== filterStatus) return false;
      if (filterText) {
        const q = filterText.toLowerCase();
        if (!Object.values(row.cells).some(v => String(v || '').toLowerCase().includes(q))) return false;
      }
      for (const [colId, selVals] of Object.entries(colFilters)) {
        if (selVals.size === 0) continue;
        const col = sec.columns.find(c => c.id === colId);
        if (!col) continue;
        const val = String(row.cells[col.id] ?? '');
        if (!selVals.has(val)) return false;
      }
      return true;
    });
    if (sortCol) {
      const col = sec.columns.find(c => c.id === sortCol);
      if (col) {
        result = [...result].sort((a, b) => {
          const av = String(a.cells[col.id] ?? '');
          const bv = String(b.cells[col.id] ?? '');
          const cmp = av.localeCompare(bv, undefined, { sensitivity: 'base' });
          return sortDir === 'asc' ? cmp : -cmp;
        });
      }
    }
    return result;
  }, [sections, activeIdx, filterText, filterStatus, colFilters, sortCol, sortDir]);


  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || sections.length === 0 || !versionMeta) {
    return (
      <div className="py-16 text-center text-gray-500">
        <p>{error ?? 'Matriz no encontrada.'}</p>
        <button onClick={() => navigate(`/my-space/${ticketId}`)} className="mt-4 text-blue-600 text-sm hover:underline">
          Volver
        </button>
      </div>
    );
  }

  const activeSec = sections[activeIdx];

  return (
    <div className="space-y-4 max-w-full">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/my-space/${ticketId}`)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900 text-base">{ticketId}</span>
            <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
              v{versionMeta.version_num}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
              versionMeta.stage === 'PRE-DEV'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-green-50 text-green-700 border-green-200'
            }`}>
              {versionMeta.stage}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
              versionMeta.matrix_type === 'UI'
                ? 'bg-violet-50 text-violet-700 border-violet-200'
                : versionMeta.matrix_type === 'API'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-teal-50 text-teal-700 border-teal-200'
            }`}>
              {versionMeta.matrix_type}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
              Guardando…
            </span>
          )}
          {/* Descargar Plantilla */}
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
            title="Descargar plantilla CSV de la sección activa"
          >
            <Download className="w-4 h-4" /> Plantilla CSV
          </button>
          {/* Importar CSV */}
          <input type="file" accept=".csv" ref={csvInputRef} onChange={handleImportCsv} className="hidden" />
          <button
            onClick={() => csvInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-green-700 hover:text-green-900 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
            title="Importar casos desde un archivo CSV"
          >
            <Upload className="w-4 h-4" /> Importar CSV
          </button>
          {/* Añadir Columna */}
          <button
            onClick={() => setIsColModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
          >
            <Settings2 className="w-4 h-4" /> Columna
          </button>
        </div>
      </div>

      {/* ── Section Tabs (only if > 1 section) ──────────────────────────── */}
      {sections.length > 1 && (
        <div className="flex items-center gap-1 flex-wrap border-b border-gray-200 pb-2">
          {sections.map((sec, idx) => (
            <div key={sec.id} className="relative flex items-center">
              <button
                onClick={() => setActiveIdx(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-t-lg border transition-colors ${
                  idx === activeIdx
                    ? 'bg-white border-gray-200 border-b-white text-blue-600 shadow-sm'
                    : 'bg-gray-50 border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span>{sec.title || `Sección ${idx + 1}`}</span>
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                  {sec.rows.length}
                </span>
              </button>
              {sections.length > 1 && (
                <button
                  onClick={() => handleDeleteSection(idx)}
                  className="ml-0.5 p-0.5 text-gray-300 hover:text-red-400 transition-colors"
                  title="Eliminar sección"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={handleAddSection}
            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Sección
          </button>
        </div>
      )}

      {/* Filter Bar + Table */}
      {activeSec.rows.length > 0 && (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap gap-3 items-center px-1 mb-2">
              {/* Text search */}
              <div className="flex-1 min-w-[160px] relative">
                <svg className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar en la matriz..."
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                />
              </div>
              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
              >
                <option value="ALL">Todos los estados</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {/* Clear all + count */}
              {(filterText || filterStatus !== 'ALL' || hasAnyColFilter || sortCol) && (
                <button onClick={clearAllFilters}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
                  <X className="w-3 h-3" /> Limpiar
                </button>
              )}
              <span className="ml-auto text-xs text-gray-400">
                {displayRows.length} / {activeSec.rows.length} filas
              </span>
            </div>

            {/* Active col-filter chips */}
            {hasAnyColFilter && (
              <div className="flex flex-wrap gap-1.5 px-1 mb-2">
                {activeSec.columns.map(col => {
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

            {/* ── MatrixGrid ──────────────────────────────────────────────────── */}
            {(() => {
              // Adapt MatrixRow[] → cases[] format for MatrixGrid
              const statusCol = activeSec.columns.find(c => c.type === 'status');
              const gridCols: GridColumnDef[] = activeSec.columns
                .filter(c => c.type !== 'status')
                .map(c => ({ id: c.id, name: c.name, type: (c.type as GridColumnDef['type']) || 'text', options: c.options, width: 140 }));

              const adaptedCases = displayRows.map(row => ({
                id: row.id,
                title: '',
                custom_data: row.cells,
                executions: [{ status: statusCol ? (row.cells[statusCol.id] ?? 'PENDING') : 'PENDING' }],
              }));

              return (
                <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <MatrixGrid
                    cases={adaptedCases}
                    columns={gridCols}
                    merges={[]}
                    canManage
                    onStatusChange={(tc, status) => {
                      if (!statusCol) return;
                      handleStatusChange(tc.id, statusCol.id, status);
                    }}
                    onCellSave={(caseId, colId, value) => handleCellBlur(caseId, colId, value)}
                    onDeleteRow={handleDeleteRow}
                    onMergesChange={() => {}}
                    onBulkFill={(colId, value) => {
                      const col = activeSec.columns.find(c => c.id === colId);
                      if (!col) return;
                      if (!window.confirm(`¿Rellenar columna "${col.name}" con "${value}" en todas las filas visibles?`)) return;
                      setSections(prev => {
                        const next = prev.map((s, i) => i !== activeIdx ? s : {
                          ...s,
                          rows: s.rows.map(r => ({ ...r, cells: { ...r.cells, [colId]: value } })),
                        });
                        save(next);
                        return next;
                      });
                    }}
                    statusOptions={statusOptions}
                    onStatusOptionsChange={handleUpdateStatusOptions}
                  />

                  {/* Add Row */}
                  <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100">
                    <button
                      onClick={handleAddRow}
                      className="w-full flex items-center justify-center py-2 text-sm font-semibold text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-gray-300 hover:border-blue-300 rounded-lg transition-all"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Añadir Fila
                    </button>
                  </div>
                </div>
              );
            })()}

          </>
        )}

      {/* ── Add Column Modal ───────────────────────────────────────────── */}
      {isColModalOpen && (
        <AddColumnModal
          onAdd={handleAddColumn}
          onClose={() => setIsColModalOpen(false)}
        />
      )}
    </div>
  );
}
