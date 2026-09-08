import { useState, useRef, useEffect } from 'react';
import { Send, Key, ChevronDown, CheckCircle2, XCircle, Loader2, Copy, Check } from 'lucide-react';

const API_URL = 'https://leexvmoadhzwthzcbhph.supabase.co/functions/v1';

interface Endpoint {
  id: string;
  name: string;
  method: 'POST';
  description: string;
  defaultPayload: object;
}

const ENDPOINTS: Endpoint[] = [
  {
    id: 'agent-list-matrices',
    name: 'agent-list-matrices',
    method: 'POST',
    description: 'Lista todos los ciclos y matrices Mi Espacio del QA.',
    defaultPayload: { qa_email: 'tu@shipedge.com' },
  },
  {
    id: 'agent-create-cycle',
    name: 'agent-create-cycle',
    method: 'POST',
    description: 'Crea un ciclo de release con sus casos de prueba y columnas custom.',
    defaultPayload: {
      project_name: 'Xenvio',
      version: 'xe26.03.0-rc',
      cycle_type: 'SMOKE',
      created_by: 'tu@shipedge.com',
      extra_columns: [
        { id: 'via', name: 'Vía', type: 'text' },
        { id: 'qa_reviewer', name: 'QA Reviewer', type: 'dropdown', options: ['IA', 'Lisette'] },
      ],
      test_cases: [
        {
          ticket_id: 'TC-01',
          title: 'Login con credenciales válidas',
          module: 'Auth',
          expected_result: 'Redirige al dashboard',
          qa_reviewer: 'IA',
          custom_data: { via: 'Shipedge WMS', qa_reviewer: 'IA' },
        },
      ],
    },
  },
  {
    id: 'agent-report-results',
    name: 'agent-report-results',
    method: 'POST',
    description: 'Actualiza statuses en un ciclo de release existente.',
    defaultPayload: {
      cycle_id: 'PEGAR-CYCLE-ID-AQUI',
      reported_by: 'tu@shipedge.com',
      results: [
        { ticket_id: 'TC-01', status: 'PASS', observation: 'HTTP 201 — staging' },
        { ticket_id: 'TC-02', status: 'FAIL', observation: 'Error 422 en zip_code' },
      ],
    },
  },
  {
    id: 'agent-save-matrix',
    name: 'agent-save-matrix',
    method: 'POST',
    description: 'Publica una matriz personal de ticket en Mi Espacio.',
    defaultPayload: {
      qa_email: 'tu@shipedge.com',
      ticket_id: 'NXEN-234',
      project_name: 'Xenvio',
      stage: 'POST-DEV',
      matrix_type: 'UI',
      content_md: '## Matriz de Pruebas\n| # | Test | Status |\n|---|---|---|\n| 1 | Login | PASS |',
    },
  },
  {
    id: 'agent-update-matrix-status',
    name: 'agent-update-matrix-status',
    method: 'POST',
    description: 'Actualiza statuses en una matriz personal (Mi Espacio) sin crear nueva versión.',
    defaultPayload: {
      qa_email: 'tu@shipedge.com',
      ticket_id: 'NXEN-234',
      updates: [
        { row_id: 'row_0', status: 'PASS' },
        { row_id: 'row_1', status: 'FAIL', observation: 'Error 422' },
      ],
      version_num: null,
    },
  },
  {
    id: 'agent-check-identity',
    name: 'agent-check-identity',
    method: 'POST',
    description: 'Verifica email y rol de un QA en el sistema.',
    defaultPayload: { email: 'tu@shipedge.com' },
  },
];

function JsonDisplay({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // Simple syntax coloring via CSS classes applied in JS
  const highlighted = text
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, (match) => {
      if (match.endsWith(':')) return `<span class="text-blue-700 font-medium">${match}</span>`;
      return `<span class="text-emerald-700">${match}</span>`;
    })
    .replace(/\b(true|false)\b/g, '<span class="text-purple-600">$1</span>')
    .replace(/\b(null)\b/g, '<span class="text-red-400">$1</span>')
    .replace(/\b(-?\d+(\.\d+)?)\b/g, '<span class="text-amber-600">$1</span>');

  return (
    <div className="relative">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors"
        title="Copiar"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre
        className="text-xs font-mono bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto max-h-72 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  );
}

export default function ApiPlayground() {
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('qa-hub-api-key') || ''; } catch { return ''; }
  });
  const [showKey, setShowKey] = useState(false);
  const [selectedId, setSelectedId] = useState(ENDPOINTS[0].id);
  const [payloads, setPayloads] = useState<Record<string, string>>(() =>
    Object.fromEntries(ENDPOINTS.map(e => [e.id, JSON.stringify(e.defaultPayload, null, 2)]))
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: number; ms: number; data: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const endpoint = ENDPOINTS.find(e => e.id === selectedId)!;

  const saveKey = () => {
    try { localStorage.setItem('qa-hub-api-key', apiKey); } catch {}
  };

  const handleSend = async () => {
    if (!apiKey.trim()) { setError('Ingresa la api_key primero.'); return; }
    let parsed: unknown;
    try { parsed = JSON.parse(payloads[selectedId]); }
    catch { setError('JSON inválido en el payload.'); return; }

    setLoading(true); setResult(null); setError(null);
    const t0 = Date.now();
    try {
      const res = await fetch(`${API_URL}/${selectedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      setResult({ status: res.status, ms: Date.now() - t0, data });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error de red');
    } finally {
      setLoading(false);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 320)}px`;
    }
  }, [payloads, selectedId]);

  const isOk = result && result.status >= 200 && result.status < 300;

  return (
    <div id="api-playground" className="space-y-5">
      {/* API Key */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            <Key className="inline h-3.5 w-3.5 mr-1" />api_key
          </label>
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="gideon-shipedge-2026-secret"
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
            />
            <button
              onClick={() => setShowKey(s => !s)}
              className="px-3 py-2 text-xs text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {showKey ? 'Ocultar' : 'Ver'}
            </button>
            <button
              onClick={saveKey}
              className="px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              💾 Guardar
            </button>
          </div>
        </div>
      </div>

      {/* Endpoint selector */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Endpoint
        </label>
        <div className="relative">
          <select
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value); setResult(null); setError(null); }}
            className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            {ENDPOINTS.map(ep => (
              <option key={ep.id} value={ep.id}>{ep.method} /{ep.id}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
        <p className="mt-1.5 text-xs text-gray-500">{endpoint.description}</p>
      </div>

      {/* Payload editor */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Payload JSON
        </label>
        <textarea
          ref={textareaRef}
          value={payloads[selectedId]}
          onChange={e => setPayloads(p => ({ ...p, [selectedId]: e.target.value }))}
          className="w-full text-xs font-mono border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-gray-50 leading-relaxed"
          spellCheck={false}
        />
      </div>

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
          : <><Send className="h-4 w-4" /> Enviar Petición</>
        }
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-2">
          <div className={`flex items-center gap-2 text-sm font-semibold ${isOk ? 'text-emerald-700' : 'text-red-600'}`}>
            {isOk
              ? <CheckCircle2 className="h-4 w-4" />
              : <XCircle className="h-4 w-4" />
            }
            {result.status} {isOk ? 'OK' : 'Error'} — {result.ms}ms
          </div>
          <JsonDisplay data={result.data} />
        </div>
      )}
    </div>
  );
}
