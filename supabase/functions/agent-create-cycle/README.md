# agent-create-cycle

Supabase Edge Function que crea un nuevo ciclo de pruebas QA, inserta los test cases, inicializa sus ejecuciones con status `PENDING`, asigna `sort_order` automáticamente, y registra el evento en el audit trail.

---

## Endpoint

```
POST https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/agent-create-cycle
```

---

## Authentication

```
x-api-key: <AGENT_API_KEY>
```

---

## Request Body

| Campo | Tipo | Req | Descripción |
|---|---|---|---|
| `project_name` | `string` | ✅ | Nombre del proyecto (case-insensitive) |
| `version` | `string` | ✅ | Label de versión, ej: `"xe26.03.0-rc"` |
| `cycle_type` | `string` | ✅ | `"SMOKE"` \| `"SANITY"` \| `"REGRESSION"` |
| `test_cases` | `TestCase[]` | ✅ | Array de casos (ver abajo) |
| `created_by` | `string` | ✅ | `qa_hub_email` del QA (registrado en QA Hub) |
| `extra_columns` | `ExtraColumn[]` | ❌ | Columnas custom de la matriz (ver abajo) |

> [!IMPORTANT]
> `created_by` debe ser el email registrado en QA Hub (`qa_hub_email`), que puede ser distinto al email de Antigravity/ClickUp (`qa.email`).

### TestCase

| Campo | Tipo | Req | Descripción |
|---|---|---|---|
| `ticket_id` | `string` | ✅ | Join key interno (ej: `"NXEN-1001"`, `"TC-01"`). **No se muestra en UI** salvo que se agregue como columna explícita en `extra_columns` + `custom_data` |
| `title` | `string` | ✅ | Nombre del caso (renderizado por `_title`) |
| `module` | `string` | ❌ | Módulo / proyecto (renderizado por `_module`) |
| `expected_result` | `string` | ❌ | Resultado esperado (renderizado por `_expected_result`) |
| `custom_data` | `object` | ❌ | Valores de columnas custom — claves = `col_id` de `extra_columns` |

### ExtraColumn

| Campo | Tipo | Req | Descripción |
|---|---|---|---|
| `id` | `string` | ✅ | Identificador de la columna. Ver IDs reservados abajo |
| `name` | `string` | ✅ | Nombre visible en la UI (header de la tabla) |
| `type` | `string` | ✅ | `"text"` \| `"dropdown"` |
| `options` | `string[]` | ❌ | Opciones válidas — solo para `type: "dropdown"` |

#### IDs reservados

Los IDs que empiezan con `_` mapean directamente a campos del DB y **no van a `custom_data`**:

| ID reservado | Campo DB | Descripción |
|---|---|---|
| `_title` | `test_cases.title` | Nombre del caso |
| `_module` | `test_cases.module` | Módulo / proyecto |
| `_expected_result` | `test_cases.expected_result` | Resultado esperado |
| `_observation` | `test_executions.observation` | Observación de ejecución |

> [!NOTE]
> **Auto-inject `_title`:** Si `extra_columns` no incluye `_title`, la función lo inyecta automáticamente como primera columna. Esto garantiza que todos los ciclos nuevos operen en modo data-driven en la UI, eliminando las columnas hardcodeadas del modo legacy (MÓDULO/VÍA, Expected Result).

#### Orden de columnas

El orden de `extra_columns` en el request = orden de aparición en la UI. Debe respetar el **orden exacto del CSV/documento original**.

#### Auto-derivación de col_id (buena práctica)

Para generar IDs estables sin hardcodear, usa:

```python
import re

def to_col_id(header: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', header.lower().strip()).strip('_')

# Ejemplos:
# "ID TASK"     → "id_task"
# "QA Reviewer" → "qa_reviewer"
# "TASK STATUS" → "task_status"
```

Y sobrescribe con IDs reservados cuando corresponda:

```python
RESERVED_MAP = {
    'task_name': '_title', 'nombre': '_title', 'name': '_title',
    'modulo': '_module', 'module': '_module', 'project': '_module',
    'observation': '_observation', 'observacion': '_observation',
}
col_id = RESERVED_MAP.get(to_col_id(header), to_col_id(header))
```

---

## Comportamiento automático

- **`sort_order`** se asigna automáticamente = índice del array `test_cases` (0-based). QA Hub ordena por `sort_order`, no por `ticket_id`.
- **`test_executions`** se crean en `PENDING` para cada `test_case`.
- **`cycle_field_configs`** se crean por cada `ExtraColumn` para habilitar edición por columna.
- Si el proyecto no existe → `404`. Si el QA (`created_by`) no existe → `404`.

---

## Response

### 201 Created

```json
{
  "success": true,
  "cycle_id": "8881ef3b-d79d-4400-97b8-01460fd67f3b",
  "version_id": "1a2b3c4d-0000-0000-0000-000000000000",
  "matrix_url": "https://qa-hub-qvnt-jade.vercel.app/#/cycles/8881ef3b-d79d-4400-97b8-01460fd67f3b",
  "cases_created": 52
}
```

### Error responses

| Status | Razón |
|---|---|
| `400` | Campos faltantes o inválidos |
| `401` | `x-api-key` faltante o incorrecto |
| `404` | Proyecto o QA (`created_by`) no encontrado |
| `500` | Error interno / DB |

---

## Ejemplo completo

### SANITY desde CSV (con extra_columns auto-derivadas)

```bash
curl -X POST \
  https://leexvmoadhzwthzcbhph.supabase.co/functions/v1/agent-create-cycle \
  -H "Content-Type: application/json" \
  -H "x-api-key: gideon-shipedge-2026-secret" \
  -d '{
    "project_name": "XENVIO",
    "version": "xe26.03.0-rc",
    "cycle_type": "SANITY",
    "created_by": "qa@shipedge.com",
    "extra_columns": [
      {"id": "id_task",      "name": "ID TASK",      "type": "text"},
      {"id": "_title",       "name": "TASK NAME",     "type": "text"},
      {"id": "task_url",     "name": "TASK URL",      "type": "text"},
      {"id": "_module",      "name": "PROJECT",       "type": "text"},
      {"id": "assignee",     "name": "Assignee",      "type": "text"},
      {"id": "qa_reviewer",  "name": "QA Reviewer",   "type": "dropdown",
       "options": ["Fabricio Mariscal", "Lisette Nina", "Raquel Limachi", "Yecid Mendoza"]},
      {"id": "task_status",  "name": "TASK STATUS",   "type": "dropdown",
       "options": ["code review", "done w/d", "qa in process", "qa regression", "qa testing", "sprint intake"]},
      {"id": "_observation", "name": "OBSERVATION",   "type": "text"},
      {"id": "bug_ticket_reported", "name": "BUG TICKET REPORTED", "type": "text"}
    ],
    "test_cases": [
      {
        "ticket_id": "NXEN-1001",
        "title": "Feature: Dashboard Estadístico en XENVIO",
        "module": "Xenvio Angular",
        "expected_result": "",
        "custom_data": {
          "id_task":     "NXEN-1001",
          "task_url":    "https://app.clickup.com/t/86e1bfctq",
          "assignee":    "Gutber Gomez; Pepe (Jose Acho)",
          "qa_reviewer": "Lisette Nina",
          "task_status": "qa regression",
          "bug_ticket_reported": ""
        }
      }
    ]
  }'
```

---

## Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) |
| `AGENT_API_KEY` | Shared secret para `x-api-key` |

---

## Tablas afectadas

| Tabla | Operación | Notas |
|---|---|---|
| `projects` | SELECT | Lookup por nombre (ilike) |
| `qa_profiles` | SELECT | Verifica que `created_by` existe |
| `test_versions` | SELECT / INSERT | Encuentra o crea versión del proyecto |
| `test_cycles` | INSERT | Nuevo ciclo con status `IN_PROGRESS` |
| `test_cases` | INSERT | Una fila por entrada en `test_cases[]` |
| `test_executions` | INSERT | Una fila por test case, status `PENDING` |
| `cycle_field_configs` | INSERT | Una fila por `ExtraColumn` |
| `audit_logs` | INSERT | Registra el evento de creación |
