// cycle-public-view
// Supabase Edge Function — Deno/TypeScript
// Returns a full cycle (test_cases + executions) publicly without requiring login.
// Used by the /#/cycles/public/:id frontend route.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-api-key, x-client-info, apikey",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return jsonError("Method not allowed", 405);
  }

  const url = new URL(req.url);
  const cycleId = url.searchParams.get("cycle_id");

  if (!cycleId) {
    return jsonError("Missing required query param: cycle_id", 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonError("Server misconfiguration", 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    // 1. Fetch cycle
    const { data: cycle, error: cycleError } = await supabase
      .from("test_cycles")
      .select("id, type, version, status, custom_columns, created_at")
      .eq("id", cycleId)
      .single();

    if (cycleError || !cycle) {
      return jsonError("Cycle not found", 404);
    }

    // 2. Fetch test cases
    const { data: cases, error: casesError } = await supabase
      .from("test_cases")
      .select("id, ticket_id, title, module, expected_result, custom_data")
      .eq("cycle_id", cycleId)
      .order("created_at", { ascending: true });

    if (casesError) throw new Error(`Cases fetch failed: ${casesError.message}`);

    // 3. Fetch executions
    const caseIds = (cases ?? []).map((c) => c.id);
    const { data: executions, error: execError } = await supabase
      .from("test_executions")
      .select("id, case_id, status, observation")
      .in("case_id", caseIds);

    if (execError) throw new Error(`Executions fetch failed: ${execError.message}`);

    // 4. Build execution map: case_id -> execution
    const execByCaseId = new Map(
      (executions ?? []).map((e) => [e.case_id, e])
    );

    // 5. Sort cases by sort_order (same logic as matrixService.ts)
    const sortedCases = (cases ?? [])
      .map((c) => ({
        ...c,
        execution: execByCaseId.get(c.id) ?? { id: null, status: "PENDING", observation: null },
      }))
      .sort((a, b) => {
        const soA = a.custom_data?.sort_order;
        const soB = b.custom_data?.sort_order;
        if (soA !== undefined && soB !== undefined) {
          return parseInt(soA, 10) - parseInt(soB, 10);
        }
        const numA = parseInt((a.ticket_id ?? "").replace(/\D/g, "") || "0", 10);
        const numB = parseInt((b.ticket_id ?? "").replace(/\D/g, "") || "0", 10);
        return numA - numB;
      });

    // 6. Status summary
    const statusCounts: Record<string, number> = { PASS: 0, FAIL: 0, BLOCKED: 0, PENDING: 0 };
    for (const c of sortedCases) {
      const s = c.execution.status || "PENDING";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }
    const total = sortedCases.length;
    const completed = (statusCounts.PASS || 0) + (statusCounts.FAIL || 0);
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return jsonResponse({
      success: true,
      data: {
        cycle: {
          id: cycle.id,
          type: cycle.type,
          version: cycle.version,
          status: cycle.status,
          custom_columns: cycle.custom_columns ?? [],
          created_at: cycle.created_at,
        },
        cases: sortedCases,
        summary: { total, completed, percentage, ...statusCounts },
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cycle-public-view] Error:", message);
    return jsonError(message, 500);
  }
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number): Response {
  return jsonResponse({ success: false, error: message }, status);
}
