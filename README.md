# QA Hub

Portal centralizado de QA para el equipo de Shipedge.

**🔗 App:** [https://qa-hub-qvnt-jade.vercel.app](https://qa-hub-qvnt-jade.vercel.app)  
**📦 Repositorio:** `yecidmendoza-sudo/qa-hub`  
**🚀 Deploy:** Vercel — auto-deploy en push a `main`  
**📚 Documentación completa:** Ver [QA_HUB.md](https://github.com/altacrest/ai_toolkit/blob/main/QA_HUB.md) en `ai_toolkit`

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS |
| Backend / DB | Supabase (PostgreSQL + RLS) |
| Edge Functions | Supabase Edge Functions (Deno/TypeScript) |
| Auth | Supabase Auth (email/password) |
| Deploy | Vercel |

---

## Edge Functions (API)

Todas requieren `x-api-key` en los headers.

| Endpoint | Descripción |
|---|---|
| `agent-save-matrix` | Publica matriz personal de ticket (Mi Espacio) |
| `agent-create-cycle` | Crea ciclo de release con `extra_columns` + `sort_order` automático |
| `agent-report-results` | Reporta/actualiza statuses en ciclos de release |
| `agent-update-matrix-status` | Actualiza statuses en matrices personales (Mi Espacio) |
| `agent-list-matrices` | Lista ciclos y matrices del QA (usado por task-fetcher) |
| `agent-check-identity` | Verifica email/rol del QA |
| `admin-invite-user` | Crea usuario QA (solo ADMIN) |
| `matrix-public-view` | Renderiza matriz pública sin login |

---

## Estructura del Proyecto

```
qa-hub/
├── src/
│   ├── components/
│   │   ├── Layout.tsx               # Sidebar collapsible + nav
│   │   ├── cycles/                  # Componentes de ciclos y releases
│   │   └── matrix/
│   │       ├── AddColumnModal.tsx   # Modal para agregar columnas custom
│   │       ├── CsvImporter.tsx      # Import CSV/MD a ciclos
│   │       └── TextCellPopover.tsx  # Popover de edición (position:fixed)
│   ├── pages/
│   │   ├── Matrix.tsx           # Vista ciclo — data-driven, filtros, guards
│   │   ├── MySpaceMatrix.tsx    # Vista Mi Espacio — misma paridad con Matrix.tsx
│   │   ├── Cycles.tsx           # Lista de ciclos por proyecto
│   │   ├── Dashboard.tsx
│   │   ├── MySpace.tsx          # Matrices personales (listado)
│   │   └── ...
│   └── lib/
│       └── services/
│           └── matrixService.ts  # Fetch, sort (sort_order), CRUD de casos
├── supabase/
│   └── functions/               # Edge functions (Deno)
└── README.md
```

---

## Comportamientos clave de la Matriz

### Modo Data-Driven (Matrix.tsx)

- **Activación:** Se activa cuando `cycle.custom_columns` tiene cualquier elemento (ya no requiere IDs reservados `_*`). Ciclos sin `custom_columns` usan modo legacy.
- **IDs reservados** — mapean directamente a campos del DB en lugar de `custom_data`:

  | ID | Campo DB | Descripción |
  |---|---|---|
  | `_title` | `test_cases.title` | Nombre del caso de prueba |
  | `_module` | `test_cases.module` | Módulo / proyecto |
  | `_expected_result` | `test_cases.expected_result` | Resultado esperado |
  | `_observation` | `test_executions.observation` | Observación del ejecutor |

- **Auto-inject `_title`:** `agent-create-cycle` inyecta `_title` automáticamente si no está incluido en `extra_columns`, garantizando modo data-driven en todos los ciclos nuevos.
- **Orden de columnas:** El orden de `custom_columns` en DB = orden de aparición en la UI = debe respetar el orden exacto del CSV/documento original.

### Columna de ID visible en UI

El `ticket_id` (NXEN-XXXX, TC-01, etc.) es el **join key interno** de la API. Para mostrarlo como columna visible:
- Incluirlo en `extra_columns` con un ID derivado: `{'id': 'id_task', 'name': 'ID TASK', 'type': 'text'}`
- Incluirlo también en `custom_data` de cada caso

Si el CSV no tiene columna de IDs, se generan sintéticos (`TC-01`, `TC-02`...) y no se agrega columna de ID a la UI.

### Columnas protegidas (Lock icon)

Las columnas marcadas como `locked: true` o con ID reservado (`_*`) muestran un 🔒 al hover y no pueden eliminarse desde la UI. Las columnas custom muestran un ✕ al hover para eliminarlas.

### Filtros

Ambas vistas (`Matrix.tsx` y `MySpaceMatrix.tsx`) tienen barra de filtros:
- **Texto libre** — busca en todos los valores de celdas
- **Estado** — PENDING / PASS / FAIL / BLOCKED
- **QA Reviewer** — filtra por reviewer (soporta valores separados por `;`)
- **Contador** — muestra `N / Total filas` en tiempo real
- **Limpiar** — resetea todos los filtros

### Guards de eliminación

Toda operación de borrado requiere confirmación:
- Eliminar fila: `¿Eliminar esta fila? Esta acción no se puede deshacer.`
- Eliminar columna: `¿Eliminar la columna "X"? Se borrarán todos los datos de esa columna en todas las filas.`
- Eliminar sección (Mi Espacio): confirmación con nombre de la sección

### Otros comportamientos

- **Orden de filas:** `custom_data.sort_order` (posición en CSV). Fallback: parse numérico de `ticket_id`.
- **Header sticky:** Sticky en scroll vertical. La columna Estado es sticky a la derecha.
- **Popover de texto:** `position: fixed` calculado desde `getBoundingClientRect()` — nunca se clipa.
- **Sidebar collapsible:** Botón `‹‹/››` colapsa el sidebar a 64px. Estado en `localStorage`.

---

## Desarrollo Local

```bash
npm install
npm run dev
```

Variables de entorno requeridas en `.env.local`:
```
VITE_SUPABASE_URL=https://leexvmoadhzwthzcbhph.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
```

---

## Deploy de Edge Functions

```bash
supabase functions deploy <nombre-funcion> --no-verify-jwt
```

Ejemplo:
```bash
supabase functions deploy agent-create-cycle --no-verify-jwt
supabase functions deploy agent-report-results --no-verify-jwt
```
