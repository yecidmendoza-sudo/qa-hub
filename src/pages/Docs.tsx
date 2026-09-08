import DocsNav from '../components/docs/DocsNav';
import ApiPlayground from '../components/docs/ApiPlayground';
import { ExternalLink, Terminal, BookOpen, Cpu } from 'lucide-react';

// ── Re-usable section heading ──────────────────────────────────────────────
function Section({ id, title, emoji, children }: {
  id: string; title: string; emoji: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
        <span className="text-2xl">{emoji}</span>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-gray-900 text-gray-100 text-xs font-mono p-4 rounded-lg overflow-x-auto leading-relaxed">
      {children}
    </pre>
  );
}

function Badge({ children, color = 'blue' }: { children: string; color?: 'blue' | 'green' | 'yellow' | 'purple' }) {
  const colors = {
    blue:   'bg-blue-100 text-blue-800',
    green:  'bg-emerald-100 text-emerald-800',
    yellow: 'bg-amber-100 text-amber-800',
    purple: 'bg-purple-100 text-purple-800',
  };
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${colors[color]}`}>
      {children}
    </span>
  );
}

// ── Skills table data ──────────────────────────────────────────────────────
const SKILLS = [
  { num: 1, name: 'task-fetcher',       badge: 'ClickUp + QA Hub', color: 'blue'   as const, desc: 'Punto de inicio del día. Opción [A] tus tickets en ClickUp, opción [B] tus matrices en QA Hub con statuses.' },
  { num: 2, name: 'ticket-analyst',     badge: 'Análisis',         color: 'purple' as const, desc: 'Analiza un ticket en profundidad y genera la Matriz de Pruebas. Publica en QA Hub (PENDING) y opcionalmente crea sub-tarea.' },
  { num: 3, name: 'exploratory-tester', badge: 'Manual',           color: 'green'  as const, desc: 'Registra resultados de pruebas manuales. Sincroniza QA Hub (Mi Espacio) y publica veredicto en ClickUp.' },
  { num: 4, name: 'suite-automator',    badge: 'Automatización',   color: 'yellow' as const, desc: 'Genera código Playwright / Tessl permanente para los casos de la Matriz.' },
  { num: 6, name: 'release-publisher',  badge: 'Release',          color: 'blue'   as const, desc: '[2] Crea ciclo nuevo desde CSV/xlsx con detección interactiva de columnas. [3] Reporta resultados en ciclo existente.' },
  { num: 8, name: 'setup-clickup',      badge: 'Config',           color: 'yellow' as const, desc: 'Configura aplicaciones, usuarios de prueba y ambientes en credentials.json.' },
  { num: 9, name: 'mobile-automator',   badge: 'Android',          color: 'green'  as const, desc: 'Genera flows Maestro YAML para apps Android desde los casos tipo 📱 MOBILE de la Matriz.' },
  { num: 10, name: 'MAS Conductor',     badge: 'Auto-completo',    color: 'purple' as const, desc: 'Flujo QA completo y automático: análisis → Playwright → reporte → ClickUp. Con agentes en paralelo.' },
];

// ── Endpoints reference ────────────────────────────────────────────────────
const ENDPOINTS = [
  {
    num: 1, name: 'agent-save-matrix',
    desc: 'Publica una matriz personal de ticket en Mi Espacio (PENDING).',
    fields: 'qa_email, ticket_id, project_name, stage (PRE-DEV|POST-DEV), matrix_type (UI|API|MIXED), content_md',
  },
  {
    num: 2, name: 'agent-create-cycle',
    desc: 'Crea un ciclo de release con casos, extra_columns y sort_order automático.',
    fields: 'project_name, version, cycle_type (SMOKE|SANITY|REGRESSION), created_by, test_cases[], extra_columns[]',
  },
  {
    num: 3, name: 'agent-report-results',
    desc: 'Actualiza statuses en un ciclo existente. Puede llamarse justo después de crear el ciclo o más tarde.',
    fields: 'cycle_id, reported_by, results[]: { ticket_id, status (PASS|FAIL|BLOCKED|PENDING), observation? }',
  },
  {
    num: 4, name: 'agent-update-matrix-status',
    desc: 'Actualiza statuses en una matriz personal (Mi Espacio) sin crear nueva versión.',
    fields: 'qa_email, ticket_id, updates[]: { row_id, status, observation? }, version_num (null = última)',
  },
  {
    num: 5, name: 'agent-list-matrices',
    desc: 'Lista todos los ciclos y matrices Mi Espacio accesibles para un QA.',
    fields: 'qa_email',
  },
  {
    num: 6, name: 'agent-check-identity',
    desc: 'Verifica que el email existe y retorna su rol (ADMIN | QA_LEAD | QA_TESTER).',
    fields: 'email',
  },
];

// ── MAS agent data ────────────────────────────────────────────────────────
const MAS_AGENTS = [
  { cluster: 'Analyst', color: 'bg-blue-50 border-blue-200', agents: [
    { name: 'ticket-bot',        desc: 'Lee ticket de ClickUp: título, criterios, MR URL, branch, tags, versión.' },
    { name: 'diff-bot',          desc: 'Lee el patch real del PR (GitHub/GitLab API) o git diff. PR-Aware con fallback automático a Standard.' },
    { name: 'graph-bot',         desc: 'Traversal 3 niveles en el grafo de dependencias. Detecta módulos core y calcula regression_risk.' },
    { name: 'api-contract-bot',  desc: 'Extrae endpoints del diff. Solo corre si diff_type = api o mixed.' },
  ]},
  { cluster: 'Executor', color: 'bg-emerald-50 border-emerald-200', agents: [
    { name: 'ui-bot',   desc: 'Ejecuta pruebas UI con Playwright MCP. Corre en paralelo con api-bot.' },
    { name: 'api-bot',  desc: 'Ejecuta pruebas de API con curl / HTTP. Corre en paralelo con ui-bot.' },
  ]},
  { cluster: 'Automator', color: 'bg-purple-50 border-purple-200', agents: [
    { name: 'code-gen-bot', desc: 'Genera specs Playwright + fixtures JSON con Tessl. Solo si el ticket tiene tag autotest.' },
  ]},
  { cluster: 'Publisher', color: 'bg-amber-50 border-amber-200', agents: [
    { name: 'report-bot', desc: 'Consolida resultados → POST agent-update-matrix-status en QA Hub → comenta veredicto en ClickUp.' },
  ]},
];

const MAS_VS_MANUAL = [
  { situation: 'Ticket con MR en GitHub/GitLab', use: '/gideon → 10 (MAS)', why: 'Lee el patch real del PR' },
  { situation: 'Módulos core afectados (auth, payments, shipping)', use: '/gideon → 10 (MAS)', why: 'Traversal 3 niveles de dependencias' },
  { situation: 'Ciclo completo: análisis + testing + automatización', use: '/gideon → 10 (MAS)', why: 'Todo automatizado sin intervención' },
  { situation: 'Solo generar la Matriz (sin correr pruebas aún)', use: '/gideon → 2 (ticket-analyst)', why: 'Más rápido, sin overhead de ejecución' },
  { situation: 'Ya tengo la Matriz, quiero registrar resultados', use: '/gideon → 3 (exploratory-tester)', why: 'Flujo manual directo' },
  { situation: 'Publicar ciclo SMOKE desde CSV/xlsx', use: '/gideon → 6 (release-publisher)', why: 'Para releases completos por versión' },
];

const FAQS = [
  {
    q: '¿El dev necesita login para ver la matriz?',
    a: 'No. La URL /#/m/{uuid} es pública sin login — cualquiera con el link puede verla.',
  },
  {
    q: '¿Por qué no veo la columna "Ticket" en la matriz?',
    a: 'ticket_id (TC-01, TC-02...) es un join key interno para la API. La UI muestra el # de fila (posición en el documento original) como identificador visible.',
  },
  {
    q: '¿Cómo obtengo la api_key?',
    a: 'Pídela al ADMIN QA. En el Playground arriba puedes pegarla y hacer pruebas inmediatamente.',
  },
  {
    q: '¿Qué pasa si el api_key es incorrecto?',
    a: 'Los endpoints devuelven 401 Unauthorized. Verifica que la copiaste completa sin espacios.',
  },
  {
    q: '¿Cómo actualizo Gideon con los últimos skills?',
    a: 'Corre bash ~/Projects/ai-toolkit/global_tools/update-gideon.sh — descarga la última versión de todos los skills desde ai_toolkit.',
  },
  {
    q: '¿Puedo tener varias matrices para el mismo ticket?',
    a: 'Sí. Cada llamada a agent-save-matrix con stage PRE-DEV o POST-DEV crea una versión nueva. Todas accesibles en Mi Espacio.',
  },
  {
    q: '¿Por qué el orden de las filas en QA Hub coincide con mi CSV?',
    a: 'agent-create-cycle guarda sort_order (posición del array) en custom_data de cada caso. La UI ordena por sort_order, independiente del ticket_id.',
  },
];

// ── Main page ──────────────────────────────────────────────────────────────
export default function Docs() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 text-white">
        <div className="max-w-5xl mx-auto px-6 py-14">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="h-8 w-8 text-blue-200" />
            <span className="text-blue-200 font-semibold text-sm uppercase tracking-wider">Documentación</span>
          </div>
          <h1 className="text-4xl font-extrabold mb-3 leading-tight">QA Hub + Gideon</h1>
          <p className="text-blue-100 text-lg max-w-2xl">
            Guía completa del sistema de QA de Shipedge: desde la instalación de Gideon hasta
            el uso de cada endpoint de la API.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://qa-hub-qvnt-jade.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <ExternalLink className="h-4 w-4" /> Abrir QA Hub
            </a>
            <a
              href="https://github.com/altacrest/ai_toolkit"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Terminal className="h-4 w-4" /> ai_toolkit en GitHub
            </a>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex gap-8 items-start">
          {/* Sticky nav — hidden on mobile */}
          <div className="hidden lg:block">
            <DocsNav />
          </div>

          {/* Main content */}
          <div className="flex-1 space-y-12 min-w-0">

            {/* ── QUICK START ── */}
            <Section id="quick-start" title="Quick Start" emoji="🚀">
              <Card>
                <h3 className="font-semibold text-gray-800 mb-3">1. Instalar Gideon</h3>
                <Code>{`# Clona el toolkit (solo la primera vez)
git clone https://github.com/altacrest/ai_toolkit.git ~/Projects/ai-toolkit

# Instala todo: Gideon QA + credenciales
bash ~/Projects/ai-toolkit/global_tools/install_ai_toolkit.sh`}</Code>
                <p className="mt-3 text-sm text-gray-600">
                  El wizard genera <code className="bg-gray-100 px-1 rounded text-xs">~/.gideon/credentials.json</code> con tus datos de ClickUp y QA Hub automáticamente.
                </p>
              </Card>

              <Card>
                <h3 className="font-semibold text-gray-800 mb-3">2. Actualizar skills (cuando haya cambios)</h3>
                <Code>{`bash ~/Projects/ai-toolkit/global_tools/update-gideon.sh`}</Code>
              </Card>

              <Card>
                <h3 className="font-semibold text-gray-800 mb-3">3. Primer uso en Antigravity IDE</h3>
                <Code>{`/gideon          → Abre el menú maestro
/gideon → 1      → Ver tickets + matrices
/gideon → 2      → Analizar un ticket
/gideon → 6      → Publicar ciclo de release`}</Code>
              </Card>
            </Section>

            {/* ── GIDEON SKILLS ── */}
            <Section id="gideon-skills" title="Gideon — Skills" emoji="🤖">
              <Card className="overflow-hidden p-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-8">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Skill</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Qué hace</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {SKILLS.map(s => (
                      <tr key={s.num} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{s.num}</td>
                        <td className="px-4 py-3">
                          <div className="font-mono font-semibold text-blue-800 text-xs mb-1">{s.name}</div>
                          <Badge color={s.color}>{s.badge}</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs hidden md:table-cell leading-relaxed">{s.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <Card>
                <h3 className="font-semibold text-gray-800 mb-3">Flujo típico de un QA</h3>
                <Code>{`1. /gideon → 1 → [B]       Ver mis matrices en QA Hub
                   → [A]       Ver mis tickets en ClickUp
2. /gideon → 2              Analizar ticket y generar Matriz
3. Ejecutar pruebas manualmente
4. /gideon → 3              Registrar resultados → QA Hub + ClickUp

── Ciclos de Release ─────────────────────────────────
5. /gideon → 6 → [2]       Publicar ciclo nuevo desde CSV/xlsx
6. /gideon → 6 → [3]       Actualizar resultados en ciclo existente`}</Code>
              </Card>
            </Section>

            {/* ── MAS ── */}
            <Section id="mas" title="MAS — Multi-Agent System" emoji="🤖">
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-semibold text-gray-800">¿Qué es el MAS?</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-3">
                  El MAS (<strong>Multi-Agent System</strong>) es el flujo QA más avanzado de Gideon.
                  En vez de un skill secuencial, orquesta <strong>agentes especializados en paralelo</strong>
                  con circuit breaker, auto-revisión de matrices y contexto real del PR/MR.
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Se activa con <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">/gideon → 10</code> o
                  escribiendo <em>"usa gideon-conductor"</em> directamente en el chat.
                </p>
              </Card>

              {/* Architecture */}
              <Card>
                <h3 className="font-semibold text-gray-800 mb-4">Arquitectura de Agentes</h3>
                <div className="space-y-3">
                  {MAS_AGENTS.map(cluster => (
                    <div key={cluster.cluster} className={`border rounded-lg p-3 ${cluster.color}`}>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Fase {cluster.cluster}
                      </div>
                      <div className="space-y-2">
                        {cluster.agents.map(agent => (
                          <div key={agent.name} className="flex gap-3">
                            <code className="text-xs font-mono font-semibold text-gray-700 whitespace-nowrap pt-0.5">  {agent.name}</code>
                            <p className="text-xs text-gray-600 leading-relaxed">{agent.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* 4 Phases */}
              <Card>
                <h3 className="font-semibold text-gray-800 mb-3">Las 4 Fases del MAS</h3>
                <Code>{`Fase 0 — Bootstrap
  Lee credentials.json, detecta sesiones interrumpidas,
  inicializa circuit breaker + session_id único.

Fase 1 — Análisis (Analyst Cluster)
  1A ticket-bot  → Extrae contexto completo del ticket ClickUp
  1B diff-bot    → Lee patch real del PR (o git diff en modo Standard)
  1B graph-bot   → Traversal 3 niveles: módulos directos → callers → transitivos
  1B api-bot*    → Extrae endpoints del diff (* solo si tipo API/Mixed)
  1C Auto-Review → El Conductor revisa su propia Matriz antes de mostrarla:
                   Check 1: ¿Cada archivo del diff tiene caso de prueba?
                   Check 2: ¿Cada regression_area tiene caso 🔄 Regresión?
                   Check 3: ¿Cada Happy Path tiene Edge/Error case? (solo riesgo HIGH)
  → Checkpoint 1: QA aprueba la Matriz antes de continuar

Fase 2 — Ejecución Paralela (Executor Cluster)
  ui-bot  + api-bot en PARALELO (según los tipos de casos de la Matriz)
  → Checkpoint 2: QA decide qué hacer con los fallos (R=Reportar/C=Continuar/I=Ignorar)

Fase 3 — Automatización (Automator Cluster)
  code-gen-bot → Genera specs Playwright + fixtures JSON con Tessl
  (Solo si el ticket tiene tag 'autotest' y QA confirma)

Fase 4 — Publicación (Publisher Cluster)
  report-bot → POST agent-update-matrix-status en QA Hub
             → Veredicto final en ClickUp (qa-approved / qa-rejected)`}</Code>
              </Card>

              {/* MAS vs Manual */}
              <Card className="p-0 overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-800">¿MAS o skill manual?</h3>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase">Situación</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase hidden sm:table-cell">Skill</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase hidden md:table-cell">Por qué</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {MAS_VS_MANUAL.map((row, i) => (
                      <tr key={i} className="hover:bg-blue-50/30">
                        <td className="px-4 py-2.5 text-gray-700 leading-relaxed">{row.situation}</td>
                        <td className="px-4 py-2.5 font-mono text-blue-800 hidden sm:table-cell whitespace-nowrap">{row.use}</td>
                        <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell">{row.why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {/* Circuit Breaker */}
              <Card>
                <h3 className="font-semibold text-gray-800 mb-3">Circuit Breaker</h3>
                <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                  Cada agente tiene máximo <strong>2 intentos</strong> antes de activar su fallback.
                  Un fallo individual <em>nunca</em> detiene el ciclo completo (excepto ticket-bot).
                  El estado se persiste en <code className="bg-gray-100 px-1 rounded text-xs">~/.gideon/&lt;proyecto&gt;/session_&lt;ticket&gt;_&lt;ts&gt;.json</code> —
                  si el IDE se cierra, el Conductor detecta la sesión y pregunta si reanudar.
                </p>
                <Code>{`ticket-bot falla  → ABORT — usar /gideon → 2 como fallback
diff-bot PR-API   → fallback automático a git diff (Standard)
diff-bot Standard → usar nombres de archivos inferibles del MR URL
graph-bot CLI     → leer graph.json con Python directo
graph-bot JSON    → skip análisis de regresión (no crítico)
ui-bot            → REQUIRES_HUMAN los casos fallidos
report-bot        → retry QA Hub → retry ClickUp → reporte en chat`}</Code>
              </Card>

              {/* QA Hub integration */}
              <Card>
                <h3 className="font-semibold text-gray-800 mb-3">Integración con QA Hub</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Fase</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Agente</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Endpoint</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Qué hace</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="px-3 py-2 text-gray-500">Fase 1</td>
                        <td className="px-3 py-2 font-mono text-blue-800">ticket-bot → Conductor</td>
                        <td className="px-3 py-2 font-mono text-emerald-700">agent-save-matrix</td>
                        <td className="px-3 py-2 text-gray-600">Publica la Matriz con todos los casos en PENDING</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-gray-500">Fase 4</td>
                        <td className="px-3 py-2 font-mono text-blue-800">report-bot</td>
                        <td className="px-3 py-2 font-mono text-emerald-700">agent-update-matrix-status</td>
                        <td className="px-3 py-2 text-gray-600">PATCH de statuses con los resultados reales de ui-bot/api-bot</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-gray-500 leading-relaxed">
                  <strong>report-bot</strong> y <strong>exploratory-tester</strong> son mutuamente excluyentes —
                  nunca se usan los dos en la misma sesión. Si el MAS ejecutó las pruebas, report-bot actualiza QA Hub.
                  Si el QA ejecutó manualmente, exploratory-tester hace lo mismo.
                </p>
              </Card>

              {/* PR-API config */}
              <Card>
                <h3 className="font-semibold text-gray-800 mb-3">Configurar Modo PR-API (GitHub / GitLab)</h3>
                <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                  Para que diff-bot lea el patch real del PR agrega en
                  <code className="bg-gray-100 px-1 rounded text-xs mx-1">~/.gideon/credentials.json</code>:
                </p>
                <Code>{`// GitHub
"projects": {
  "mi-repo": {
    "workflow": "pr_api",
    "vcs": {
      "provider": "github",
      "token": "ghp_xxxxx",
      "diff_url": "https://api.github.com/repos/{owner}/{repo}/pulls/{number}/files"
    }
  }
}

// GitLab
"vcs": {
  "provider": "gitlab",
  "token": "glpat-xxxxx",
  "diff_url": "https://gitlab.com/api/v4/projects/{id}/merge_requests/{number}/diffs"
}`}</Code>
                <p className="mt-3 text-xs text-gray-500">
                  Sin esta configuración, el MAS usa Modo Standard (git diff local). Ambos modos son completamente funcionales.
                </p>
              </Card>
            </Section>

            {/* ── QA HUB UI ── */}
            <Section id="qa-hub-ui" title="QA Hub — Interfaz" emoji="🗂️">
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { title: 'Ciclos de Release', desc: 'Vistas de SMOKE / SANITY / REGRESSION agrupadas por versión. La columna Estado es sticky a la derecha. Los títulos son sticky al hacer scroll vertical. Las columnas extra se muestran en el orden del CSV original.' },
                  { title: 'Mi Espacio', desc: 'Matrices personales por ticket. Cada QA tiene su propia vista. La URL pública /#/m/{uuid} es accesible sin login — compártela con el dev para que vea el estado en tiempo real.' },
                  { title: 'Sidebar Collapsible', desc: 'Click en «‹‹/››» para colapsar el sidebar a íconos. El estado se guarda en localStorage. En mobile se abre como drawer.' },
                  { title: 'Roles', desc: 'ADMIN: acceso total. QA_LEAD: puede crear ciclos y gestionar columnas. QA_TESTER: solo edita celdas y cambia status — no puede crear ni eliminar ciclos.' },
                ].map(item => (
                  <Card key={item.title}>
                    <h3 className="font-semibold text-gray-800 mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                  </Card>
                ))}
              </div>
            </Section>

            {/* ── API REFERENCE ── */}
            <Section id="api-reference" title="API Reference" emoji="🔌">
              <Card className="p-0 overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-mono">
                  Base URL: <span className="text-blue-700">https://leexvmoadhzwthzcbhph.supabase.co/functions/v1</span>
                  <br />Header: <span className="text-blue-700">x-api-key: {'<api_key>'}</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-8">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Endpoint</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Campos principales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ENDPOINTS.map(ep => (
                      <tr key={ep.num} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{ep.num}</td>
                        <td className="px-4 py-3">
                          <div className="font-mono font-semibold text-blue-800 text-xs mb-1">{ep.name}</div>
                          <p className="text-xs text-gray-500 leading-relaxed">{ep.desc}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 font-mono hidden md:table-cell leading-relaxed">{ep.fields}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </Section>

            {/* ── API PLAYGROUND ── */}
            <Section id="api-playground" title="API Playground" emoji="🧪">
              <Card>
                <p className="text-sm text-gray-600 mb-5 leading-relaxed">
                  Prueba los endpoints directamente desde aquí. Ingresa tu <strong>api_key</strong>,
                  selecciona el endpoint, edita el payload y presiona <em>Enviar</em>.
                  La api_key se guarda en tu navegador para no re-ingresarla.
                </p>
                <ApiPlayground />
              </Card>
            </Section>

            {/* ── FAQ ── */}
            <Section id="faq" title="FAQ" emoji="❓">
              <div className="space-y-3">
                {FAQS.map((faq, i) => (
                  <Card key={i}>
                    <h3 className="font-semibold text-gray-800 text-sm mb-1.5">{faq.q}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                  </Card>
                ))}
              </div>
            </Section>

          </div>
        </div>
      </div>
    </div>
  );
}
