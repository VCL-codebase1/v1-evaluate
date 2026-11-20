import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canManageUsers, isRole } from "@/lib/auth/roles";
import { createUser, findUserByEmail, listUsers, updateUserAdmin } from "@/lib/auth/users";
import { log } from "@/lib/observability/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canManageUsers(session.role)) {
    return NextResponse.json({ error: "You do not have access to this action." }, { status: 403 });
  }
  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canManageUsers(session.role)) {
    return NextResponse.json({ error: "You do not have access to this action." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    name?: string;
    role?: string;
    password?: string;
    mustChangePassword?: boolean;
  } | null;

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const role = typeof body?.role === "string" ? body.role : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const mustChangePassword = body?.mustChangePassword ?? true;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email.", field: "email" }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "Enter a name.", field: "name" }, { status: 400 });
  if (!isRole(role)) return NextResponse.json({ error: "Select a valid role.", field: "role" }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters.", field: "password" }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const existingProfile = await findUserByEmail(email);

    // Try to create Supabase auth user; if email already exists, reuse it.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
      app_metadata: { role },
    });

    let authUserId = created.user?.id ?? null;
    if (createError) {
      const msg = createError.message || "";
      const isDuplicate = /already|exists|registered/i.test(msg);
      if (!isDuplicate) {
        log.warn("admin.user.supabase_create_failed", { by: session.email, email, message: msg });
        return NextResponse.json({ error: msg || "Unable to provision Supabase auth user." }, { status: 400 });
      }
      // Fallback: locate existing auth user by listing (admin API); if unavailable, require manual link.
      const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = listData?.users?.find((u) => (u.email || "").toLowerCase() === email);
      authUserId = found?.id ?? existingProfile?.authUserId ?? null;
      if (authUserId) {
        await admin.auth.admin.updateUserById(authUserId, {
          password,
          email_confirm: true,
          user_metadata: { name },
          app_metadata: { role },
        });
      }
    }

    let user;
    if (existingProfile) {
      user = await updateUserAdmin(existingProfile.id, {
        name,
        role,
        isActive: true,
        authUserId,
        resetPassword: password,
        mustChangePassword,
      });
    } else {
      user = await createUser({
        email,
        name,
        role,
        password,
        authUserId,
        mustChangePassword,
        isActive: true,
      });
    }

    if (!user) return NextResponse.json({ error: "Unable to create user." }, { status: 400 });
    log.info("admin.user.created", { by: session.email, userId: user.id, role: user.role, auth: "supabase" });
    return NextResponse.json({ user }, { status: existingProfile ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create user.";
    const status = /already exists/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
