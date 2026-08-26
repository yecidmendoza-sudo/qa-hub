import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Settings2, Download, Upload } from 'lucide-react';
import Papa from 'papaparse';
import {
  parseMarkdownToMatrixData,
  updatePersonalMatrixData,
  getPersonalMatrixVersion,
  type MatrixData,
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
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
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

        let data: MatrixData;
        if (version.matrix_data) {
          data = version.matrix_data as unknown as MatrixData;
        } else if (version.content_md) {
          // Migrate from Markdown on first edit
          data = parseMarkdownToMatrixData(version.content_md);
          // Save immediately so subsequent loads use matrix_data
          await updatePersonalMatrixData(versionId!, data, ticketId!);
        } else {
          // Blank matrix
          data = {
            columns: [
              { id: 'col_id',     name: 'ID',                 type: 'text'   },
              { id: 'col_mod',    name: 'Módulo',             type: 'text'   },
              { id: 'col_action', name: 'Acción',             type: 'text'   },
              { id: 'col_result', name: 'Resultado Esperado', type: 'text'   },
              { id: 'col_status', name: 'Estado',             type: 'status' },
            ],
            rows: [],
          };
        }
        setMatrixData(data);
      } catch (e) {
        setError('No se pudo cargar la matriz.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [versionId, ticketId]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = useCallback(async (data: MatrixData) => {
    if (!versionId || !ticketId) return;
    setSaving(true);
    try {
      await updatePersonalMatrixData(versionId, data, ticketId);
    } catch (e) {
      console.error('Error saving matrix:', e);
    } finally {
      setSaving(false);
    }
  }, [versionId, ticketId]);

  // ── Cell update ───────────────────────────────────────────────────────────
  const handleCellChange = (rowId: string, colId: string, value: string) => {
    setMatrixData(prev => {
      if (!prev) return prev;
      const updated: MatrixData = {
        ...prev,
        rows: prev.rows.map(r =>
          r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r
        ),
      };
      return updated;
    });
  };

  const handleCellBlur = (data: MatrixData) => {
    save(data);
  };

  // ── Row actions ───────────────────────────────────────────────────────────
  const handleAddRow = () => {
    setMatrixData(prev => {
      if (!prev) return prev;
      const newRow: MatrixRow = {
        id: genId(),
        cells: Object.fromEntries(
          prev.columns.map(col => [
            col.id,
            col.type === 'status' ? 'PENDING' : '',
          ])
        ),
      };
      const updated = { ...prev, rows: [...prev.rows, newRow] };
      save(updated);
      return updated;
    });
  };

  const handleDeleteRow = (rowId: string) => {
    setMatrixData(prev => {
      if (!prev) return prev;
      const updated = { ...prev, rows: prev.rows.filter(r => r.id !== rowId) };
      save(updated);
      return updated;
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
    setMatrixData(prev => {
      if (!prev) return prev;
      const updated: MatrixData = {
        columns: [...prev.columns, newCol],
        rows: prev.rows.map(r => ({
          ...r,
          cells: { ...r.cells, [newCol.id]: '' },
        })),
      };
      save(updated);
      return updated;
    });
  };

  const handleDeleteColumn = (colId: string) => {
    setMatrixData(prev => {
      if (!prev) return prev;
      const updated: MatrixData = {
        columns: prev.columns.filter(c => c.id !== colId),
        rows: prev.rows.map(r => {
          const cells = { ...r.cells };
          delete cells[colId];
          return { ...r, cells };
        }),
      };
      save(updated);
      return updated;
    });
  };

  // ── CSV ref ───────────────────────────────────────────────────────────────
  const csvInputRef = useRef<HTMLInputElement>(null);

  // ── Download template ─────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    if (!matrixData) return;
    const headers = matrixData.columns.map(c => c.name).join(',');
    const csv = headers + '\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla_${ticketId}_v${versionMeta?.version_num ?? 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Import CSV ────────────────────────────────────────────────────────────
  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !matrixData) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        if (!rows || rows.length === 0) return;

        const newRows: MatrixRow[] = rows.map(row => {
          const cells: Record<string, string> = {};
          matrixData.columns.forEach(col => {
            const key = Object.keys(row).find(
              k => k.toLowerCase().trim() === col.name.toLowerCase().trim()
            );
            cells[col.id] = key ? (row[key] ?? '') : (col.type === 'status' ? 'PENDING' : '');
          });
          return { id: genId(), cells };
        });

        const updated: MatrixData = {
          ...matrixData,
          rows: [...matrixData.rows, ...newRows],
        };
        setMatrixData(updated);
        save(updated);
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

  if (error || !matrixData || !versionMeta) {
    return (
      <div className="py-16 text-center text-gray-500">
        <p>{error ?? 'Matriz no encontrada.'}</p>
        <button onClick={() => navigate(`/my-space/${ticketId}`)} className="mt-4 text-blue-600 text-sm hover:underline">
          Volver
        </button>
      </div>
    );
  }

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
            title="Descargar plantilla CSV con las columnas actuales"
          >
            <Download className="w-4 h-4" /> Descargar Plantilla
          </button>
          {/* Importar CSV */}
          <input
            type="file"
            accept=".csv"
            ref={csvInputRef}
            onChange={handleImportCsv}
            className="hidden"
          />
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
            <Settings2 className="w-4 h-4" /> Añadir Columna
          </button>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {matrixData.columns.map(col => (
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
            {matrixData.rows.length === 0 ? (
              <tr>
                <td colSpan={matrixData.columns.length + 1} className="px-4 py-10 text-center text-sm text-gray-400 italic">
                  Sin casos de prueba. Usa el botón de abajo para agregar.
                </td>
              </tr>
            ) : (
              matrixData.rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  {matrixData.columns.map(col => (
                    <td key={col.id} className="px-4 py-2">
                      {col.type === 'status' ? (
                        <select
                          value={row.cells[col.id] ?? 'PENDING'}
                          onChange={e => {
                            handleCellChange(row.id, col.id, e.target.value);
                            // Save immediately on status change
                            const updated: MatrixData = {
                              ...matrixData,
                              rows: matrixData.rows.map(r =>
                                r.id === row.id
                                  ? { ...r, cells: { ...r.cells, [col.id]: e.target.value } }
                                  : r
                              ),
                            };
                            save(updated);
                          }}
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
                            const updated: MatrixData = {
                              ...matrixData,
                              rows: matrixData.rows.map(r =>
                                r.id === row.id
                                  ? { ...r, cells: { ...r.cells, [col.id]: e.target.value } }
                                  : r
                              ),
                            };
                            save(updated);
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
                          onBlur={e => {
                            const newVal = e.target.value;
                            const updated: MatrixData = {
                              ...matrixData,
                              rows: matrixData.rows.map(r =>
                                r.id === row.id
                                  ? { ...r, cells: { ...r.cells, [col.id]: newVal } }
                                  : r
                              ),
                            };
                            setMatrixData(updated);
                            handleCellBlur(updated);
                          }}
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
              <td colSpan={matrixData.columns.length + 1} className="px-4 py-3 bg-gray-50/50">
                <button
                  onClick={handleAddRow}
                  className="w-full flex items-center justify-center py-2 text-sm font-semibold text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-gray-300 hover:border-blue-300 rounded-lg transition-all"
                >
                  <Plus className="w-4 h-4 mr-2" /> Añadir Caso
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
