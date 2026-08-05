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
  action?: string;        // 'create' (default) | 'reset'
  email: string;
  project_ids?: string[]; // requerido para QA_TESTER y QA_LEAD en action=create
  role?: string;          // 'QA_TESTER' (default) | 'ADMIN' | 'QA_LEAD'
  user_id?: string;       // requerido para action=reset
  invited_by?: string;    // email del admin que ejecuta la acción (para audit log)
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `Qa-${seg()}-${seg()}`;
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

  const { action = 'create', email, project_ids, role: rawRole, user_id, invited_by } = payload;
  const VALID_ROLES = ['ADMIN', 'QA_LEAD', 'QA_TESTER'];
  const assignedRole = VALID_ROLES.includes(rawRole ?? '') ? rawRole! : 'QA_TESTER';

  // ── Field validation ────────────────────────────────────────────────────
  if (action === 'create' && !email) {
    return jsonError("Missing required field: email", 400);
  }
  // project_ids requerido para QA_TESTER y QA_LEAD
  if (action === 'create' && ['QA_TESTER', 'QA_LEAD'].includes(assignedRole)) {
    if (!project_ids || !Array.isArray(project_ids) || project_ids.length === 0) {
      return jsonError("project_ids must be a non-empty array for QA_TESTER and QA_LEAD users", 400);
    }
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email && !emailRegex.test(email)) {
    return jsonError("Invalid email format", 400);
  }

  // ── Route by action ────────────────────────────────────────────────────────
  if (action === 'reset') {
    if (!user_id && !email) {
      return jsonError('Missing user_id or email for reset action', 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonError('Server misconfiguration', 500);
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const newPassword = generatePassword();
    let targetUserId = user_id;

    if (!targetUserId && email) {
      const { data: usersData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const found = usersData?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!found) return jsonError(`User not found: ${email}`, 404);
      targetUserId = found.id;
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      targetUserId!,
      { password: newPassword }
    );

    if (updateError) {
      return jsonError(`Password reset failed: ${updateError.message}`, 500);
    }

    // Audit log (non-fatal)
    try {
      const supabaseDb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { persistSession: false },
      });
      await supabaseDb.from("audit_logs").insert({
        user_email: invited_by ?? "admin",
        action: "RESET_PASSWORD",
        entity: "USER",
        entity_id: targetUserId,
        details: { target_email: email },
      });
    } catch { /* non-fatal */ }

    return jsonResponse({
      success: true,
      action: 'reset',
      email,
      new_password: newPassword,
      message: 'Password reset successfully. Share the new password with the user.',
    });
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
    // ── 1. Create user with auto-generated password ───────────────────────────
    const generatedPassword = generatePassword();
    let userId: string;

    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: generatedPassword,
      email_confirm: true,
    });

    if (createError) {
      // Graceful handling: if user already exists, look them up
      const alreadyExists =
        createError.message?.toLowerCase().includes('already') ||
        createError.message?.toLowerCase().includes('registered') ||
        createError.message?.toLowerCase().includes('exists');

      if (!alreadyExists) {
        throw new Error(`User creation failed: ${createError.message}`);
      }

      // User already exists — find them
      const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (listError || !usersData) {
        throw new Error(`Failed to list users: ${listError?.message ?? 'no data'}`);
      }
      const existingUser = usersData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!existingUser) {
        throw new Error(`User already exists but could not be found: ${email}`);
      }
      userId = existingUser.id;
    } else {
      if (!createData?.user?.id) {
        throw new Error('User created but no user id returned');
      }
      userId = createData.user.id;
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

    // ── 3. Assign projects (QA_TESTER y QA_LEAD) ────────────────────────
    if (['QA_TESTER', 'QA_LEAD'].includes(assignedRole) && project_ids && project_ids.length > 0) {
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
    // Audit log (non-fatal)
    try {
      await adminClient.from("audit_logs").insert({
        user_email: invited_by ?? "admin",
        action: "CREATE",
        entity: "USER",
        entity_id: userId,
        details: { email, role: assignedRole, project_ids: project_ids ?? [] },
      });
    } catch { /* non-fatal */ }

    return jsonResponse({
      success: true,
      action: 'create',
      user_id: userId,
      email,
      role: assignedRole,
      generated_password: generatedPassword,
      message:
        assignedRole === 'ADMIN'
          ? 'Admin account created. Share the generated password with the user.'
          : 'QA account created. Share the generated password with the user.',
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
