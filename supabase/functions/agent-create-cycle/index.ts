// agent-create-cycle
// Supabase Edge Function — Deno/TypeScript
// Creates a new QA cycle with test cases, initial executions, and flexible extra columns.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-api-key, x-client-info, apikey",
};

const QA_HUB_BASE_URL = Deno.env.get("QA_HUB_BASE_URL") ?? "https://qa-hub-qvnt-jade.vercel.app";

// ── Types ──────────────────────────────────────────────────────────────────

interface ExtraColumn {
  id: string;           // stable key used in custom_data (e.g. "actual_result")
  name: string;         // display name (e.g. "Resultado Actual")
  type: "text" | "dropdown";
  options?: string[];   // only for dropdown
}

interface TestCaseInput {
  ticket_id: string;
  title: string;
  module?: string;
  expected_result?: string;
  qa_reviewer?: string;            // QA who reviewed/executed this case
  // Flexible extra fields — keyed by ExtraColumn.id
  custom_data?: Record<string, string>;
}

interface CreateCyclePayload {
  project_name: string;
  version: string;
  cycle_type: string;
  test_cases: TestCaseInput[];
  created_by: string;
  // Optional: define extra columns to show in Matrix view
  extra_columns?: ExtraColumn[];
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

  const { project_name, version, cycle_type, test_cases, created_by, extra_columns } = payload;

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
    // ── 0. Verify caller role (ADMIN or QA_LEAD only) + active status ────────
    const { data: callerProfile, error: roleError } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("email", created_by)
      .maybeSingle();

    if (roleError) throw new Error(`Role lookup failed: ${roleError.message}`);
    if (!callerProfile) {
      return jsonError(`User not found: ${created_by}`, 404);
    }
    if (callerProfile.active === false) {
      return jsonError(
        `La cuenta "${created_by}" está desactivada. Contacta a tu admin para reactivarla.`,
        403,
      );
    }
    if (!['ADMIN', 'QA_LEAD'].includes(callerProfile.role)) {
      return jsonError(
        `Permission denied: only ADMIN or QA_LEAD can create test cycles. Current role: ${callerProfile.role}`,
        403
      );
    }

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

    // ── 3. Build custom_columns array for the cycle ───────────────────────
    // Normalize extra_columns: ensure each has a stable id
    const resolvedExtraColumns: ExtraColumn[] = (extra_columns ?? []).map((col) => ({
      id: col.id,
      name: col.name,
      type: col.type ?? "text",
      options: col.options ?? [],
    }));

    // ── 4. Create cycle ───────────────────────────────────────────────────
    const { data: cycle, error: cycleError } = await supabase
      .from("test_cycles")
      .insert({
        version_id: versionId,
        project_id: project.id,
        version: version,
        type: cycle_type,
        status: "IN_PROGRESS",
        custom_values: {},
        // Store extra column definitions so Matrix.tsx renders them automatically
        custom_columns: resolvedExtraColumns,
      })
      .select("id")
      .single();

    if (cycleError || !cycle) {
      throw new Error(
        `Cycle creation failed: ${cycleError?.message ?? "no data returned"}`,
      );
    }

    const cycleId: string = cycle.id;

    // ── 5. Insert test cases (with custom_data for flexible columns) ───────
    const casesToInsert = test_cases.map((tc) => ({
      cycle_id: cycleId,
      ticket_id: tc.ticket_id,
      module: tc.module ?? "",
      title: tc.title,
      expected_result: tc.expected_result ?? "",
      // Merge qa_reviewer into custom_data so it renders in the QA Reviewer column
      custom_data: {
        ...(tc.custom_data ?? {}),
        ...(tc.qa_reviewer ? { qa_reviewer: tc.qa_reviewer } : {}),
      },
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

    // ── 6. Create initial executions (all PENDING) ─────────────────────────
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

    // ── 7. Audit log ──────────────────────────────────────────────────────
    const { error: auditError } = await supabase.from("audit_logs").insert({
      project_id: project.id,
      user_email: created_by,
      action: "NEW",
      entity_type: "CYCLE",
      entity_id: cycleId,
      details: {
        project_name: project.name,
        version,
        cycle_type,
        cases_created: insertedCases.length,
        extra_columns: resolvedExtraColumns.map((c) => c.name),
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
        extra_columns_created: resolvedExtraColumns.length,
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
