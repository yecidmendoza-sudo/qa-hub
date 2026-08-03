import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseMarkdownTable(md: string): { headers: string[]; rows: string[][] } | null {
  const lines = md
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('|'));

  if (lines.length < 2) return null;

  const parseRow = (line: string) =>
    line
      .split('|')
      .slice(1, -1)
      .map(cell => cell.trim());

  const headers = parseRow(lines[0]);
  // lines[1] is the separator row (---|---|...)
  const rows = lines.slice(2).map(parseRow);

  return { headers, rows };
}

function MarkdownTableRenderer({ md }: { md: string }) {
  const parsed = parseMarkdownTable(md);
  if (!parsed) {
    // Fallback: render as plain preformatted text
    return <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">{md}</pre>;
  }

  const { headers, rows } = parsed;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-700">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-800">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left font-semibold text-blue-400 border-b border-gray-700 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={ri % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-4 py-3 text-gray-200 border-b border-gray-800 align-top"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type MatrixData = {
  ticket_id: string;
  project_name: string;
  stage: string;
  version_num: number;
  matrix_type: string;
  created_by: string;
  created_at: string;
  content_md: string;
  fixtures_json?: any;
  notes?: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function MatrixPublicView() {
  const { uuid } = useParams<{ uuid: string }>();
  const [matrix, setMatrix] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fixturesOpen, setFixturesOpen] = useState(false);

  useEffect(() => {
    if (!uuid) return;

    async function fetchMatrix() {
      setLoading(true);
      try {
        const res = await fetch(
          `https://leexvmoadhzwthzcbhph.supabase.co/functions/v1/matrix-public-view?uuid=${uuid}`
        );
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setMatrix(data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    fetchMatrix();
  }, [uuid]);

  // ── Loading State ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Cargando matriz…</p>
        </div>
      </div>
    );
  }

  // ── Not Found State ────────────────────────────────────────────────────────
  if (notFound || !matrix) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-5xl">🔍</div>
          <h1 className="text-xl font-bold text-gray-200">Matriz no encontrada</h1>
          <p className="text-gray-500 text-sm">Esta matriz no existe o fue eliminada.</p>
        </div>
      </div>
    );
  }

  // ── Format date ───────────────────────────────────────────────────────────
  const formattedDate = matrix.created_at
    ? new Date(matrix.created_at).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : '—';

  const typeBadge =
    matrix.matrix_type === 'UI'
      ? 'bg-violet-900 text-violet-300'
      : matrix.matrix_type === 'API'
      ? 'bg-blue-900 text-blue-300'
      : 'bg-teal-900 text-teal-300';

  const stageBadge =
    matrix.stage === 'PRE-DEV'
      ? 'bg-amber-900 text-amber-300'
      : 'bg-green-900 text-green-300';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* ── Header Bar ───────────────────────────────────────────────────── */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <span className="text-2xl">🧪</span>
        <div>
          <span className="text-lg font-bold text-blue-400">Gideon QA</span>
          <span className="ml-2 text-gray-500">— Matriz de Pruebas</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* ── Meta Card ───────────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{matrix.ticket_id}</h1>
            <span className="text-gray-500 font-medium text-lg">|</span>
            <span className="text-lg font-semibold text-gray-300">{matrix.project_name}</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${stageBadge}`}>
              {matrix.stage}
            </span>
            <span className="text-xs font-bold bg-gray-700 text-gray-300 px-2.5 py-1 rounded-full">
              v{matrix.version_num}
            </span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${typeBadge}`}>
              {matrix.matrix_type}
            </span>
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-gray-400">
            <div>
              <span className="font-semibold text-gray-500">Generado por:</span>{' '}
              <span className="text-gray-300">{matrix.created_by}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-500">Fecha:</span>{' '}
              <span className="text-gray-300">{formattedDate}</span>
            </div>
            {matrix.notes && (
              <div>
                <span className="font-semibold text-gray-500">Notas:</span>{' '}
                <span className="text-gray-300 italic">{matrix.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Matrix Content ───────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
            Casos de Prueba
          </h2>
          <MarkdownTableRenderer md={matrix.content_md} />
        </div>

        {/* ── Fixtures (collapsible) ───────────────────────────────────────── */}
        {matrix.fixtures_json && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <button
              onClick={() => setFixturesOpen(o => !o)}
              className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-gray-300 hover:bg-gray-800 transition-colors"
            >
              <span>📦 Fixtures JSON</span>
              <span className="text-gray-500 text-xs">{fixturesOpen ? '▲ Colapsar' : '▼ Expandir'}</span>
            </button>
            {fixturesOpen && (
              <div className="border-t border-gray-800 p-6">
                <pre className="text-xs text-green-300 bg-gray-950 rounded-xl p-4 overflow-x-auto font-mono">
                  {JSON.stringify(matrix.fixtures_json, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-600">── Solo lectura · Sin login requerido ──</p>
        </div>
      </main>
    </div>
  );
}
