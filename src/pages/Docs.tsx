import DocsNav from '../components/docs/DocsNav';
import ApiPlayground from '../components/docs/ApiPlayground';
import { ExternalLink, Terminal, BookOpen } from 'lucide-react';

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

// ── FAQ ────────────────────────────────────────────────────────────────────
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
