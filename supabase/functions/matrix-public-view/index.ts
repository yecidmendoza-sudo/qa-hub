// matrix-public-view
// Supabase Edge Function — Deno/TypeScript
// Public endpoint: returns a matrix version by its public_uuid (no auth required).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-api-key, x-client-info, apikey",
};

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return jsonError("Method not allowed", 405);
  }

  // ── Parse query param ────────────────────────────────────────────────────
  const url = new URL(req.url);
  const uuid = url.searchParams.get("uuid");

  if (!uuid) {
    return jsonError("Missing required query param: uuid", 400);
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
    // ── Query: join versions + folders by public_uuid ─────────────────────
    const { data: version, error: queryError } = await supabase
      .from("personal_matrix_versions")
      .select(
        `
        id,
        version_num,
        stage,
        matrix_type,
        content_md,
        fixtures_json,
        notes,
        created_at,
        personal_matrix_folders (
          ticket_id,
          project_name,
          qa_email
        )
      `,
      )
      .eq("public_uuid", uuid)
      .single();

    if (queryError || !version) {
      return jsonError(`Matrix not found for uuid: "${uuid}"`, 404);
    }

    // Flatten the joined folder fields for a clean response shape
    const folder = version.personal_matrix_folders as {
      ticket_id: string;
      project_name: string;
      qa_email: string;
    } | null;

    return jsonResponse({
      success: true,
      data: {
        id: version.id,
        version_num: version.version_num,
        stage: version.stage,
        matrix_type: version.matrix_type,
        content_md: version.content_md,
        fixtures_json: version.fixtures_json,
        notes: version.notes,
        created_at: version.created_at,
        ticket_id: folder?.ticket_id ?? null,
        project_name: folder?.project_name ?? null,
        qa_email: folder?.qa_email ?? null,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[matrix-public-view] Error:", message);
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
