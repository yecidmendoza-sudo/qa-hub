// agent-update-matrix-status
// Supabase Edge Function — Deno/TypeScript
// PATCH status values inside personal_matrix_versions.matrix_data JSONB
// without creating a new version. Regenerates content_md to stay in sync.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-api-key, x-client-info, apikey",
};

const QA_HUB_BASE_URL =
  Deno.env.get("QA_HUB_BASE_URL") ?? "https://qa-hub-qvnt-jade.vercel.app";

const VALID_STATUSES = ["PASS", "FAIL", "BLOCKED", "PENDING"] as const;
type StatusValue = (typeof VALID_STATUSES)[number];

interface RowUpdate {
  row_id: string;
  status: StatusValue;
  observation?: string | null;
}

interface UpdateMatrixStatusPayload {
  qa_email: string;
  ticket_id: string;
  updates: RowUpdate[];
  version_num?: number | null;
}

interface MatrixCol {
  id: string;
  name: string;
  type: "text" | "dropdown" | "status";
}

interface MatrixRow {
  id: string;
  cells: Record<string, string>;
  observations?: Record<string, string>;
}

interface MatrixSection {
  id: string;
  title: string;
  columns: MatrixCol[];
  rows: MatrixRow[];
}

// Supports both new { sections } format and legacy { columns, rows } format
type RawMatrixData = {
  sections?: MatrixSection[];
  columns?: MatrixCol[];
  rows?: MatrixRow[];
} | null;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("AGENT_API_KEY");
  if (!expectedKey) return jsonError("Server misconfiguration: AGENT_API_KEY not set", 500);
  if (!apiKey || apiKey !== expectedKey) return jsonError("Unauthorized: invalid or missing x-api-key", 401);

  let payload: UpdateMatrixStatusPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { qa_email, ticket_id, updates, version_num = null } = payload;

  if (!qa_email || !ticket_id) return jsonError("Missing required fields: qa_email, ticket_id", 400);
  if (!Array.isArray(updates) || updates.length === 0) return jsonError("updates must be a non-empty array", 400);

  for (const u of updates) {
    if (!u.row_id) return jsonError(`Missing row_id in update: ${JSON.stringify(u)}`, 400);
    if (!(VALID_STATUSES as readonly string[]).includes(u.status)) {
      return jsonError(`Invalid status "${u.status}" for row "${u.row_id}". Allowed: ${VALID_STATUSES.join(", ")}`, 400);
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonError("Server misconfiguration: Supabase env vars not set", 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    // 0. Verify QA identity
    const { data: qaProfile } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("email", qa_email.toLowerCase().trim())
      .maybeSingle();

    if (!qaProfile) return jsonError(`El email "${qa_email}" no está registrado en QA Hub.`, 403);
    if (qaProfile.active === false) return jsonError(`La cuenta "${qa_email}" está desactivada.`, 403);

    // 1. Find folder
    const { data: folder, error: folderErr } = await supabase
      .from("personal_matrix_folders")
      .select("id, ticket_id, project_name")
      .eq("qa_email", qa_email.toLowerCase().trim())
      .eq("ticket_id", ticket_id)
      .maybeSingle();

    if (folderErr) throw new Error(`Folder lookup failed: ${folderErr.message}`);
    if (!folder) return jsonError(`No se encontró matriz para ticket "${ticket_id}" del QA "${qa_email}".`, 404);

    // 2. Find target version
    let versionQuery = supabase
      .from("personal_matrix_versions")
      .select("id, version_num, matrix_data, content_md, stage, matrix_type, public_uuid")
      .eq("folder_id", folder.id);

    if (version_num != null) {
      versionQuery = versionQuery.eq("version_num", version_num);
    } else {
      versionQuery = versionQuery.order("version_num", { ascending: false }).limit(1);
    }

    const { data: versions, error: vErr } = await versionQuery;
    if (vErr) throw new Error(`Version lookup failed: ${vErr.message}`);
    if (!versions || versions.length === 0) {
      return jsonError(
        version_num != null
          ? `No se encontró la versión ${version_num} del ticket "${ticket_id}".`
          : `El ticket "${ticket_id}" no tiene versiones publicadas.`,
        404,
      );
    }

    const version = versions[0];

    // 3. Normalize matrix_data to sections format (supports both old and new format)
    const raw = version.matrix_data as RawMatrixData;
    let sections: MatrixSection[] = toSections(raw, version.content_md ?? "");

    if (sections.length === 0) {
      return jsonError(`La matriz del ticket "${ticket_id}" no tiene datos.`, 422);
    }

    // Find status column from first section (status col is shared across sections)
    const statusColIds = sections[0].columns
      .filter((c) => c.type === "status")
      .map((c) => c.id);
    if (statusColIds.length === 0) {
      return jsonError(`La matriz del ticket "${ticket_id}" no tiene columnas de tipo "status".`, 422);
    }
    const primaryStatusColId = statusColIds[0];

    // Build row map across ALL sections { row_id → { sectionIdx, rowIdx } }
    const rowMap = new Map<string, { si: number; ri: number }>();
    sections.forEach((sec, si) =>
      sec.rows.forEach((row, ri) => rowMap.set(row.id, { si, ri }))
    );

    const applied: { row_id: string; old_status: string; new_status: string }[] = [];
    const notFound: string[] = [];

    for (const u of updates) {
      const loc = rowMap.get(u.row_id);
      if (!loc) { notFound.push(u.row_id); continue; }

      const row = sections[loc.si].rows[loc.ri];
      const oldStatus = row.cells[primaryStatusColId] ?? "PENDING";
      row.cells[primaryStatusColId] = u.status;

      if (u.observation) {
        if (!row.observations) row.observations = {};
        row.observations[primaryStatusColId] = u.observation;
      }

      applied.push({ row_id: u.row_id, old_status: oldStatus, new_status: u.status });
    }

    if (applied.length === 0) {
      return jsonError(`Ningún row_id coincidió. IDs no encontrados: ${notFound.join(", ")}`, 404);
    }

    // 4. Regenerate content_md from updated sections
    const newContentMd = serializeSectionsToMarkdown(sections, ticket_id);

    // 5. Persist — always save in { sections } format for consistency
    const { error: updateErr } = await supabase
      .from("personal_matrix_versions")
      .update({ matrix_data: { sections }, content_md: newContentMd })
      .eq("id", version.id);

    if (updateErr) throw new Error(`Version update failed: ${updateErr.message}`);

    // 6. Summary — flatten rows from all sections
    const allRows = sections.flatMap((s) => s.rows);
    const statusCounts: Record<string, number> = { PASS: 0, FAIL: 0, BLOCKED: 0, PENDING: 0 };
    for (const row of allRows) {
      const s = row.cells[primaryStatusColId] ?? "PENDING";
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    }

    return jsonResponse({
      success: true,
      version_id: version.id,
      version_num: version.version_num,
      public_uuid: version.public_uuid,
      matrix_url: `${QA_HUB_BASE_URL}/#/m/${version.public_uuid}`,
      applied: applied.length,
      skipped: notFound.length,
      ...(notFound.length > 0 ? { not_found_row_ids: notFound } : {}),
      summary: statusCounts,
    }, 200);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[agent-update-matrix-status] Error:", message);
    return jsonError(message, 500);
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COL_NAMES = new Set(["estado", "status", "state"]);

function cleanStatusValue(val: string): string {
  const v = val.trim();
  if (v.includes("PASS") || v === "✅") return "PASS";
  if (v.includes("FAIL") || v === "❌") return "FAIL";
  if (v.includes("BLOCKED") || v === "🚫") return "BLOCKED";
  return "PENDING";
}

/** Parse markdown into a single section (legacy fallback). */
function parseMarkdownToSection(contentMd: string): MatrixSection {
  const lines = contentMd.split("\n");
  const tableLines: string[] = [];
  let inTable = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) { inTable = true; tableLines.push(trimmed); }
    else if (inTable) break;
  }

  if (tableLines.length < 2) {
    return { id: "section_0", title: "", columns: [{ id: "col_0", name: "Descripción", type: "text" }], rows: [] };
  }

  const headerCells = tableLines[0].split("|").map((s) => s.trim()).filter(Boolean);
  const columns: MatrixCol[] = headerCells.map((name, i) => ({
    id: `col_${i}`,
    name,
    type: STATUS_COL_NAMES.has(name.toLowerCase()) ? "status" : "text",
  }));

  const rows: MatrixRow[] = [];
  for (let i = 2; i < tableLines.length; i++) {
    const cells = tableLines[i].split("|").map((s) => s.trim()).filter(Boolean);
    const rowCells: Record<string, string> = {};
    columns.forEach((col, ci) => {
      let val = cells[ci] ?? "";
      if (col.type === "status") val = cleanStatusValue(val);
      rowCells[col.id] = val;
    });
    rows.push({ id: `row_${i - 2}`, cells: rowCells });
  }
  return { id: "section_0", title: "", columns, rows };
}

/**
 * Normalize any stored matrix_data format to sections array.
 * Handles: { sections } (new), { columns, rows } (legacy), null (parse markdown).
 */
function toSections(raw: RawMatrixData, fallbackMd: string): MatrixSection[] {
  if (Array.isArray(raw?.sections) && raw!.sections!.length > 0) {
    return raw!.sections!;
  }
  if (Array.isArray(raw?.columns) && Array.isArray(raw?.rows)) {
    return [{ id: "section_0", title: "", columns: raw!.columns!, rows: raw!.rows! }];
  }
  // Fallback: parse markdown (should be rare after migration)
  const sec = parseMarkdownToSection(fallbackMd);
  return sec.columns.length > 0 ? [sec] : [];
}

/** Serialize sections to markdown (keeps content_md in sync). */
function serializeSectionsToMarkdown(sections: MatrixSection[], ticketId: string): string {
  const parts: string[] = [`# Matriz — ${ticketId}`, ""];
  for (const sec of sections) {
    if (sec.title) { parts.push(`### ${sec.title}`, ""); }
    parts.push(`| ${sec.columns.map((c) => c.name).join(" | ")} |`);
    parts.push(`| ${sec.columns.map(() => "---").join(" | ")} |`);
    for (const row of sec.rows) {
      parts.push(`| ${sec.columns.map((col) => row.cells[col.id] ?? "").join(" | ")} |`);
    }
    parts.push("");
  }
  return parts.join("\n").trim();
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number): Response {
  return jsonResponse({ success: false, error: message }, status);
}
