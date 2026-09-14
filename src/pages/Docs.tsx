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

// ⚡ MAS — Multi-Agent System
const MAS_SKILLS = [
  { num: 1, name: 'MAS Conductor',  badge: 'Auto-completo',  color: 'purple' as const, desc: 'Analiza el ticket y genera la Matriz en paralelo (diff-bot + graph-bot + stress-heuristic). Checkpoint antes de ejecutar.' },
  { num: 2, name: 'mas-test',       badge: 'Web/API en vivo', color: 'blue'   as const, desc: 'Ejecuta casos 🖥️ UI, 🔌 API y 🔥 Stress con Playwright MCP. Task Queue: timeout por caso → siguiente. Al terminar: CSV + QA Hub + ClickUp.' },
  { num: 3, name: 'mas-mobile',     badge: 'Android en vivo', color: 'green'  as const, desc: 'Ejecuta casos 📱 MOBILE con Android MCP. healer-bot autocorrige selectores (1 reintento). Modo híbrido con flows Maestro existentes.' },
  { num: 4, name: 'Paralelo',       badge: 'MAS-TEST + Mobile', color: 'yellow' as const, desc: 'Lanza MAS-TEST (opción 2) y MAS-MOBILE (opción 3) simultáneamente. Consolida resultados en QA Hub al terminar ambos.' },
];

// 🔧 ENGINE QA — Herramientas individuales
const ENGINE_SKILLS = [
  { num: 5, name: 'task-fetcher',       badge: 'ClickUp + QA Hub', color: 'blue'   as const, desc: 'Punto de inicio del día. Opción [A] tus tickets en ClickUp, opción [B] tus matrices en QA Hub con statuses.' },
  { num: 6, name: 'ticket-analyst',     badge: 'Análisis',         color: 'purple' as const, desc: 'Analiza un ticket en profundidad y genera la Matriz de Pruebas (modo clásico sin paralelismo MAS). Incluye heurística de Stress Testing.' },
  { num: 7, name: 'exploratory-tester', badge: 'Manual',           color: 'green'  as const, desc: 'Solo modo manual — el QA ejecuta y registra resultados. Sincroniza QA Hub (Mi Espacio) y publica veredicto en ClickUp.' },
  { num: 8, name: 'suite-automator',    badge: 'Automatización',   color: 'yellow' as const, desc: 'Genera código Playwright / Tessl permanente (.spec.ts) para pipelines de CI/CD.' },
  { num: 9, name: 'suite-planner',      badge: 'Release',          color: 'blue'   as const, desc: 'Planifica suite de Release (Smoke/Sanity/Regression) y crea Ticket Maestro en ClickUp.' },
];

// ⚙️ CONFIGURACIÓN
const CONFIG_SKILLS = [
  { num: 11, name: 'setup-clickup',    badge: 'Config',   color: 'yellow' as const, desc: 'Configura usuarios de prueba por ambiente (admin, manager, regular) en credentials.json.' },
  { num: 12, name: 'Actualizar grafos', badge: 'Graphify', color: 'purple' as const, desc: 'Actualiza los grafos de dependencias de Graphify para los proyectos configurados en credentials.json.' },
];

// release-publisher (opción 10 del Engine QA)
const RELEASE_SKILL = { num: 10, name: 'release-publisher', badge: 'Release', color: 'blue' as const, desc: '[2] Crea ciclo nuevo desde CSV/xlsx: auto-deriva col_id de los headers, detecta dropdowns, respeta el orden exacto del CSV. [3] Reporta resultados en ciclo existente.' };



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
const MAS_CONDUCTOR_AGENTS = [
  { cluster: 'Analyst', color: 'bg-blue-50 border-blue-200', agents: [
    { name: 'ticket-bot',        desc: 'Lee ticket de ClickUp: título, criterios, MR URL, branch, tags, versión.' },
    { name: 'diff-bot',          desc: 'Lee el patch real del PR (GitHub/GitLab API) o git diff. PR-Aware con fallback automático a Standard.' },
    { name: 'graph-bot',         desc: 'Traversal 3 niveles en el grafo de dependencias. Detecta módulos core y calcula regression_risk.' },
    { name: 'stress-heuristic',  desc: 'Autodetecta casos de Stress Testing en el diff. Solo corre si hay patrones de rendimiento.' },
    { name: 'api-contract-bot',  desc: 'Extrae endpoints del diff. Solo corre si diff_type = api o mixed.' },
  ]},
  { cluster: 'Automator', color: 'bg-purple-50 border-purple-200', agents: [
    { name: 'code-gen-bot', desc: 'Genera specs Playwright + fixtures JSON con Tessl. Solo si el ticket tiene tag autotest.' },
  ]},
  { cluster: 'Publisher', color: 'bg-amber-50 border-amber-200', agents: [
    { name: 'report-bot', desc: 'Consolida resultados → POST agent-update-matrix-status en QA Hub → comenta veredicto en ClickUp.' },
  ]},
];

const MAS_TEST_AGENTS = [
  { cluster: 'Orchestrator', color: 'bg-blue-50 border-blue-200', agents: [
    { name: 'ui-bot',      desc: 'Ejecuta casos 🖥️ UI con Playwright MCP. Auto-sanación: si un selector falla, analiza el DOM y reintenta con alternativa.' },
    { name: 'api-bot',     desc: 'Ejecuta casos 🔌 API generando fixtures JSON. Polling inteligente para flujos E2E multi-sistema.' },
    { name: 'stress-bot',  desc: 'Ejecuta casos 🔥 Stress: acciones masivas en bucle. Detecta crash/freeze del navegador.' },
  ]},
];

const MAS_MOBILE_AGENTS = [
  { cluster: 'Orchestrator', color: 'bg-green-50 border-green-200', agents: [
    { name: 'device-bot',        desc: 'Gestiona el emulador/dispositivo: ListDevices, ConnectDevice, instala APK, pre-otorga permisos.' },
    { name: 'mobile-ui-bot',     desc: 'Ejecuta casos 📱 MOBILE con Android MCP: Click, Type, Swipe, WaitForElement, Snapshot.' },
    { name: 'healer-bot',        desc: 'Si un selector falla: Snapshot() → analiza DOM → propone alternativa → reintenta (1 vez). Registra corrección en CSV.' },
    { name: 'mobile-stress-bot', desc: 'Ejecuta casos 🔥 Stress mobile: input masivo, scroll rápido, tap en bucle. Detecta ANR/crash.' },
  ]},
];

const MAS_VS_MANUAL = [
  { situation: 'Ticket con MR en GitHub/GitLab', use: '/gideon → 1 (MAS Conductor)', why: 'Lee el patch real del PR + análisis en paralelo' },
  { situation: 'Módulos core afectados (auth, payments, shipping)', use: '/gideon → 1 (MAS Conductor)', why: 'Traversal 3 niveles de dependencias' },
  { situation: 'Tengo Matriz, quiero ejecutar pruebas Web/API', use: '/gideon → 2 (MAS-TEST)', why: 'Playwright MCP sin .spec.ts — directo al navegador' },
  { situation: 'Tengo Matriz, quiero ejecutar pruebas Android', use: '/gideon → 3 (MAS-MOBILE)', why: 'Android MCP + healer-bot para selectores rotos' },
  { situation: 'Quiero ejecutar Web/API + Android a la vez', use: '/gideon → 4 (Paralelo)', why: 'Ambos MAS en simultáneo si la Mac lo soporta' },
  { situation: 'Solo generar la Matriz (sin correr pruebas aún)', use: '/gideon → 6 (ticket-analyst)', why: 'Más rápido, sin overhead de ejecución' },
  { situation: 'Ya tengo la Matriz, quiero registrar resultados manuales', use: '/gideon → 7 (exploratory-tester)', why: 'Flujo manual directo' },
  { situation: 'Publicar ciclo SMOKE/SANITY desde CSV/xlsx', use: '/gideon → 10 (release-publisher)', why: 'Para releases completos por versión' },
];

const FAQS = [
  {
    q: '¿El dev necesita login para ver la matriz?',
    a: 'No. La URL /#/m/{uuid} es pública sin login — cualquiera con el link puede verla.',
  },
  {
    q: '¿Por qué no veo el ID (NXEN-XXXX) como columna en la matriz?',
    a: 'ticket_id es el join key interno de la API. Para que aparezca como columna visible, Gideon lo incluye en extra_columns (ej: id_task) Y en custom_data de cada caso. Si el CSV no tiene columna de IDs propios, se generan TC-01, TC-02... internos y no se agrega columna de ID a la UI.',
  },
  {
    q: '¿Por qué Gideon da "User not found" al publicar?',
    a: 'created_by en agent-create-cycle debe ser el email registrado en QA Hub (qa_hub_email), no el email de Antigravity/ClickUp. En credentials.json están separados: credentials.qa.email (Antigravity) vs credentials.qa.qa_hub_email (QA Hub).',
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
    a: 'Corre: git pull && bash update-gideon.sh desde ~/Projects/ai-toolkit — descarga la última versión de todos los skills.',
  },
  {
    q: '¿Puedo tener varias matrices para el mismo ticket?',
    a: 'Sí. Cada llamada a agent-save-matrix con stage PRE-DEV o POST-DEV crea una versión nueva. Todas accesibles en Mi Espacio.',
  },
  {
    q: '¿Por qué el orden de las filas en QA Hub coincide con mi CSV?',
    a: 'agent-create-cycle guarda sort_order (posición del array) en custom_data de cada caso. La UI ordena por sort_order, independiente del ticket_id.',
  },
  {
    q: '¿Puedo tener columnas en cualquier orden?',
    a: 'Sí. El orden de extra_columns en el request define el orden en QA Hub. Gideon respeta el orden exacto del CSV. _title va donde está "Task Name" en el CSV, no necesariamente como primera columna.',
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
          <div className="mt-6 flex flex-wrap gap-3 lg:hidden">
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
          <div className="hidden lg:block sticky top-6 self-start max-h-[calc(100vh-3rem)] overflow-y-auto">
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
                <Code>{`cd ~/Projects/ai-toolkit
git pull
bash update-gideon.sh`}</Code>
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

              {/* MAS section */}
              <div className="text-xs font-bold text-purple-700 uppercase tracking-wider px-1 pb-1">⚡ MAS — Multi-Agent System <span className="font-normal text-gray-400 normal-case">(flujo principal)</span></div>
              <Card className="overflow-hidden p-0">
                <table className="w-full text-sm">
                  <thead className="bg-purple-50 border-b border-purple-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-8">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Skill</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Qué hace</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {MAS_SKILLS.map(s => (
                      <tr key={s.num} className="hover:bg-purple-50/40 transition-colors">
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{s.num}</td>
                        <td className="px-4 py-3">
                          <div className="font-mono font-semibold text-purple-800 text-xs mb-1">{s.name}</div>
                          <Badge color={s.color}>{s.badge}</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs hidden md:table-cell leading-relaxed">{s.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {/* Engine QA section */}
              <div className="text-xs font-bold text-blue-700 uppercase tracking-wider px-1 pb-1 mt-4">🔧 Engine QA — Herramientas individuales</div>
              <Card className="overflow-hidden p-0">
                <table className="w-full text-sm">
                  <thead className="bg-blue-50 border-b border-blue-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-8">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Skill</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Qué hace</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ENGINE_SKILLS.map(s => (
                      <tr key={s.num} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{s.num}</td>
                        <td className="px-4 py-3">
                          <div className="font-mono font-semibold text-blue-800 text-xs mb-1">{s.name}</div>
                          <Badge color={s.color}>{s.badge}</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs hidden md:table-cell leading-relaxed">{s.desc}</td>
                      </tr>
                    ))}
                    <tr key={RELEASE_SKILL.num} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{RELEASE_SKILL.num}</td>
                      <td className="px-4 py-3">
                        <div className="font-mono font-semibold text-blue-800 text-xs mb-1">{RELEASE_SKILL.name}</div>
                        <Badge color={RELEASE_SKILL.color}>{RELEASE_SKILL.badge}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs hidden md:table-cell leading-relaxed">{RELEASE_SKILL.desc}</td>
                    </tr>
                  </tbody>
                </table>
              </Card>

              {/* Config section */}
              <div className="text-xs font-bold text-gray-600 uppercase tracking-wider px-1 pb-1 mt-4">⚙️ Configuración</div>
              <Card className="overflow-hidden p-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-8">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Skill</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Qué hace</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {CONFIG_SKILLS.map(s => (
                      <tr key={s.num} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{s.num}</td>
                        <td className="px-4 py-3">
                          <div className="font-mono font-semibold text-gray-700 text-xs mb-1">{s.name}</div>
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
                <Code>{`── Análisis + Ejecución Automática ───────────────────
1. /gideon → 1              MAS Conductor: analiza ticket + genera Matriz
2. /gideon → 2              MAS-TEST: ejecuta pruebas Web/API en vivo
3. /gideon → 3              MAS-MOBILE: ejecuta pruebas Android en vivo
4. /gideon → 4              Paralelo: Web/API + Android simultáneamente

── Flujo Manual ──────────────────────────────────────
5. /gideon → 5 → [B]        Ver mis matrices en QA Hub
              → [A]          Ver mis tickets en ClickUp
6. /gideon → 6              Analizar ticket (modo clásico)
7. /gideon → 7              Registrar resultados manuales → QA Hub + ClickUp

── Ciclos de Release ─────────────────────────────────
8. /gideon → 10 → [2]       Publicar ciclo nuevo desde CSV/xlsx
9. /gideon → 10 → [3]       Actualizar resultados en ciclo existente`}</Code>
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
                  Tiene tres modos independientes que pueden usarse por separado o en conjunto:
                </p>
                <div className="grid md:grid-cols-3 gap-3 text-xs">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="font-semibold text-purple-800 mb-1">1. MAS Conductor <span className="text-purple-400">/gideon → 1</span></p>
                    <p className="text-purple-700 leading-relaxed">Análisis profundo: diff-bot + graph-bot + stress-heuristic en paralelo. Genera la Matriz y espera tu aprobación antes de continuar.</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="font-semibold text-blue-800 mb-1">2. MAS-TEST <span className="text-blue-400">/gideon → 2</span></p>
                    <p className="text-blue-700 leading-relaxed">Ejecuta casos UI/API/Stress con Playwright MCP. Task Queue: nunca detiene la cola por un fallo individual. Timeout de 60s por caso.</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="font-semibold text-green-800 mb-1">3. MAS-MOBILE <span className="text-green-400">/gideon → 3</span></p>
                    <p className="text-green-700 leading-relaxed">Ejecuta casos Android con Android MCP. healer-bot autocorrige selectores rotos. Timeout de 90s por caso (mobile es más lento).</p>
                  </div>
                </div>
              </Card>

              {/* MAS Conductor — Arquitectura */}
              <Card>
                <h3 className="font-semibold text-gray-800 mb-4">MAS Conductor — Agentes (/gideon → 1)</h3>
                <div className="space-y-3">
                  {MAS_CONDUCTOR_AGENTS.map(cluster => (
                    <div key={cluster.cluster} className={`border rounded-lg p-3 ${cluster.color}`}>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Cluster {cluster.cluster}
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

              {/* MAS Conductor — Fases */}
              <Card>
                <h3 className="font-semibold text-gray-800 mb-3">Las Fases del MAS Conductor</h3>
                <Code>{`Fase 0 — Bootstrap
  Lee credentials.json, detecta sesiones interrumpidas,
  inicializa circuit breaker + session_id único.

Fase 1 — Análisis (Analyst Cluster, en paralelo)
  ticket-bot         → Extrae contexto completo del ticket ClickUp
  diff-bot           → Lee patch real del PR (o git diff en modo Standard)
  graph-bot          → Traversal 3 niveles: módulos directos → callers → transitivos
  stress-heuristic   → Autodetecta casos de Stress en el diff
  api-contract-bot*  → Extrae endpoints del diff (* solo si tipo API/Mixed)

  Auto-Review — El Conductor revisa su propia Matriz:
    Check 1: ¿Cada archivo del diff tiene caso de prueba?
    Check 2: ¿Cada regression_area tiene caso 🔄 Regresión?
    Check 3: ¿Cada Happy Path tiene Edge/Error case? (solo riesgo HIGH)
  → Checkpoint: QA aprueba la Matriz antes de continuar

Fase 3 — Automatización (Automator Cluster)
  code-gen-bot → Genera specs Playwright + fixtures JSON con Tessl
  (Solo si el ticket tiene tag 'autotest' y QA confirma)

Fase 4 — Publicación (Publisher Cluster)
  report-bot → POST agent-update-matrix-status en QA Hub
             → Veredicto final en ClickUp (qa-approved / qa-rejected)`}</Code>
              </Card>

              {/* MAS-TEST — Agentes */}
              <Card>
                <h3 className="font-semibold text-gray-800 mb-4">MAS-TEST — Agentes (/gideon → 2)</h3>
                <div className="space-y-3">
                  {MAS_TEST_AGENTS.map(cluster => (
                    <div key={cluster.cluster} className={`border rounded-lg p-3 ${cluster.color}`}>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        {cluster.cluster}
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
                <div className="mt-3">
                  <Code>{`Task Queue (tolerancia a fallos):

Para cada caso PENDING en la cola:
  1. Asigna al subagente: ui-bot / api-bot / stress-bot
  2. Espera resultado (timeout: 60s)
  3. Clasifica:
     - PASS          → Estado = "✅ Aprobado"
     - FAIL          → Estado = "❌ Fallido" + observación
     - Sin respuesta → Estado = "⏱ TIMEOUT / REQUIRES_HUMAN"
  4. Actualiza esa fila en el CSV inmediatamente
  5. → Siguiente caso (nunca se detiene)

Al terminar: POST agent-update-matrix-status → comentario ClickUp`}</Code>
                </div>
              </Card>

              {/* MAS-MOBILE — Agentes */}
              <Card>
                <h3 className="font-semibold text-gray-800 mb-4">MAS-MOBILE — Agentes (/gideon → 3)</h3>
                <div className="space-y-3">
                  {MAS_MOBILE_AGENTS.map(cluster => (
                    <div key={cluster.cluster} className={`border rounded-lg p-3 ${cluster.color}`}>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        {cluster.cluster}
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
                <div className="mt-3">
                  <Code>{`Tolerancia a fallos:

Para cada caso MOBILE con Estado=PENDING:
  1. Asigna al mobile-ui-bot o mobile-stress-bot
  2. Si FAIL en 1er intento → healer-bot intenta autocorrección
  3. Si FAIL en 2do intento → Estado = "❌ Fallido" + screenshot
  4. Si crash de la app → reinicia: adb shell am force-stop {pkg}
                           + Wait(3000) antes del siguiente caso

Modo Híbrido: usa flows Maestro .yaml existentes en {mobile_dir}/flows/
Al terminar: POST agent-update-matrix-status → comentario ClickUp`}</Code>
                </div>
              </Card>

              {/* MAS vs Manual */}
              <Card className="p-0 overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-800">¿Qué modo usar?</h3>
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
                <Code>{`ticket-bot falla  → ABORT — usar /gideon → 6 como fallback
diff-bot PR-API   → fallback automático a git diff (Standard)
diff-bot Standard → usar nombres de archivos inferibles del MR URL
graph-bot CLI     → leer graph.json con Python directo
graph-bot JSON    → skip análisis de regresión (no crítico)
ui-bot / api-bot  → REQUIRES_HUMAN los casos fallidos (MAS-TEST)
report-bot        → retry QA Hub → retry ClickUp → reporte en chat`}</Code>
              </Card>

              {/* QA Hub integration */}
              <Card>
                <h3 className="font-semibold text-gray-800 mb-3">Integración con QA Hub</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Skill</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Agente</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Endpoint</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Qué hace</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="px-3 py-2 text-purple-700 font-mono">Conductor</td>
                        <td className="px-3 py-2 font-mono text-blue-800">ticket-bot</td>
                        <td className="px-3 py-2 font-mono text-emerald-700">agent-save-matrix</td>
                        <td className="px-3 py-2 text-gray-600">Publica la Matriz con todos los casos en PENDING</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-purple-700 font-mono">Conductor</td>
                        <td className="px-3 py-2 font-mono text-blue-800">report-bot</td>
                        <td className="px-3 py-2 font-mono text-emerald-700">agent-update-matrix-status</td>
                        <td className="px-3 py-2 text-gray-600">PATCH de statuses tras la ejecución</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-blue-700 font-mono">MAS-TEST</td>
                        <td className="px-3 py-2 font-mono text-blue-800">Orchestrator</td>
                        <td className="px-3 py-2 font-mono text-emerald-700">agent-update-matrix-status</td>
                        <td className="px-3 py-2 text-gray-600">Actualiza statuses Web/API en la versión existente</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-green-700 font-mono">MAS-MOBILE</td>
                        <td className="px-3 py-2 font-mono text-blue-800">Orchestrator</td>
                        <td className="px-3 py-2 font-mono text-emerald-700">agent-update-matrix-status</td>
                        <td className="px-3 py-2 text-gray-600">Actualiza statuses Mobile en la versión existente</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-gray-500 leading-relaxed">
                  MAS-TEST y MAS-MOBILE pueden ejecutarse sobre una misma Matriz (publicada por el Conductor).
                  Cada uno actualiza solo sus rows correspondientes — los tipos de caso determinan qué bot los ejecuta.
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
                  { title: 'Ciclos de Release', desc: 'Vistas SMOKE / SANITY / REGRESSION por versión. Columnas renderizadas dinámicamente desde el CSV (data-driven). Orden de columnas = orden exacto del CSV. Estado sticky a la derecha. Header sticky en scroll.' },
                  { title: 'Mi Espacio', desc: 'Matrices personales por ticket. URL pública /#/m/{uuid} sin login — compártela con el dev. Paridad completa de features con ciclos: filtros, guards, lock icons.' },
                  { title: 'Filtros en Matriz', desc: 'Barra de filtros en ambas vistas: búsqueda de texto libre en todas las celdas, filtro por Estado (PASS/FAIL/BLOCKED/PENDING) y por QA Reviewer. Contador en tiempo real de filas visibles.' },
                  { title: 'Columnas Protegidas', desc: 'Columnas con IDs reservados (_title, _module, _observation) muestran 🔒 y no pueden eliminarse. Columnas custom muestran ✕ al hover. Todo borrado requiere confirmación (guard dialog).' },
                  { title: 'Sidebar Collapsible', desc: 'Click en «‹‹/››» para colapsar el sidebar a íconos (64px). Estado guardado en localStorage.' },
                  { title: 'Roles', desc: 'ADMIN: acceso total. QA_LEAD: crea ciclos y gestiona columnas. QA_TESTER: edita celdas y cambia status — no puede crear/eliminar ciclos ni columnas.' },
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

            {/* ── PERSONALIZAR SKILLS ── */}
            <Section id="custom-skills" title="Personalizar Skills" emoji="🔧">
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                Las skills de Gideon viven en{' '}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">~/.gemini/config/plugins/gideon-qa-plugin/skills/</code>.
                Puedes modificar cualquier <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">SKILL.md</code> ahí
                para ajustar el comportamiento de Gideon a tus necesidades — sin tocar el repositorio <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">ai-toolkit</code>.
              </p>

              <div className="space-y-4">
                <Card>
                  <h3 className="font-semibold text-gray-800 mb-3">⚠️ Importante — los cambios se pierden con cada update</h3>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">
                    Cada vez que corres <code className="bg-gray-100 px-1 rounded text-xs">bash update-gideon.sh</code>, el script
                    copia la versión oficial de <code className="bg-gray-100 px-1 rounded text-xs">ai-toolkit</code> y sobrescribe tu skill local.
                    Tienes dos alternativas para que tus cambios sobrevivan:
                  </p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-blue-800 mb-1">Opción A — Workspace skill personal</p>
                      <p className="text-xs text-blue-700 leading-relaxed">
                        Crea tu versión en <code className="bg-blue-100 px-1 rounded">WORKSPACE/.agents/skills/mi-skill/SKILL.md</code>.
                        Antigravity la carga junto al plugin — nunca es tocada por el update.
                        Ideal para ajustes personales.
                      </p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-green-800 mb-1">Opción B — Contribuir al equipo (recomendado)</p>
                      <p className="text-xs text-green-700 leading-relaxed">
                        Si tu mejora beneficia a todos, abre un PR en <code className="bg-green-100 px-1 rounded">ai-toolkit</code>.
                        El lead QA aprueba y en el próximo update todos la reciben.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card>
                  <h3 className="font-semibold text-gray-800 mb-3">Dónde están los archivos de cada skill</h3>
                  <code className="block bg-gray-900 text-gray-100 text-xs font-mono p-4 rounded-lg leading-relaxed">
                    {'~/.gemini/config/plugins/gideon-qa-plugin/'}<br />
                    {'  skills/'}<br />
                    {'    task-fetcher/'}<br />
                    {'      SKILL.md'}<br />
                    {'    ticket-analyst/'}<br />
                    {'      SKILL.md   ← heurística de Stress Testing'}<br />
                    {'    exploratory-tester/'}<br />
                    {'      SKILL.md   ← solo modo manual'}<br />
                    {'    mas-test/'}<br />
                    {'      SKILL.md   ← UI/API/Stress con Playwright MCP'}<br />
                    {'    mas-mobile/'}<br />
                    {'      SKILL.md   ← Android MCP + healer-bot'}<br />
                    {'    release-publisher/'}<br />
                    {'      SKILL.md'}<br />
                    {'    suite-automator/'}<br />
                    {'      SKILL.md'}<br />
                    {'    suite-planner/'}<br />
                    {'      SKILL.md'}<br />
                    {'    mobile-automator/'}<br />
                    {'      SKILL.md'}<br />
                    {'    setup-clickup/'}<br />
                    {'      SKILL.md'}<br />
                  </code>
                </Card>

                <Card>
                  <h3 className="font-semibold text-gray-800 mb-3">Qué decirle a tu agente en Antigravity IDE para que tome los cambios</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Antigravity carga los <code className="bg-gray-100 px-1 rounded text-xs">SKILL.md</code> al inicio de cada conversación.
                    Después de editar un skill, basta con:
                  </p>
                  <div className="space-y-3">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2">1. Iniciar una nueva conversación</p>
                      <p className="text-xs text-gray-600">El agente siempre lee los skills frescos al empezar. Cierra el chat actual y abre uno nuevo — ya tendrá tu versión modificada.</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2">2. Decirle explícitamente qué skill debe usar</p>
                      <code className="block bg-gray-900 text-green-400 text-xs font-mono p-3 rounded mt-2 leading-relaxed">
                        {'usa el skill release-publisher para publicar esta matriz'}<br />
                        {'lee las instrucciones de ticket-analyst y analiza el ticket XXXX'}<br />
                        {'sigue el skill exploratory-tester para registrar estos resultados'}
                      </code>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-amber-800 mb-1">💡 Tip — verificar qué versión está usando</p>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        Puedes pedirle: <em>"muéstrame las primeras líneas del skill release-publisher"</em> y el agente
                        te mostrará el contenido del <code className="bg-amber-100 px-1 rounded">SKILL.md</code> que está cargado,
                        así confirmas que tiene tu versión modificada.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </Section>

          </div>
        </div>
      </div>
    </div>
  );
}
