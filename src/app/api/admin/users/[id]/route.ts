import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canManageUsers, isRole } from "@/lib/auth/roles";
import { findUserById, updateUserAdmin } from "@/lib/auth/users";
import { log } from "@/lib/observability/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canManageUsers(session.role)) {
    return NextResponse.json({ error: "You do not have access to this action." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    role?: string;
    isActive?: boolean;
    name?: string;
    resetPassword?: string;
    mustChangePassword?: boolean;
  } | null;

  const existing = await findUserById(id);
  if (!existing || existing.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const patch: Parameters<typeof updateUserAdmin>[1] = {};
  if (typeof body?.role === "string") {
    if (!isRole(body.role)) return NextResponse.json({ error: "Select a valid role." }, { status: 400 });
    if (body.role === "Super Admin" && existing.role !== "Super Admin") {
      return NextResponse.json({ error: "Super Admin role cannot be assigned from this action." }, { status: 400 });
    }
    patch.role = body.role;
  }
  if (typeof body?.isActive === "boolean") patch.isActive = body.isActive;
  if (typeof body?.name === "string") patch.name = body.name;
  if (typeof body?.resetPassword === "string" && body.resetPassword) {
    if (body.resetPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    patch.mustChangePassword = true;
  }
  if (typeof body?.mustChangePassword === "boolean") patch.mustChangePassword = body.mustChangePassword;

  // Sync critical auth changes to Supabase Auth when linked.
  if (existing.authUserId) {
    try {
      const admin = createSupabaseAdminClient();
      const supaPatch: Record<string, unknown> = {};
      if (patch.name || typeof body?.name === "string") {
        supaPatch.user_metadata = {
          name: patch.name ?? existing.name,
          organization_id: existing.organizationId,
          organization_name: session.organizationName,
        };
      }
      if (patch.role) {
        supaPatch.app_metadata = { role: patch.role, organization_id: existing.organizationId };
      }
      if (typeof patch.isActive === "boolean") supaPatch.ban_duration = patch.isActive ? "none" : "876000h";
      if (body?.resetPassword) {
        supaPatch.password = body.resetPassword;
        supaPatch.email_confirm = true;
      }
      if (Object.keys(supaPatch).length > 0) {
        const { error } = await admin.auth.admin.updateUserById(existing.authUserId, supaPatch);
        if (error) log.warn("admin.user.supabase_update_failed", { userId: id, message: error.message });
      }
    } catch (error) {
      log.warn("admin.user.supabase_update_error", {
        userId: id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const user = await updateUserAdmin(id, patch, session.organizationId);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  log.info("admin.user.updated", { by: session.email, userId: user.id, role: user.role, active: user.isActive, auth: "supabase", organizationId: session.organizationId });
  return NextResponse.json({ user });
}
