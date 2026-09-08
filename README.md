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
| `agent-check-identity` | Verifica email/rol del QA |
| `admin-invite-user` | Crea usuario QA (solo ADMIN) |
| `matrix-public-view` | Renderiza matriz pública sin login |

---

## Estructura del Proyecto

```
qa-hub/
├── src/
│   ├── components/
│   │   ├── Layout.tsx          # Sidebar collapsible + nav
│   │   ├── cycles/             # Componentes de ciclos y releases
│   │   └── matrix/
│   │       ├── CsvImporter.tsx      # Import CSV/MD a ciclos
│   │       └── TextCellPopover.tsx  # Popover de edición (position:fixed)
│   ├── pages/
│   │   ├── Matrix.tsx          # Vista principal de la matriz de ciclo
│   │   ├── Cycles.tsx          # Lista de ciclos por proyecto
│   │   ├── Dashboard.tsx
│   │   ├── MySpace.tsx         # Matrices personales
│   │   └── ...
│   └── lib/
│       └── services/
│           └── matrixService.ts  # Fetch, sort (sort_order), CRUD de casos
├── supabase/
│   └── functions/              # Edge functions (Deno)
└── README.md
```

---

## Comportamientos clave de la Matriz

- **Orden de filas:** Las filas se ordenan por `custom_data.sort_order` (posición en el documento original importado). Fallback: parse numérico de `ticket_id`.
- **Columna Ticket:** `ticket_id` (TC-01, TC-02...) es un join key interno — **no se muestra en la UI**. El `#` visible = posición en documento.
- **Columnas custom:** Se renderizan dinámicamente desde `cycle.custom_columns` (JSONB). Pueden ser `text` o `dropdown`. El orden de `custom_columns` en DB = orden de aparición en la UI = orden del CSV original.
- **Header sticky:** El header de la tabla es sticky en scroll vertical. La columna Estado es sticky a la derecha.
- **Popover de texto:** Usa `position: fixed` calculado desde `getBoundingClientRect()` — nunca se clipa con `overflow: hidden`.
- **Sidebar collapsible:** Botón `‹‹/››` colapsa el sidebar a 64px (solo iconos). Estado persistido en `localStorage`.

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
