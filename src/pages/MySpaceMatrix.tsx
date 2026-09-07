import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Settings2, Download, Upload, X } from 'lucide-react';
import Papa from 'papaparse';
import {
  parseMarkdownToMatrixData,
  updatePersonalMatrixData,
  getPersonalMatrixVersion,
  normalizeSections,
  type MatrixSection,
  type MatrixCol,
  type MatrixRow,
} from '../lib/services/personalMatrixService';
import AddColumnModal from '../components/matrix/AddColumnModal';

const STATUS_OPTIONS = ['PENDING', 'PASS', 'FAIL', 'BLOCKED'] as const;

const STATUS_BADGE: Record<string, string> = {
  PASS:    'bg-green-100 text-green-700 border-green-200',
  FAIL:    'bg-red-100 text-red-700 border-red-200',
  BLOCKED: 'bg-orange-100 text-orange-700 border-orange-200',
  PENDING: 'bg-gray-100 text-gray-600 border-gray-200',
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
          // Use stored JSONB — normalize to sections (handles legacy {columns,rows} format too)
          secs = normalizeSections(version.matrix_data as { sections?: MatrixSection[]; columns?: MatrixCol[]; rows?: MatrixRow[] });
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
  const handleCellChange = (rowId: string, colId: string, value: string) => {
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
    setSections(prev => {
      const next = prev.map((s, i) => i !== activeIdx ? s : { ...s, rows: s.rows.filter(r => r.id !== rowId) });
      save(next);
      return next;
    });
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

  const handleDeleteColumn = (colId: string) => {
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

        setSections(prev => {
          const next = prev.map((s, i) => i !== activeIdx ? s : { ...s, rows: [...s.rows, ...newRows] });
          save(next);
          return next;
        });
      },
      error: () => alert('Error al leer el archivo CSV.'),
    });

    if (csvInputRef.current) csvInputRef.current.value = '';
  };


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

      {/* ── Table (active section) ───────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {activeSec.columns.map(col => (
                <th key={col.id} className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span>{col.name}</span>
                    {!col.locked && (
                      <button
                        onClick={() => handleDeleteColumn(col.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        title={`Eliminar columna ${col.name}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {activeSec.rows.length === 0 ? (
              <tr>
                <td colSpan={activeSec.columns.length + 1} className="px-4 py-10 text-center text-sm text-gray-400 italic">
                  Sin filas. Usa el botón de abajo para agregar.
                </td>
              </tr>
            ) : (
              activeSec.rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  {activeSec.columns.map(col => (
                    <td key={col.id} className="px-4 py-2">
                      {col.type === 'status' ? (
                        <select
                          value={row.cells[col.id] ?? 'PENDING'}
                          onChange={e => handleStatusChange(row.id, col.id, e.target.value)}
                          className={`text-xs font-semibold border rounded-full px-2 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                            STATUS_BADGE[row.cells[col.id] ?? 'PENDING'] ?? STATUS_BADGE.PENDING
                          }`}
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ) : col.type === 'dropdown' ? (
                        <select
                          value={row.cells[col.id] ?? ''}
                          onChange={e => {
                            handleCellChange(row.id, col.id, e.target.value);
                            handleStatusChange(row.id, col.id, e.target.value);
                          }}
                          className="w-full text-sm bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none px-1 py-1"
                        >
                          <option value="">— Seleccionar —</option>
                          {col.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          defaultValue={row.cells[col.id] ?? ''}
                          onBlur={e => handleCellBlur(row.id, col.id, e.target.value)}
                          className="w-full min-w-[80px] bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none text-gray-700"
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-2">
                    <button
                      onClick={() => handleDeleteRow(row.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors p-1"
                      title="Eliminar fila"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
            {/* Add Row */}
            <tr>
              <td colSpan={activeSec.columns.length + 1} className="px-4 py-3 bg-gray-50/50">
                <button
                  onClick={handleAddRow}
                  className="w-full flex items-center justify-center py-2 text-sm font-semibold text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-gray-300 hover:border-blue-300 rounded-lg transition-all"
                >
                  <Plus className="w-4 h-4 mr-2" /> Añadir Fila
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

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
