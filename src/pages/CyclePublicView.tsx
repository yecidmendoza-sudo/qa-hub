import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_BADGE_CLS: Record<string, string> = {
  PASS:        'bg-green-900  text-green-300',
  FAIL:        'bg-red-900    text-red-300',
  BLOCKED:     'bg-orange-900 text-orange-300',
  PENDING:     'bg-gray-700   text-gray-300',
  SKIP:        'bg-blue-900   text-blue-300',
  IMPROVEMENT: 'bg-purple-900 text-purple-300',
};

const CYCLE_TYPE_CLS: Record<string, string> = {
  SMOKE:      'bg-orange-900 text-orange-300',
  SANITY:     'bg-blue-900   text-blue-300',
  REGRESSION: 'bg-purple-900 text-purple-300',
};

const CYCLE_STATUS_CLS: Record<string, string> = {
  PASSED:      'bg-green-900  text-green-300',
  FAILED:      'bg-red-900    text-red-300',
  IN_PROGRESS: 'bg-blue-900   text-blue-300',
  DRAFT:       'bg-gray-700   text-gray-300',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function CyclePublicView() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function fetchCycle() {
      setLoading(true);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cycle-public-view?cycle_id=${id}`
        );
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok)             { setNotFound(true); return; }
        const json = await res.json();
        setData(json.data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchCycle();
  }, [id]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Cargando ciclo…</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-5xl">🔍</div>
          <h1 className="text-xl font-bold text-gray-200">Ciclo no encontrado</h1>
          <p className="text-gray-500 text-sm">Este ciclo no existe o fue eliminado.</p>
        </div>
      </div>
    );
  }

  const { cycle, cases, summary } = data;

  const formattedDate = cycle.created_at
    ? new Date(cycle.created_at).toLocaleDateString('es-CO', {
        year: 'numeric', month: '2-digit', day: '2-digit',
      })
    : '—';

  // Columns — same data-driven logic as Matrix.tsx
  const allCols: any[] = (cycle.custom_columns || []).filter(
    (c: any) => c.id !== 'sort_order'
  );
  const isDataDriven = allCols.length > 0;
  const hasTitleCol = allCols.some((c: any) => c.id === '_title');
  const effectiveCols: any[] = isDataDriven && !hasTitleCol
    ? [{ id: '_title', name: 'Task Name', type: 'text' }, ...allCols]
    : allCols;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">

      {/* ── Header Bar ─────────────────────────────────────────────────────── */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <span className="text-2xl">🧪</span>
        <div>
          <span className="text-lg font-bold text-blue-400">Gideon QA</span>
          <span className="ml-2 text-gray-500">— Ciclo de Pruebas</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* ── Meta Card ──────────────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{cycle.type}</h1>
            <span className="text-gray-500 font-medium text-lg">|</span>
            <span className="text-lg font-semibold text-gray-300">{cycle.version}</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${CYCLE_TYPE_CLS[cycle.type] ?? 'bg-gray-700 text-gray-300'}`}>
              {cycle.type}
            </span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${CYCLE_STATUS_CLS[cycle.status] ?? 'bg-gray-700 text-gray-300'}`}>
              {cycle.status}
            </span>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-700"
                  style={{ width: `${summary.percentage}%` }}
                />
              </div>
              <span className="text-gray-300 text-sm font-semibold min-w-[42px] text-right">{summary.percentage}%</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_BADGE_CLS).map(([s, cls]) =>
                (summary[s] ?? 0) > 0 ? (
                  <span key={s} className={`text-xs font-bold px-2.5 py-1 rounded-full ${cls}`}>
                    {s}: {summary[s]}
                  </span>
                ) : null
              )}
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-700 text-gray-300">
                Total: {summary.total}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-gray-400">
            <div>
              <span className="font-semibold text-gray-500">Fecha:</span>{' '}
              <span className="text-gray-300">{formattedDate}</span>
            </div>
          </div>
        </div>

        {/* ── Table Card ─────────────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
            Casos de Prueba
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-blue-400 border-b border-gray-700 whitespace-nowrap">ID</th>
                  {isDataDriven
                    ? effectiveCols.map((col) => (
                        <th key={col.id} className="px-4 py-3 text-left font-semibold text-blue-400 border-b border-gray-700 whitespace-nowrap">
                          {col.name}
                        </th>
                      ))
                    : (
                      <>
                        <th className="px-4 py-3 text-left font-semibold text-blue-400 border-b border-gray-700">Task Name</th>
                        <th className="px-4 py-3 text-left font-semibold text-blue-400 border-b border-gray-700">Módulo</th>
                      </>
                    )
                  }
                  <th className="px-4 py-3 text-left font-semibold text-blue-400 border-b border-gray-700 whitespace-nowrap">Estado</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c: any, ri: number) => {
                  const status = c.execution?.status || 'PENDING';
                  const customData = c.custom_data ?? {};
                  return (
                    <tr key={c.id} className={ri % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'}>
                      <td className="px-4 py-3 text-gray-400 border-b border-gray-800 font-mono text-xs whitespace-nowrap">{c.ticket_id}</td>
                      {isDataDriven
                        ? effectiveCols.map((col) => {
                            let val = '';
                            if (col.id === '_title')           val = c.title ?? '';
                            else if (col.id === '_module')     val = c.module ?? '';
                            else if (col.id === '_expected_result') val = c.expected_result ?? '';
                            else if (col.id === '_observation') val = c.execution?.observation ?? '';
                            else val = customData[col.id] ?? '';
                            return (
                              <td key={col.id} className="px-4 py-3 text-gray-200 border-b border-gray-800 align-top max-w-[280px]">
                                {val || <span className="text-gray-600">—</span>}
                              </td>
                            );
                          })
                        : (
                          <>
                            <td className="px-4 py-3 text-gray-200 border-b border-gray-800 align-top">{c.title}</td>
                            <td className="px-4 py-3 text-gray-400 border-b border-gray-800">{c.module}</td>
                          </>
                        )
                      }
                      {/* Status badge */}
                      <td className="px-4 py-3 border-b border-gray-800">
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${STATUS_BADGE_CLS[status] ?? STATUS_BADGE_CLS.PENDING}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-600">── Solo lectura · Sin login requerido ──</p>
        </div>
      </main>
    </div>
  );
}
