// agent-check-identity
// Supabase Edge Function — Deno/TypeScript
// Validates that a QA email is registered in QA Hub and returns their role + capabilities.
// Called by Gideon skills at setup time and optionally on every run.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-api-key, x-client-info, apikey",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  // ── API Key auth ──────────────────────────────────────────────────────────
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("AGENT_API_KEY");

  if (!expectedKey) return jsonError("Server misconfiguration: AGENT_API_KEY not set", 500);
  if (!apiKey || apiKey !== expectedKey) return jsonError("Unauthorized: invalid or missing x-api-key", 401);

  // ── Parse body ────────────────────────────────────────────────────────────
  let payload: { qa_email: string };
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { qa_email } = payload;

  if (!qa_email || !qa_email.includes("@")) {
    return jsonError("Missing or invalid qa_email", 400);
  }

  // ── Supabase client ───────────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonError("Server misconfiguration: Supabase env vars not set", 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    // Look up the profile by email
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, email")
      .eq("email", qa_email.toLowerCase().trim())
      .maybeSingle();

    if (!profile) {
      return jsonResponse({
        success: false,
        exists: false,
        error: `El email "${qa_email}" no está registrado en QA Hub. Pídele al admin que cree tu cuenta primero.`,
      }, 404);
    }

    if (profile.active === false) {
      return jsonResponse({
        success: false,
        exists: true,
        active: false,
        error: `La cuenta "${qa_email}" está desactivada. Contacta a tu admin para reactivarla.`,
      }, 403);
    }

    const role = profile.role as string;

    // Compute capabilities per role
    const canCreateCycles = ["ADMIN", "QA_LEAD"].includes(role);
    const canSaveMatrices = ["ADMIN", "QA_LEAD", "QA_TESTER"].includes(role);
    const canReportResults = ["ADMIN", "QA_LEAD", "QA_TESTER"].includes(role);
    const canManageUsers = role === "ADMIN";

    return jsonResponse({
      success: true,
      exists: true,
      email: profile.email,
      role,
      capabilities: {
        can_create_cycles: canCreateCycles,
        can_save_matrices: canSaveMatrices,
        can_report_results: canReportResults,
        can_manage_users: canManageUsers,
      },
      role_description:
        role === "ADMIN"
          ? "Administrador — acceso completo"
          : role === "QA_LEAD"
          ? "QA Lead (Scrum Master) — puede crear ciclos y ver equipo"
          : "QA Tester — puede guardar matrices y reportar resultados",
    }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[agent-check-identity] Error:", message);
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
