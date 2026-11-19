# Arquitectura — QA Hub

## Stack

| Capa | Tecnología | Propósito |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | SPA con HashRouter |
| Estilos | Tailwind CSS 4 | Utility-first, PostCSS |
| Backend / DB | Supabase (PostgreSQL + RLS) | Auth, storage, real-time |
| Edge Functions | Supabase Edge Functions (Deno) | API para agentes externos |
| Deploy | Vercel | Auto-deploy en push a `main` |

## Mapa de componentes

```
src/
├── App.tsx                          # Router principal (HashRouter)
├── main.tsx                         # Entry point
├── components/
│   ├── Layout.tsx                   # Sidebar collapsible + Outlet
│   ├── cycles/
│   │   └── AuditDrawer.tsx          # Drawer de historial de auditoría
│   ├── docs/
│   │   ├── DocsNav.tsx              # Navegación de documentación
│   │   └── ApiPlayground.tsx        # Playground interactivo para la API
│   ├── matrix/
│   │   ├── MatrixGrid.tsx           # Tabla principal de la matriz
│   │   ├── CsvImporter.tsx          # Import CSV/MD → ciclos
│   │   ├── ColumnEditor.tsx         # Edición inline de columnas
│   │   ├── ColumnFilterDropdown.tsx  # Filtros por columna
│   │   ├── AddColumnModal.tsx       # Modal para agregar columnas custom
│   │   ├── ManageColumnsModal.tsx   # Gestión de columnas existentes
│   │   ├── StatusOptionsEditor.tsx  # Editor de opciones de estado
│   │   └── TextCellPopover.tsx      # Popover position:fixed
│   └── shared/
│       └── ViewPublicButton.tsx     # Botón para vista pública
├── pages/
│   ├── Dashboard.tsx                # Estadísticas y resumen
│   ├── Projects.tsx                 # CRUD de proyectos (ADMIN)
│   ├── Cycles.tsx                   # Lista de ciclos por release
│   ├── Matrix.tsx                   # Vista ciclo — modo data-driven
│   ├── MySpace.tsx                  # Matrices personales (listado)
│   ├── MySpaceDetail.tsx            # Detalle de ticket personal
│   ├── MySpaceMatrix.tsx            # Matriz personal — paridad con Matrix
│   ├── Settings.tsx                 # Perfil, usuarios, campos custom
│   ├── Login.tsx                    # Auth con Supabase
│   ├── AcceptInvite.tsx             # Aceptación de invitación
│   ├── Docs.tsx                     # Documentación pública de la API
│   ├── MatrixPublicView.tsx         # Vista pública de matriz (sin login)
│   └── CyclePublicView.tsx          # Vista pública de ciclo
└── lib/
    ├── supabase/
    │   ├── client.ts                # Instancia de Supabase
    │   └── auth.tsx                 # AuthProvider + useAuth hook
    ├── parsers/
    │   └── hierarchicalCsvParser.ts # Parser CSV jerárquico
    ├── services/
    │   ├── matrixService.ts         # CRUD de casos, sort_order
    │   ├── personalMatrixService.ts # CRUD de matrices personales
    │   ├── cycleService.ts          # CRUD de ciclos/releases
    │   └── auditService.ts          # Historial de auditoría
    └── constants/
        ├── statusOptions.ts         # PENDING | PASS | FAIL | BLOCKED
        └── cycleLifecycle.ts        # Estados del ciclo de release
```

## Flujo de datos

```
Usuario (browser)
    │
    ▼
React SPA (Vite)  ──── Supabase Auth ────── supabase.auth
    │                                              │
    ├── Lectura directa ──────────────── PostgreSQL (RLS)
    │                                              │
    └── Edge Functions (Deno) ◄── Agentes externos (x-api-key)
         │
         ├── agent-save-matrix        → personal_matrices
         ├── agent-create-cycle       → cycles + test_cases
         ├── agent-report-results     → test_executions
         ├── agent-update-matrix-status → personal statuses
         ├── agent-list-matrices      → lectura para task-fetcher
         ├── agent-check-identity     → verificación email/rol
         ├── admin-invite-user        → crear QAs (solo ADMIN)
         └── matrix-public-view       → render sin login
```

## Rutas de la app

| Ruta | Página | Auth |
|---|---|---|
| `/login` | Login | No |
| `/m/:uuid` | Vista pública de matriz | No |
| `/cycles/public/:id` | Vista pública de ciclo | No |
| `/accept-invite` | Aceptar invitación | No |
| `/docs` | Documentación API | No |
| `/` | Dashboard | Sí |
| `/projects` | Proyectos | Sí |
| `/cycles` | Ciclos | Sí |
| `/cycles/:id` | Matriz del ciclo | Sí |
| `/settings` | Configuración | Sí |
| `/my-space` | Mi Espacio | Sí |
| `/my-space/:ticketId` | Detalle ticket | Sí |
| `/my-space/:ticketId/:versionId` | Matriz personal | Sí |

## Modo data-driven (Matrix)

Los ciclos nuevos siempre incluyen `_title` en `custom_columns`, activando el modo data-driven. Los IDs reservados (`_title`, `_module`, `_expected_result`, `_observation`) mapean a campos reales del DB; el resto va a `custom_data` como JSON.

El orden de `custom_columns` en la DB **es** el orden visible en la UI.

## Variables de entorno

```
VITE_SUPABASE_URL       → URL del proyecto Supabase
VITE_SUPABASE_ANON_KEY  → Clave anónima (pública) de Supabase
```
