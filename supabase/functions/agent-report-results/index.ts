// agent-report-results
// Supabase Edge Function — Deno/TypeScript
// Updates test execution results for an existing QA cycle.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-api-key, x-client-info, apikey",
};

const QA_HUB_BASE_URL = Deno.env.get("QA_HUB_BASE_URL") ?? "https://qa-hub-qvnt-jade.vercel.app";

// ── Valid execution statuses ───────────────────────────────────────────────
const VALID_STATUSES = ["PASS", "FAIL", "BLOCKED", "SKIP", "PENDING"] as const;
type ExecutionStatus = (typeof VALID_STATUSES)[number];

// ── Types ──────────────────────────────────────────────────────────────────

interface ResultInput {
  ticket_id: string;
  status: ExecutionStatus;
  observation?: string;
}

interface ReportResultsPayload {
  cycle_id: string;
  results: ResultInput[];
  reported_by: string;
}

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  // ── API Key auth ────────────────────────────────────────────────────────
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("AGENT_API_KEY");

  if (!expectedKey) {
    console.error("AGENT_API_KEY env var is not set");
    return jsonError("Server misconfiguration: AGENT_API_KEY not set", 500);
  }
  if (!apiKey || apiKey !== expectedKey) {
    return jsonError("Unauthorized: invalid or missing x-api-key", 401);
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  let payload: ReportResultsPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { cycle_id, results, reported_by } = payload;

  if (!cycle_id || !reported_by) {
    return jsonError("Missing required fields: cycle_id, reported_by", 400);
  }
  if (!Array.isArray(results) || results.length === 0) {
    return jsonError("results must be a non-empty array", 400);
  }

  // Validate statuses
  for (const r of results) {
    if (!VALID_STATUSES.includes(r.status)) {
      return jsonError(
        `Invalid status "${r.status}" for ticket_id "${r.ticket_id}". ` +
          `Allowed: ${VALID_STATUSES.join(", ")}`,
        400,
      );
    }
  }

  // ── Supabase client (service role) ──────────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonError("Server misconfiguration: Supabase env vars not set", 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    // ── 0. Verify reporter identity ──────────────────────────────────────
    const { data: reporterProfile } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("email", reported_by.toLowerCase().trim())
      .maybeSingle();

    if (!reporterProfile) {
      return jsonError(
        `El email "${reported_by}" no está registrado en QA Hub. Contacta a tu admin para que cree tu cuenta.`,
        403,
      );
    }
    if (reporterProfile.active === false) {
      return jsonError(
        `La cuenta "${reported_by}" está desactivada. Contacta a tu admin para reactivarla.`,
        403,
      );
    }

    // ── Verify cycle exists and fetch project_id via version ──────────────
    const { data: cycle, error: cycleError } = await supabase
      .from("test_cycles")
      .select("id, status, version_id, test_versions(project_id)")
      .eq("id", cycle_id)
      .single();

    if (cycleError || !cycle) {
      return jsonError(`Cycle not found: "${cycle_id}"`, 404);
    }

    // Extract project_id safely
    const versionData = cycle.test_versions as { project_id: string } | null;
    const projectId: string | null = versionData?.project_id ?? null;

    // ── 1. Fetch test cases for this cycle ───────────────────────────────
    const ticketIds = results.map((r) => r.ticket_id);

    const { data: testCases, error: casesError } = await supabase
      .from("test_cases")
      .select("id, ticket_id")
      .eq("cycle_id", cycle_id)
      .in("ticket_id", ticketIds);

    if (casesError) {
      throw new Error(`Test cases lookup failed: ${casesError.message}`);
    }

    // Build case lookup: ticket_id → case_id
    const caseIdByTicket = new Map<string, string>(
      (testCases ?? []).map((tc) => [tc.ticket_id, tc.id])
    );

    // ── 1b. Fetch executions for this cycle (separate query — avoids join ambiguity) ─
    const caseIds = (testCases ?? []).map((tc) => tc.id);
    const { data: execRows, error: execLookupError } = await supabase
      .from("test_executions")
      .select("id, case_id")
      .eq("cycle_id", cycle_id)
      .in("case_id", caseIds);

    if (execLookupError) {
      throw new Error(`Executions lookup failed: ${execLookupError.message}`);
    }

    // Build lookup map: ticket_id → { caseId, executionId }
    type CaseRef = { caseId: string; executionId: string | null };
    const execIdByCaseId = new Map<string, string>(
      (execRows ?? []).map((e) => [e.case_id, e.id])
    );
    const caseMap = new Map<string, CaseRef>();
    for (const [ticketId, caseId] of caseIdByTicket.entries()) {
      caseMap.set(ticketId, { caseId, executionId: execIdByCaseId.get(caseId) ?? null });
    }

    // ── 2. Update or insert executions ───────────────────────────────────
    const missingTickets: string[] = [];
    const auditEntries: object[] = [];
    let updatedCount = 0;

    for (const result of results) {
      const ref = caseMap.get(result.ticket_id);
      if (!ref) {
        missingTickets.push(result.ticket_id);
        continue;
      }

      if (ref.executionId) {
        // UPDATE existing execution by its PK — no UNIQUE constraint needed
        const { error: updateError } = await supabase
          .from("test_executions")
          .update({
            status: result.status,
            observation: result.observation ?? null,
          })
          .eq("id", ref.executionId);

        if (updateError) {
          throw new Error(
            `Execution update failed for ${result.ticket_id}: ${updateError.message}`,
          );
        }
      } else {
        // INSERT new execution (case was created without one — edge case)
        const { error: insertError } = await supabase
          .from("test_executions")
          .insert({
            case_id: ref.caseId,
            cycle_id: cycle_id,
            status: result.status,
            observation: result.observation ?? null,
          });

        if (insertError) {
          throw new Error(
            `Execution insert failed for ${result.ticket_id}: ${insertError.message}`,
          );
        }
      }

      updatedCount++;

      if (projectId) {
        auditEntries.push({
          project_id: projectId,
          user_email: reported_by,
          action: "UPDATE",
          entity_type: "EXECUTION",
          entity_id: ref.caseId,
          details: {
            cycle_id,
            ticket_id: result.ticket_id,
            status: result.status,
            observation: result.observation ?? null,
          },
        });
      }
    }

    // ── 3. Compute new cycle status ───────────────────────────────────────
    const { data: allExecutions, error: execFetchError } = await supabase
      .from("test_executions")
      .select("status")
      .eq("cycle_id", cycle_id);

    if (execFetchError) {
      throw new Error(`Executions fetch failed: ${execFetchError.message}`);
    }

    const statuses = (allExecutions ?? []).map((e) => e.status as string);
    const newCycleStatus = computeCycleStatus(statuses);

    // ── 4. Update cycle status ────────────────────────────────────────────
    const { error: cycleUpdateError } = await supabase
      .from("test_cycles")
      .update({ status: newCycleStatus })
      .eq("id", cycle_id);

    if (cycleUpdateError) {
      throw new Error(`Cycle status update failed: ${cycleUpdateError.message}`);
    }

    // ── 5. Insert audit logs ──────────────────────────────────────────────
    if (auditEntries.length > 0) {
      const { error: auditError } = await supabase
        .from("audit_logs")
        .insert(auditEntries);

      if (auditError) {
        // Non-fatal
        console.warn("Audit log insertion failed:", auditError.message);
      }
    }

    // ── Response ──────────────────────────────────────────────────────────
    const responseBody: Record<string, unknown> = {
      success: true,
      updated: updatedCount,
      cycle_status: newCycleStatus,
      matrix_url: `${QA_HUB_BASE_URL}/#/cycles/${cycle_id}`,
    };

    if (missingTickets.length > 0) {
      responseBody.warnings = {
        missing_tickets: missingTickets,
        message: "Some ticket_ids were not found in this cycle and were skipped.",
      };
    }

    return jsonResponse(responseBody, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[agent-report-results] Error:", message);
    return jsonError(message, 500);
  }
});

// ── Business logic: cycle status derivation ────────────────────────────────

function computeCycleStatus(statuses: string[]): string {
  if (statuses.length === 0) return "IN_PROGRESS";

  const hasFail = statuses.includes("FAIL");
  const hasPending = statuses.includes("PENDING");
  const hasBlocked = statuses.includes("BLOCKED");
  const allPass = statuses.every((s) => s === "PASS" || s === "SKIP");

  if (hasFail) return "FAILED";
  if (allPass) return "PASSED";
  if (hasPending || hasBlocked) return "IN_PROGRESS";

  return "IN_PROGRESS";
}

// ── Helpers ────────────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number): Response {
  return jsonResponse({ success: false, error: message }, status);
}
