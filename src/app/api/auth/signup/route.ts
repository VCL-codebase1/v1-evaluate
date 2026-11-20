import { NextResponse } from "next/server";
import { log, requestMeta } from "@/lib/observability/logger";
import { checkThrottle, registerFailure, throttleSubject } from "@/lib/auth/throttle";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOrganization, ensureDefaultExchangeRates } from "@/lib/auth/organizations";
import { createUser } from "@/lib/auth/users";
import { getSession } from "@/lib/session";
import type { Role } from "@/lib/auth/roles";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    organizationName?: string;
    name?: string;
    email?: string;
    password?: string;
  } | null;

  const organizationName = typeof body?.organizationName === "string" ? body.organizationName.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!organizationName) {
    return NextResponse.json({ error: "Enter your organization name.", field: "organizationName" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Enter your full name.", field: "name" }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid work email.", field: "email" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters.", field: "password" }, { status: 400 });
  }

  const meta = requestMeta(request);
  const ipCfg = {
    scope: "signup:ip",
    subject: throttleSubject("signup:ip", meta.ip),
    windowMs: 60 * 60_000,
    maxFailures: 10,
    blockMs: 60 * 60_000,
  };
  const emailCfg = {
    scope: "signup:email",
    subject: throttleSubject("signup:email", email),
    windowMs: 60 * 60_000,
    maxFailures: 5,
    blockMs: 60 * 60_000,
  };
  const [ipCheck, emailCheck] = await Promise.all([checkThrottle(ipCfg), checkThrottle(emailCfg)]);
  const blocked = ipCheck.blocked ? ipCheck : emailCheck.blocked ? emailCheck : null;
  if (blocked) {
    return NextResponse.json(
      { error: "Too many signup attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(blocked.retryAfterSec) } },
    );
  }

  let organizationId: string | null = null;
  let authUserId: string | null = null;
  let createdSupabaseUser = false;

  try {
    const org = await createOrganization({ name: organizationName });
    organizationId = org.id;
    await ensureDefaultExchangeRates(org.id);

    const admin = createSupabaseAdminClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, organization_id: org.id, organization_name: org.name },
      app_metadata: { role: "Super Admin", organization_id: org.id },
    });

    if (createError) {
      throw new Error(createError.message || "Unable to create account.");
    }

    authUserId = created.user?.id ?? null;
    createdSupabaseUser = Boolean(authUserId);
    if (!authUserId) throw new Error("Unable to create account.");

    await createUser({
      email,
      name,
      role: "Super Admin" as Role,
      organizationId: org.id,
      password,
      authUserId,
      mustChangePassword: false,
      isActive: true,
    });

    // Establish session cookies for immediate sign-in.
    const supabase = await createSupabaseServerClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      log.warn("auth.signup.signin_failed", { email, organizationId: org.id, message: signInError.message });
      return NextResponse.json(
        { ok: true, requiresSignIn: true, organization: { id: org.id, name: org.name } },
        { status: 201 },
      );
    }

    const session = await getSession();
    log.info("auth.signup.success", { email, organizationId: org.id, role: "Super Admin" });
    return NextResponse.json(
      {
        ok: true,
        user: session,
        organization: { id: org.id, name: org.name },
      },
      { status: 201 },
    );
  } catch (error) {
    await Promise.all([registerFailure(ipCfg), registerFailure(emailCfg)]);

    // Best-effort cleanup to avoid orphaned tenant/auth records.
    try {
      if (createdSupabaseUser && authUserId) {
        const admin = createSupabaseAdminClient();
        await admin.auth.admin.deleteUser(authUserId);
      }
    } catch {}
    try {
      if (organizationId) {
        const { sql } = await import("@/lib/db/client");
        await ensureDefaultExchangeRates(organizationId).catch(() => {});
        // cascade removes org-scoped rows if any were partially created
        await sql()`delete from organizations where id = ${organizationId}`;
      }
    } catch {}

    const message = error instanceof Error ? error.message : "Unable to create organization account.";
    log.warn("auth.signup.failed", { email, ip: meta.ip, message });
    const lower = message.toLowerCase();
    if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in or use a different email." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
