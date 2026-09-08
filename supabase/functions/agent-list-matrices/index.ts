// agent-list-matrices
// Supabase Edge Function — Deno/TypeScript
// Returns all QA cycles and personal matrices accessible to a given QA email.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-api-key, x-client-info, apikey",
};

const QA_HUB_BASE_URL =
  Deno.env.get("QA_HUB_BASE_URL") ?? "https://qa-hub-qvnt-jade.vercel.app";

// ── Types ───────────────────────────────────────────────────────────────────

interface ListMatricesPayload {
  qa_email: string;
}

interface CycleSummary {
  cycle_id: string;
  cycle_type: string;
  version: string;
  status: string;
  project_name: string;
  matrix_url: string;
  summary: Record<string, number>;
  created_at: string;
}

interface MySpaceEntry {
  ticket_id: string;
  version_num: number;
  stage: string;
  matrix_url: string;
  summary: Record<string, number>;
  updated_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Count statuses from test_executions rows
function summarizeExecutions(
  executions: Array<{ status: string }>
): Record<string, number> {
  const summary: Record<string, number> = {
    PASS: 0,
    FAIL: 0,
    BLOCKED: 0,
    PENDING: 0,
  };
  for (const e of executions) {
    const s = e.status?.toUpperCase();
    if (s in summary) summary[s]++;
    else summary["PENDING"]++;
  }
  return summary;
}

// Count statuses from matrix_data.rows cells
function summarizeMatrixRows(
  rows: Array<{ cells: Record<string, string> }>
): Record<string, number> {
  const summary: Record<string, number> = {
    PASS: 0,
    FAIL: 0,
    BLOCKED: 0,
    PENDING: 0,
  };
  for (const row of rows ?? []) {
    const status = (row.cells?.status ?? "PENDING").toUpperCase();
    if (status in summary) summary[status]++;
    else summary["PENDING"]++;
  }
  return summary;
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  // Auth
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("AGENT_API_KEY");
  if (!expectedKey) return jsonError("Server misconfiguration", 500);
  if (!apiKey || apiKey !== expectedKey)
    return jsonError("Unauthorized: invalid or missing x-api-key", 401);

  // Parse body
  let payload: ListMatricesPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { qa_email } = payload;
  if (!qa_email) return jsonError("Missing required field: qa_email", 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey)
    return jsonError("Server misconfiguration: Supabase env vars not set", 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    // ── 1. Verify QA exists ──────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("email", qa_email)
      .maybeSingle();

    if (!profile) return jsonError(`User not found: ${qa_email}`, 404);
    if (profile.active === false)
      return jsonError(`Account ${qa_email} is deactivated`, 403);

    // ── 2. Get projects accessible to this QA ────────────────────────────────
    // ADMIN and QA_LEAD have access to ALL projects (no user_projects rows).
    // QA_TESTER has explicit project assignments in user_projects.
    const isAdminOrLead = profile.role === "ADMIN" || profile.role === "QA_LEAD";

    const projectIds: string[] = [];
    const projectNameMap: Record<string, string> = {};

    if (isAdminOrLead) {
      // Fetch all projects directly
      const { data: allProjects } = await supabase
        .from("projects")
        .select("id, name")
        .order("name");

      for (const proj of allProjects ?? []) {
        projectIds.push(proj.id);
        projectNameMap[proj.id] = proj.name;
      }
    } else {
      // QA_TESTER: only explicitly assigned projects
      const { data: userProjects } = await supabase
        .from("user_projects")
        .select("project_id, projects(id, name)")
        .eq("user_email", qa_email);

      for (const up of userProjects ?? []) {
        const proj = (up as any).projects;
        if (proj) {
          projectIds.push(proj.id);
          projectNameMap[proj.id] = proj.name;
        }
      }
    }

    // ── 3. Fetch cycles for accessible projects ──────────────────────────────
    const cycles: CycleSummary[] = [];

    if (projectIds.length > 0) {
      const { data: rawCycles } = await supabase
        .from("test_cycles")
        .select("id, type, version, status, project_id, created_at")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
        .limit(20);

      for (const c of rawCycles ?? []) {
        // Get execution summary for this cycle
        const { data: execs } = await supabase
          .from("test_executions")
          .select("status")
          .eq("cycle_id", c.id);

        cycles.push({
          cycle_id: c.id,
          cycle_type: c.type,
          version: c.version,
          status: c.status,
          project_name: projectNameMap[c.project_id] ?? "—",
          matrix_url: `${QA_HUB_BASE_URL}/#/cycles/${c.id}`,
          summary: summarizeExecutions(execs ?? []),
          created_at: c.created_at,
        });
      }
    }

    // ── 4. Fetch Mi Espacio matrices for this QA ─────────────────────────────
    const mySpace: MySpaceEntry[] = [];

    const { data: folders } = await supabase
      .from("personal_matrix_folders")
      .select("ticket_id, personal_matrix_versions(version_num, stage, matrix_data, public_uuid, updated_at)")
      .eq("qa_email", qa_email)
      .order("updated_at", { ascending: false, referencedTable: "personal_matrix_versions" })
      .limit(15);

    for (const folder of folders ?? []) {
      const versions = (folder as any).personal_matrix_versions ?? [];
      if (versions.length === 0) continue;

      // Get the most recent version
      const latest = versions.sort(
        (a: any, b: any) => b.version_num - a.version_num
      )[0];

      const rows = latest.matrix_data?.rows ?? [];
      const publicUuid = latest.public_uuid;

      mySpace.push({
        ticket_id: folder.ticket_id,
        version_num: latest.version_num,
        stage: latest.stage ?? "—",
        matrix_url: publicUuid
          ? `${QA_HUB_BASE_URL}/#/m/${publicUuid}`
          : `${QA_HUB_BASE_URL}/#/my-space`,
        summary: summarizeMatrixRows(rows),
        updated_at: latest.updated_at,
      });
    }

    // ── 5. Return ────────────────────────────────────────────────────────────
    return jsonOk({
      qa_email,
      cycles,
      my_space: mySpace,
      total: {
        cycles: cycles.length,
        my_space: mySpace.length,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("agent-list-matrices error:", message);
    return jsonError(`Internal error: ${message}`, 500);
  }
});
