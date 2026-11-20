import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canManageUsers, isRole } from "@/lib/auth/roles";
import { updateUserAdmin } from "@/lib/auth/users";
import { log } from "@/lib/observability/logger";

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

  const patch: Parameters<typeof updateUserAdmin>[1] = {};
  if (typeof body?.role === "string") {
    if (!isRole(body.role)) return NextResponse.json({ error: "Select a valid role." }, { status: 400 });
    patch.role = body.role;
  }
  if (typeof body?.isActive === "boolean") patch.isActive = body.isActive;
  if (typeof body?.name === "string") patch.name = body.name;
  if (typeof body?.resetPassword === "string" && body.resetPassword) {
    if (body.resetPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    patch.resetPassword = body.resetPassword;
  }
  if (typeof body?.mustChangePassword === "boolean") patch.mustChangePassword = body.mustChangePassword;

  const user = await updateUserAdmin(id, patch);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  log.info("admin.user.updated", { by: session.email, userId: user.id, role: user.role, active: user.isActive });
  return NextResponse.json({ user });
}
