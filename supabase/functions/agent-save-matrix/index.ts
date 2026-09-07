// agent-save-matrix
// Supabase Edge Function — Deno/TypeScript
// Saves a test matrix version into personal_matrix_folders / personal_matrix_versions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-api-key, x-client-info, apikey",
};

const QA_HUB_BASE_URL = Deno.env.get("QA_HUB_BASE_URL") ?? "https://qa-hub-qvnt-jade.vercel.app";

const VALID_STAGES = ["PRE-DEV", "POST-DEV"] as const;
const VALID_MATRIX_TYPES = ["UI", "API", "MIXED"] as const;

// ── Types ──────────────────────────────────────────────────────────────────

type Stage = typeof VALID_STAGES[number];
type MatrixType = typeof VALID_MATRIX_TYPES[number];

interface SaveMatrixPayload {
  qa_email: string;
  ticket_id: string;
  project_name: string;
  stage: Stage;
  matrix_type: MatrixType;
  content_md: string;
  fixtures_json?: unknown;
  notes?: string | null;
}

// ── Multi-section Markdown Parser ──────────────────────────────────────────

interface MatrixCol {
  id: string;
  name: string;
  type: "text" | "status";
}

interface MatrixRow {
  id: string;
  cells: Record<string, string>;
}

interface MatrixSection {
  id: string;
  title: string;
  columns: MatrixCol[];
  rows: MatrixRow[];
}

const STATUS_COL_NAMES = new Set(["estado", "status", "state"]);

function cleanStatusValue(val: string): string {
  const v = val.trim();
  if (v.includes("PASS") || v === "✅") return "PASS";
  if (v.includes("FAIL") || v === "❌") return "FAIL";
  if (v.includes("BLOCKED") || v === "🚫") return "BLOCKED";
  return "PENDING";
}

/**
 * Parses ALL markdown tables into sections.
 * Associates each table with the nearest preceding ## / ### heading.
 * Does NOT stop at the first non-pipe line.
 */
function parseMarkdownToSections(contentMd: string): { sections: MatrixSection[] } {
  const lines = contentMd.split("\n");
  const sections: MatrixSection[] = [];
  let currentHeading = "";
  let tableBuffer: string[] = [];
  let inTable = false;

  const flushTable = (heading: string, buf: string[]) => {
    if (buf.length < 2) return;
    const headerCells = buf[0].split("|").map((s) => s.trim()).filter(Boolean);
    const columns: MatrixCol[] = headerCells.map((name, i) => ({
      id: `col_${i}`,
      name,
      type: STATUS_COL_NAMES.has(name.toLowerCase()) ? "status" : "text",
    }));
    const rows: MatrixRow[] = [];
    for (let ri = 2; ri < buf.length; ri++) {
      const cells = buf[ri].split("|").map((s) => s.trim()).filter((s) => s !== "");
      const rowCells: Record<string, string> = {};
      columns.forEach((col, ci) => {
        let val = cells[ci] ?? "";
        if (col.type === "status") val = cleanStatusValue(val);
        rowCells[col.id] = val;
      });
      rows.push({ id: `row_${ri - 2}`, cells: rowCells });
    }
    sections.push({ id: `section_${sections.length}`, title: heading, columns, rows });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inTable && /^#{2,3}\s+/.test(trimmed)) {
      currentHeading = trimmed.replace(/^#{2,3}\s+/, "").trim();
      continue;
    }
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      inTable = true;
      tableBuffer.push(trimmed);
    } else if (inTable) {
      flushTable(currentHeading, tableBuffer);
      tableBuffer = [];
      inTable = false;
      currentHeading = "";
    }
  }
  if (inTable && tableBuffer.length > 0) flushTable(currentHeading, tableBuffer);

  if (sections.length === 0) {
    return {
      sections: [{
        id: "section_0",
        title: "",
        columns: [{ id: "col_0", name: "Descripción", type: "text" }],
        rows: [],
      }],
    };
  }
  return { sections };
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
  let payload: SaveMatrixPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const {
    qa_email,
    ticket_id,
    project_name,
    stage,
    matrix_type,
    content_md,
    fixtures_json = null,
    notes = null,
  } = payload;

  // ── Field validation ────────────────────────────────────────────────────
  if (!qa_email || !ticket_id || !project_name || !stage || !matrix_type || !content_md) {
    return jsonError(
      "Missing required fields: qa_email, ticket_id, project_name, stage, matrix_type, content_md",
      400,
    );
  }

  if (!(VALID_STAGES as readonly string[]).includes(stage)) {
    return jsonError(`Invalid stage. Must be one of: ${VALID_STAGES.join(", ")}`, 400);
  }

  if (!(VALID_MATRIX_TYPES as readonly string[]).includes(matrix_type)) {
    return jsonError(
      `Invalid matrix_type. Must be one of: ${VALID_MATRIX_TYPES.join(", ")}`,
      400,
    );
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
    // ── 0. Verify QA identity ─────────────────────────────────────────────
    const { data: qaProfile } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("email", qa_email.toLowerCase().trim())
      .maybeSingle();

    if (!qaProfile) {
      return jsonError(
        `El email "${qa_email}" no está registrado en QA Hub. Contacta a tu admin para que cree tu cuenta.`,
        403,
      );
    }
    if (qaProfile.active === false) {
      return jsonError(
        `La cuenta "${qa_email}" está desactivada. Contacta a tu admin para reactivarla.`,
        403,
      );
    }

    // ── 1. Find project (case-insensitive) ────────────────────────────────
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name")
      .ilike("name", project_name)
      .single();

    if (projectError || !project) {
      return jsonError(`Project not found: "${project_name}"`, 404);
    }

    // ── 2. Find or create personal_matrix_folders ─────────────────────────
    const { data: existingFolder, error: folderLookupError } = await supabase
      .from("personal_matrix_folders")
      .select("id")
      .eq("qa_email", qa_email)
      .eq("ticket_id", ticket_id)
      .maybeSingle();

    if (folderLookupError) {
      throw new Error(`Folder lookup failed: ${folderLookupError.message}`);
    }

    let folderId: string;

    if (existingFolder) {
      folderId = existingFolder.id;
    } else {
      const { data: newFolder, error: folderCreateError } = await supabase
        .from("personal_matrix_folders")
        .insert({
          qa_email,
          ticket_id,
          project_id: project.id,
          project_name: project.name,
        })
        .select("id")
        .single();

      if (folderCreateError || !newFolder) {
        throw new Error(
          `Folder creation failed: ${folderCreateError?.message ?? "no data returned"}`,
        );
      }
      folderId = newFolder.id;
    }

    // ── 3. Get next version_num ───────────────────────────────────────────
    const { count, error: countError } = await supabase
      .from("personal_matrix_versions")
      .select("id", { count: "exact", head: true })
      .eq("folder_id", folderId);

    if (countError) {
      throw new Error(`Version count failed: ${countError.message}`);
    }

    const versionNum = (count ?? 0) + 1;

    // ── 4. Insert version ─────────────────────────────────────────────────
    const matrixData = parseMarkdownToSections(content_md);

    const { data: inserted, error: insertError } = await supabase
      .from("personal_matrix_versions")
      .insert({
        folder_id: folderId,
        version_num: versionNum,
        stage,
        matrix_type,
        content_md,
        matrix_data: matrixData,
        fixtures_json,
        notes,
      })
      .select("id, public_uuid")
      .single();

    if (insertError || !inserted) {
      throw new Error(
        `Version insertion failed: ${insertError?.message ?? "no data returned"}`,
      );
    }

    // ── Response ──────────────────────────────────────────────────────────
    return jsonResponse(
      {
        success: true,
        folder_id: folderId,
        version_num: versionNum,
        stage,
        public_uuid: inserted.public_uuid,
        matrix_url: `${QA_HUB_BASE_URL}/#/m/${inserted.public_uuid}`,
        personal_url: `${QA_HUB_BASE_URL}/#/my-space/${ticket_id}`,
      },
      201,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[agent-save-matrix] Error:", message);
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
