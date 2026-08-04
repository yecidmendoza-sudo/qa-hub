// admin-invite-user
// Supabase Edge Function — Deno/TypeScript
// Invites a QA user by email, creates/updates their profile, and assigns project access.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-api-key, x-client-info, apikey",
};

// ── Types ──────────────────────────────────────────────────────────────────

interface InviteUserPayload {
  email: string;
  project_ids?: string[];   // requerido para REGULAR, opcional para ADMIN
  role?: string;            // 'REGULAR' (default) | 'ADMIN'
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
  let payload: InviteUserPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { email, project_ids, role: rawRole } = payload;
  const assignedRole = rawRole === "ADMIN" ? "ADMIN" : "REGULAR";

  // ── Field validation ────────────────────────────────────────────────────
  if (!email) {
    return jsonError("Missing required field: email", 400);
  }
  // project_ids requerido solo para usuarios REGULAR
  if (assignedRole === "REGULAR") {
    if (!project_ids || !Array.isArray(project_ids) || project_ids.length === 0) {
      return jsonError("project_ids must be a non-empty array for REGULAR users", 400);
    }
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return jsonError("Invalid email format", 400);
  }

  // ── Supabase client (service role) ──────────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonError("Server misconfiguration: Supabase env vars not set", 500);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // ── 1. Invite user via Supabase Admin Auth ────────────────────────────
    let userId: string;

    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: "https://qa-hub-qvnt-jade.vercel.app",
      });

    if (inviteError) {
      // Graceful handling: if user already exists, look them up
      const alreadyExists =
        inviteError.message?.toLowerCase().includes("already") ||
        inviteError.message?.toLowerCase().includes("registered") ||
        inviteError.message?.toLowerCase().includes("exists");

      if (!alreadyExists) {
        throw new Error(`Auth invite failed: ${inviteError.message}`);
      }

      // User already exists — find them by listing users and matching email
      const { data: usersData, error: listError } =
        await adminClient.auth.admin.listUsers({ perPage: 1000 });

      if (listError || !usersData) {
        throw new Error(
          `Failed to list users to resolve existing account: ${listError?.message ?? "no data"}`,
        );
      }

      const existingUser = usersData.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase(),
      );

      if (!existingUser) {
        throw new Error(
          `User already exists but could not be found in user list: ${email}`,
        );
      }

      userId = existingUser.id;
    } else {
      if (!inviteData?.user?.id) {
        throw new Error("Invite succeeded but no user id was returned");
      }
      userId = inviteData.user.id;
    }

    // ── 2. Upsert profile ─────────────────────────────────────────────────
    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert(
        { id: userId, email, role: assignedRole },
        { onConflict: "id" },
      );

    if (profileError) {
      throw new Error(`Profile upsert failed: ${profileError.message}`);
    }

    // ── 3. Assign projects (solo para REGULAR) ───────────────────────────
    if (assignedRole === "REGULAR" && project_ids && project_ids.length > 0) {
      for (const projectId of project_ids) {
        const { error: projectAssignError } = await adminClient
          .from("user_projects")
          .upsert(
            { user_id: userId, project_id: projectId },
            { onConflict: "user_id,project_id" },
          );

        if (projectAssignError) {
          console.warn(
            `[admin-invite-user] Failed to assign project ${projectId} to ${userId}:`,
            projectAssignError.message,
          );
        }
      }
    }

    // ── Response ──────────────────────────────────────────────────────────
    return jsonResponse({
      success: true,
      user_id: userId,
      email,
      role: assignedRole,
      message:
        assignedRole === "ADMIN"
          ? "Admin invitation sent. User will receive an email to set their password."
          : "Invitation sent. QA will receive an email to set their password.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin-invite-user] Error:", message);
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
