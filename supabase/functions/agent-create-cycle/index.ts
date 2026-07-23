// agent-create-cycle
// Supabase Edge Function — Deno/TypeScript
// Creates a new QA cycle with test cases and initial executions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-api-key, x-client-info, apikey",
};

const QA_HUB_BASE_URL = "https://qa-hub-qvnt-jade.vercel.app";

// ── Types ──────────────────────────────────────────────────────────────────

interface TestCaseInput {
  ticket_id: string;
  title: string;
  module?: string;
  expected_result?: string;
}

interface CreateCyclePayload {
  project_name: string;
  version: string;
  cycle_type: string;
  test_cases: TestCaseInput[];
  created_by: string;
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
  let payload: CreateCyclePayload;
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { project_name, version, cycle_type, test_cases, created_by } = payload;

  if (!project_name || !version || !cycle_type || !created_by) {
    return jsonError(
      "Missing required fields: project_name, version, cycle_type, created_by",
      400,
    );
  }
  if (!Array.isArray(test_cases) || test_cases.length === 0) {
    return jsonError("test_cases must be a non-empty array", 400);
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
    // ── 1. Find project (case-insensitive) ────────────────────────────────
    const { data: projects, error: projectError } = await supabase
      .from("projects")
      .select("id, name")
      .ilike("name", project_name)
      .limit(1);

    if (projectError) throw new Error(`Project lookup failed: ${projectError.message}`);
    if (!projects || projects.length === 0) {
      return jsonError(`Project not found: "${project_name}"`, 404);
    }

    const project = projects[0];

    // ── 2. Find or create version ─────────────────────────────────────────
    const { data: existingVersions, error: versionLookupError } = await supabase
      .from("test_versions")
      .select("id, name")
      .eq("project_id", project.id)
      .eq("name", version)
      .limit(1);

    if (versionLookupError) {
      throw new Error(`Version lookup failed: ${versionLookupError.message}`);
    }

    let versionId: string;

    if (existingVersions && existingVersions.length > 0) {
      versionId = existingVersions[0].id;
    } else {
      const { data: newVersion, error: versionCreateError } = await supabase
        .from("test_versions")
        .insert({ project_id: project.id, name: version })
        .select("id")
        .single();

      if (versionCreateError || !newVersion) {
        throw new Error(
          `Version creation failed: ${versionCreateError?.message ?? "no data returned"}`,
        );
      }
      versionId = newVersion.id;
    }

    // ── 3. Create cycle ───────────────────────────────────────────────────
    const { data: cycle, error: cycleError } = await supabase
      .from("test_cycles")
      .insert({
        version_id: versionId,
        type: cycle_type,
        status: "IN_PROGRESS",
      })
      .select("id")
      .single();

    if (cycleError || !cycle) {
      throw new Error(
        `Cycle creation failed: ${cycleError?.message ?? "no data returned"}`,
      );
    }

    const cycleId: string = cycle.id;

    // ── 4. Insert test cases ──────────────────────────────────────────────
    const casesToInsert = test_cases.map((tc, idx) => ({
      cycle_id: cycleId,
      ticket_id: tc.ticket_id,
      title: tc.title,
      module: tc.module ?? null,
      expected_result: tc.expected_result ?? null,
      sort_order: idx + 1,
    }));

    const { data: insertedCases, error: casesError } = await supabase
      .from("test_cases")
      .insert(casesToInsert)
      .select("id, ticket_id");

    if (casesError || !insertedCases) {
      throw new Error(
        `Test cases insertion failed: ${casesError?.message ?? "no data returned"}`,
      );
    }

    // ── 5. Create initial executions ──────────────────────────────────────
    const executionsToInsert = insertedCases.map((c) => ({
      case_id: c.id,
      cycle_id: cycleId,
      status: "PENDING",
    }));

    const { error: executionsError } = await supabase
      .from("test_executions")
      .insert(executionsToInsert);

    if (executionsError) {
      throw new Error(`Executions creation failed: ${executionsError.message}`);
    }

    // ── 6. Audit log ──────────────────────────────────────────────────────
    const { error: auditError } = await supabase.from("audit_logs").insert({
      project_id: project.id,
      user_email: created_by,
      action: "NEW",
      entity: "CYCLE",
      entity_id: cycleId,
      details: {
        project_name: project.name,
        version,
        cycle_type,
        cases_created: insertedCases.length,
      },
    });

    if (auditError) {
      // Non-fatal: log the warning but don't fail the request
      console.warn("Audit log insertion failed:", auditError.message);
    }

    // ── Response ──────────────────────────────────────────────────────────
    return jsonResponse(
      {
        success: true,
        cycle_id: cycleId,
        version_id: versionId,
        matrix_url: `${QA_HUB_BASE_URL}/#/cycles/${cycleId}`,
        cases_created: insertedCases.length,
      },
      201,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[agent-create-cycle] Error:", message);
    return jsonError(message, 500);
  }
});

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
