import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  PASS:    'bg-green-500/20 text-green-300 border border-green-500/40',
  FAIL:    'bg-red-500/20   text-red-300   border border-red-500/40',
  BLOCKED: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
  PENDING: 'bg-gray-500/20  text-gray-400  border border-gray-500/40',
  SKIP:    'bg-blue-500/20  text-blue-300  border border-blue-500/40',
};

const STATUS_ICON: Record<string, string> = {
  PASS: '✅', FAIL: '❌', BLOCKED: '⚠️', PENDING: '⏳', SKIP: '⏭️',
};

const CYCLE_TYPE_COLOR: Record<string, string> = {
  SMOKE:      'bg-orange-500/20 text-orange-300 border border-orange-500/40',
  SANITY:     'bg-blue-500/20   text-blue-300   border border-blue-500/40',
  REGRESSION: 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
};

// ── Component ────────────────────────────────────────────────────────────────
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
        if (!res.ok) { setNotFound(true); return; }
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
          <p className="text-gray-400 text-sm">Cargando ciclo...</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-4xl">🔍</p>
          <p className="text-gray-300 font-semibold text-lg">Ciclo no encontrado</p>
          <p className="text-gray-500 text-sm">El link puede ser inválido o el ciclo fue eliminado.</p>
        </div>
      </div>
    );
  }

  const { cycle, cases, summary } = data;

  // Columns to render: same data-driven logic as Matrix.tsx
  const allCols: any[] = (cycle.custom_columns || []).filter(
    (c: any) => c.id !== 'sort_order'
  );
  const isDataDriven = allCols.length > 0;
  const hasTitleCol = allCols.some((c: any) => c.id === '_title');
  const effectiveCols: any[] = isDataDriven && !hasTitleCol
    ? [{ id: '_title', name: 'Task Name', type: 'text' }, ...allCols]
    : allCols;

  const progressPct = summary.percentage;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">

      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧪</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${CYCLE_TYPE_COLOR[cycle.type] ?? 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                {cycle.type}
              </span>
              <h1 className="text-white font-bold text-lg">{cycle.version}</h1>
            </div>
            <p className="text-gray-400 text-xs mt-0.5">Vista pública — solo lectura</p>
          </div>
        </div>
        <a
          href="https://qa-hub-qvnt-jade.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-400 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" /> QA Hub
        </a>
      </header>

      {/* Summary bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          {/* Progress bar */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-gray-300 text-sm font-semibold min-w-[40px] text-right">{progressPct}%</span>
          </div>
          {/* Counts */}
          <div className="flex flex-wrap gap-3">
            {Object.entries(STATUS_BADGE).map(([s, cls]) => (
              summary[s] > 0 && (
                <span key={s} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
                  {STATUS_ICON[s]} {s}: {summary[s]}
                </span>
              )
            ))}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-700 text-gray-300">
              Total: {summary.total}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="overflow-x-auto rounded-xl border border-gray-800 shadow-xl">
          <table className="min-w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900 border-b border-gray-700">
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider w-[100px]">ID</th>
                {isDataDriven
                  ? effectiveCols.map((col) => (
                      <th key={col.id} className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                        {col.name}
                      </th>
                    ))
                  : (
                    <>
                      <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Task Name</th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Módulo</th>
                    </>
                  )
                }
                {/* Sticky Status column */}
                <th className="px-4 py-3 text-xs font-bold text-blue-400 uppercase tracking-wider sticky right-0 bg-gray-900 border-l border-gray-700 min-w-[130px]">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {cases.map((c: any, idx: number) => {
                const status = c.execution?.status || 'PENDING';
                const customData = c.custom_data ?? {};

                return (
                  <tr key={c.id} className={`${idx % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900/40'} hover:bg-gray-800/60 transition-colors`}>
                    {/* ticket_id */}
                    <td className="px-4 py-2.5 text-xs text-gray-500 font-mono whitespace-nowrap">{c.ticket_id}</td>

                    {/* Data-driven columns */}
                    {isDataDriven
                      ? effectiveCols.map((col) => {
                          let cellValue = '';
                          if (col.id === '_title') cellValue = c.title ?? '';
                          else if (col.id === '_module') cellValue = c.module ?? '';
                          else if (col.id === '_expected_result') cellValue = c.expected_result ?? '';
                          else if (col.id === '_observation') cellValue = c.execution?.observation ?? '';
                          else cellValue = customData[col.id] ?? '';

                          return (
                            <td key={col.id} className="px-4 py-2.5 text-xs text-gray-300 max-w-[280px] align-top">
                              <span className="line-clamp-3">{cellValue || <span className="text-gray-600">—</span>}</span>
                            </td>
                          );
                        })
                      : (
                        <>
                          <td className="px-4 py-2.5 text-xs text-gray-300 max-w-[280px]">{c.title}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">{c.module}</td>
                        </>
                      )
                    }

                    {/* Status — sticky right */}
                    <td className="px-4 py-2.5 sticky right-0 border-l border-gray-700 bg-gray-950">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[status] ?? STATUS_BADGE.PENDING}`}>
                        {STATUS_ICON[status]} {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-center text-gray-600 text-xs mt-6">
          Vista pública generada por <span className="text-gray-400">Gideon QA</span> · <a href="https://qa-hub-qvnt-jade.vercel.app" className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">qa-hub-qvnt-jade.vercel.app</a>
        </p>
      </div>
    </div>
  );
}
