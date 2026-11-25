import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canManageUsers, isRole } from "@/lib/auth/roles";
import { createUser, findUserByEmail, listUsers } from "@/lib/auth/users";
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
    invite?: boolean;
    mustChangePassword?: boolean;
  } | null;

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const role = typeof body?.role === "string" ? body.role : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const invite = body?.invite === true;
  const mustChangePassword = invite || (body?.mustChangePassword ?? true);

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
  if (!invite && password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters.", field: "password" }, { status: 400 });
  }

  let createdAuthUserId: string | null = null;
  try {
    const admin = createSupabaseAdminClient();
    const existingProfile = await findUserByEmail(email, session.organizationId);
    if (existingProfile) {
      return NextResponse.json({ error: "A user with this email already exists in your organization." }, { status: 409 });
    }

    const supaUserMeta = {
      name,
      organization_id: session.organizationId,
      organization_name: session.organizationName,
    };
    const supaAppMeta = { role, organization_id: session.organizationId };

    const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const { data: created, error: createError } = invite
      ? await admin.auth.admin.inviteUserByEmail(email, {
          data: supaUserMeta,
          redirectTo: `${appBaseUrl.replace(/\/$/, "")}/reset-password?invite=1`,
        })
      : await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: supaUserMeta,
          app_metadata: supaAppMeta,
        });

    if (createError) {
      const msg = createError.message || "";
      const alreadyExists = /already|exists|registered/i.test(msg);
      log.warn("admin.user.supabase_create_failed", { by: session.email, email, message: msg });
      return NextResponse.json(
        { error: alreadyExists
          ? "An account with this email already exists."
          : invite
            ? "Unable to send the invitation. Check email delivery settings or use a temporary password."
            : msg || "Unable to provision user." },
        { status: alreadyExists ? 409 : 502 },
      );
    }
    createdAuthUserId = created.user?.id ?? null;
    if (!createdAuthUserId) throw new Error("Supabase did not return a user ID.");
    if (invite) {
      const { error: metadataError } = await admin.auth.admin.updateUserById(createdAuthUserId, { app_metadata: supaAppMeta });
      if (metadataError) throw metadataError;
    }
    const user = await createUser({
      email,
      name,
      role,
      organizationId: session.organizationId,
      authUserId: createdAuthUserId,
      mustChangePassword,
      isActive: true,
    });
    createdAuthUserId = null;
    log.info("admin.user.created", { by: session.email, userId: user.id, role: user.role, auth: "supabase", organizationId: session.organizationId });
    return NextResponse.json({ user, invitationSent: invite }, { status: 201 });
  } catch (error) {
    if (createdAuthUserId) {
      try {
        await createSupabaseAdminClient().auth.admin.deleteUser(createdAuthUserId);
      } catch (cleanupError) {
        log.warn("admin.user.auth_cleanup_failed", {
          authUserId: createdAuthUserId,
          message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
    }
    const message = error instanceof Error ? error.message : "Unable to create user.";
    const status = /already exists/i.test(message) ? 409 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
