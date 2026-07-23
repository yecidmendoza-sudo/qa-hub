# agent-report-results

Supabase Edge Function that updates test execution results for an existing QA cycle, recalculates the cycle's overall status, and writes audit log entries.

---

## Endpoint

```
POST https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/agent-report-results
```

---

## Authentication

Include the shared API key as a request header:

```
x-api-key: <AGENT_API_KEY>
```

---

## Request Body

| Field         | Type       | Required | Description                         |
|---------------|------------|----------|-------------------------------------|
| `cycle_id`    | `string`   | ✅        | UUID of the target cycle            |
| `results`     | `Result[]` | ✅        | Array of execution results          |
| `reported_by` | `string`   | ✅        | Email of the reporting agent/person |

### Result object

| Field         | Type     | Required | Description                                              |
|---------------|----------|----------|----------------------------------------------------------|
| `ticket_id`   | `string` | ✅        | Matches `ticket_id` in `test_cases` table               |
| `status`      | `string` | ✅        | One of: `PASS`, `FAIL`, `BLOCKED`, `SKIP`, `PENDING`   |
| `observation` | `string` | ❌        | Notes, error messages, or timing info                    |

---

## Cycle Status Derivation

After all executions are updated, the cycle status is recomputed from **all** executions in the cycle (not just those in the current request):

| Condition                              | Resulting `cycle_status` |
|----------------------------------------|--------------------------|
| Any execution is `FAIL`                | `FAILED`                 |
| All executions are `PASS` or `SKIP`    | `PASSED`                 |
| Any execution is `PENDING` or `BLOCKED`| `IN_PROGRESS`            |

---

## Response

### 200 OK

```json
{
  "success": true,
  "updated": 2,
  "cycle_status": "IN_PROGRESS",
  "matrix_url": "https://qa-hub-qvnt-jade.vercel.app/#/cycles/3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

If some `ticket_id` values were not found in the cycle, a `warnings` field is included:

```json
{
  "success": true,
  "updated": 1,
  "cycle_status": "IN_PROGRESS",
  "matrix_url": "https://qa-hub-qvnt-jade.vercel.app/#/cycles/...",
  "warnings": {
    "missing_tickets": ["TC-99"],
    "message": "Some ticket_ids were not found in this cycle and were skipped."
  }
}
```

### Error responses

```json
{ "success": false, "error": "<human-readable message>" }
```

| Status | Reason                                       |
|--------|----------------------------------------------|
| `400`  | Missing fields or invalid status value       |
| `401`  | Missing or wrong `x-api-key`                 |
| `404`  | `cycle_id` not found                         |
| `500`  | Internal server error / DB failure           |

---

## Examples

### Report mixed results (partial run)

```bash
curl -X POST \
  https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/agent-report-results \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_AGENT_API_KEY" \
  -d '{
    "cycle_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "reported_by": "gideon@shipedge.com",
    "results": [
      {
        "ticket_id": "TC-1",
        "status": "PASS",
        "observation": "Login completado en 1.2s"
      },
      {
        "ticket_id": "TC-2",
        "status": "FAIL",
        "observation": "Timeout en selector .btn-pay después de 5000ms"
      }
    ]
  }'
```

### Mark all cases as PASS (close the cycle)

```bash
curl -X POST \
  https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/agent-report-results \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_AGENT_API_KEY" \
  -d '{
    "cycle_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "reported_by": "qa-agent@shipedge.com",
    "results": [
      { "ticket_id": "TC-1", "status": "PASS" },
      { "ticket_id": "TC-2", "status": "PASS", "observation": "Fixed in hotfix-2.5.1" },
      { "ticket_id": "TC-3", "status": "SKIP", "observation": "Feature behind flag, skipped" }
    ]
  }'
```

Expected response: `"cycle_status": "PASSED"`

### Report a blocked case

```bash
curl -X POST \
  https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/agent-report-results \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_AGENT_API_KEY" \
  -d '{
    "cycle_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "reported_by": "gideon@shipedge.com",
    "results": [
      {
        "ticket_id": "TC-3",
        "status": "BLOCKED",
        "observation": "Ambiente de staging caído, no se puede probar"
      }
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

```bash
supabase secrets set AGENT_API_KEY=your-secret-here
```

---

## Database tables touched

| Table             | Operation | Notes                                                        |
|-------------------|-----------|--------------------------------------------------------------|
| `test_cycles`     | SELECT + UPDATE | Verifies cycle exists, updates final status         |
| `test_cases`      | SELECT    | Resolves `ticket_id` → `case_id`                            |
| `test_executions` | UPSERT    | Updates or creates execution row keyed on `case_id`         |
| `audit_logs`      | INSERT    | One entry per updated execution                             |

---

## Notes

- **Idempotent**: Calling this endpoint multiple times for the same `ticket_id` safely overwrites the previous result (upsert on `case_id`).
- **Partial updates**: You can report a subset of cases; the cycle status is recalculated from *all* executions in the cycle, not just those in the current request.
- **Missing tickets**: If a `ticket_id` in your request doesn't exist in the cycle, it is skipped with a warning — the rest of the results are still applied.
