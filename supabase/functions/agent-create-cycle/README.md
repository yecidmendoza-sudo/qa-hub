# agent-create-cycle

Supabase Edge Function that creates a new QA test cycle, inserts test cases, initializes their executions, and logs the event to the audit trail.

---

## Endpoint

```
POST https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/agent-create-cycle
```

---

## Authentication

Include the shared API key as a request header:

```
x-api-key: <AGENT_API_KEY>
```

---

## Request Body

| Field          | Type             | Required | Description                              |
|----------------|------------------|----------|------------------------------------------|
| `project_name` | `string`         | ✅        | Project name (case-insensitive match)    |
| `version`      | `string`         | ✅        | Version label, e.g. `"v2.5.0"`          |
| `cycle_type`   | `string`         | ✅        | Type label, e.g. `"SANITY"`, `"REGRESSION"` |
| `test_cases`   | `TestCase[]`     | ✅        | Array of test case objects (see below)   |
| `created_by`   | `string`         | ✅        | Email of the requester                   |

### TestCase object

| Field             | Type     | Required | Description                          |
|-------------------|----------|----------|--------------------------------------|
| `ticket_id`       | `string` | ✅        | Unique identifier, e.g. `"TC-1"`    |
| `title`           | `string` | ✅        | Short description of the test        |
| `module`          | `string` | ❌        | Feature module, e.g. `"Auth"`        |
| `expected_result` | `string` | ❌        | Expected outcome description          |

---

## Response

### 201 Created

```json
{
  "success": true,
  "cycle_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "version_id": "1a2b3c4d-0000-0000-0000-000000000000",
  "matrix_url": "https://qa-hub-qvnt-jade.vercel.app/#/cycles/3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "cases_created": 5
}
```

### Error responses

```json
{ "success": false, "error": "<human-readable message>" }
```

| Status | Reason                                 |
|--------|----------------------------------------|
| `400`  | Missing or invalid fields              |
| `401`  | Missing or wrong `x-api-key`           |
| `404`  | Project not found                      |
| `500`  | Internal server error / DB failure     |

---

## Examples

### Basic sanity cycle

```bash
curl -X POST \
  https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/agent-create-cycle \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_AGENT_API_KEY" \
  -d '{
    "project_name": "XENVIO",
    "version": "v2.5.0",
    "cycle_type": "SANITY",
    "created_by": "gideon@shipedge.com",
    "test_cases": [
      {
        "ticket_id": "TC-1",
        "title": "Login con credenciales válidas",
        "module": "Auth",
        "expected_result": "Redirige al dashboard sin errores"
      },
      {
        "ticket_id": "TC-2",
        "title": "Crear envío desde cotizador",
        "module": "Cotizador",
        "expected_result": "Envío creado con guía asignada"
      },
      {
        "ticket_id": "TC-3",
        "title": "Descargar reporte CSV de envíos",
        "module": "Reportes",
        "expected_result": "Archivo CSV descargado con datos correctos"
      }
    ]
  }'
```

### Regression cycle with more cases

```bash
curl -X POST \
  https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/agent-create-cycle \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_AGENT_API_KEY" \
  -d '{
    "project_name": "Xenvio",
    "version": "v2.6.0-rc1",
    "cycle_type": "REGRESSION",
    "created_by": "qa-agent@shipedge.com",
    "test_cases": [
      { "ticket_id": "REG-01", "title": "Login", "module": "Auth" },
      { "ticket_id": "REG-02", "title": "Pago con tarjeta", "module": "Pagos", "expected_result": "Transacción aprobada" },
      { "ticket_id": "REG-03", "title": "Webhook de entrega", "module": "Integraciones", "expected_result": "Evento recibido y procesado" }
    ]
  }'
```

---

## Environment variables required

| Variable                   | Description                              |
|----------------------------|------------------------------------------|
| `SUPABASE_URL`             | Your project's Supabase URL              |
| `SUPABASE_SERVICE_ROLE_KEY`| Service role key (bypasses RLS)          |
| `AGENT_API_KEY`            | Shared secret for `x-api-key` auth       |

Set them via the Supabase Dashboard → Project Settings → Edge Functions → Secrets,  
or with the CLI:

```bash
supabase secrets set AGENT_API_KEY=your-secret-here
```

---

## Database tables touched

| Table             | Operation | Notes                                          |
|-------------------|-----------|------------------------------------------------|
| `projects`        | SELECT    | Lookup by name (ilike)                         |
| `test_versions`   | SELECT / INSERT | Finds or creates version for the project |
| `test_cycles`     | INSERT    | Creates new cycle with status `IN_PROGRESS`    |
| `test_cases`      | INSERT    | One row per entry in `test_cases` array        |
| `test_executions` | INSERT    | One row per test case, status `PENDING`        |
| `audit_logs`      | INSERT    | Records the creation event                     |
