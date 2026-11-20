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
  const users = await listUsers(session.organizationId);
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
  if (role === "Super Admin") {
    return NextResponse.json(
      { error: "Super Admin accounts are created when creating an organization.", field: "role" },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters.", field: "password" }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const existingProfile = await findUserByEmail(email, session.organizationId);

    const supaUserMeta = {
      name,
      organization_id: session.organizationId,
      organization_name: session.organizationName,
    };
    const supaAppMeta = { role, organization_id: session.organizationId };

    // Try to create Supabase auth user; if email already exists globally, reuse it.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: supaUserMeta,
      app_metadata: supaAppMeta,
    });

    let authUserId = created.user?.id ?? null;
    if (createError) {
      const msg = createError.message || "";
      const isDuplicate = /already|exists|registered/i.test(msg);
      if (!isDuplicate) {
        log.warn("admin.user.supabase_create_failed", { by: session.email, email, message: msg });
        return NextResponse.json({ error: msg || "Unable to provision Supabase auth user." }, { status: 400 });
      }
      let found = null;
      for (let page = 1; page <= 100; page += 1) {
        const { data: listData, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (listError) throw new Error("Unable to verify the existing account organization.");
        found = listData?.users?.find((u) => (u.email || "").toLowerCase() === email) ?? null;
        if (found || (listData?.users?.length ?? 0) < 200) break;
      }
      if (!found && !existingProfile?.authUserId) {
        return NextResponse.json(
          { error: "The existing account could not be safely linked. Contact your administrator." },
          { status: 409 },
        );
      }
      // Supabase Auth identities are global. Reusing an identity from another
      // organization would let this tenant overwrite its role and tenant claim.
      if (
        found &&
        found.id !== existingProfile?.authUserId &&
        found.app_metadata?.organization_id !== session.organizationId
      ) {
        return NextResponse.json(
          { error: "This email already belongs to an account outside your organization." },
          { status: 409 },
        );
      }
      authUserId = found?.id ?? existingProfile?.authUserId ?? null;
      if (authUserId) {
        const { error: updErr } = await admin.auth.admin.updateUserById(authUserId, {
          password,
          email_confirm: true,
          user_metadata: supaUserMeta,
          app_metadata: supaAppMeta,
        });
        if (updErr) {
          log.warn("admin.user.supabase_update_failed", { by: session.email, email, message: updErr.message });
        }
      }
    }

    let user;
    if (existingProfile) {
      user = await updateUserAdmin(
        existingProfile.id,
        {
          name,
          role,
          isActive: true,
          authUserId,
          mustChangePassword,
        },
        session.organizationId,
      );
    } else {
      user = await createUser({
        email,
        name,
        role,
        organizationId: session.organizationId,
        authUserId,
        mustChangePassword,
        isActive: true,
      });
    }

    if (!user) return NextResponse.json({ error: "Unable to create user." }, { status: 400 });
    log.info("admin.user.created", { by: session.email, userId: user.id, role: user.role, auth: "supabase", organizationId: session.organizationId });
    return NextResponse.json({ user }, { status: existingProfile ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create user.";
    const status = /already exists/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
