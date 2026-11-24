import { NextResponse } from "next/server";
import { log, requestMeta } from "@/lib/observability/logger";
import { checkThrottles, registerFailure, throttleSubject } from "@/lib/auth/throttle";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOrganization } from "@/lib/auth/organizations";
import { createUser } from "@/lib/auth/users";
import { ensureDb } from "@/lib/db/schema";
import type { Role } from "@/lib/auth/roles";

export const maxDuration = 60;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out.`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  }) as Promise<T>;
}

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

  try {
    await ensureDb();
  } catch {
    return NextResponse.json(
      { error: "Account creation is temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
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

  try {
    const blocked = await withTimeout(
      checkThrottles(ipCfg, emailCfg),
      8000,
      "Signup throttle check",
    );
    if (blocked.blocked) {
      return NextResponse.json(
        { error: "Too many signup attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(blocked.retryAfterSec) } },
      );
    }
  } catch (error) {
    log.warn("auth.signup.throttle_check_failed", {
      email,
      ip: meta.ip,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Account creation is temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }

  let organizationId: string | null = null;
  let authUserId: string | null = null;
  let createdSupabaseUser = false;

  try {
    const org = await withTimeout(createOrganization({ name: organizationName }), 15000, "Organization creation");
    organizationId = org.id;

    const admin = createSupabaseAdminClient();
    const { data: created, error: createError } = await withTimeout(admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, organization_id: org.id, organization_name: org.name },
      app_metadata: { role: "Super Admin", organization_id: org.id },
    }), 20000, "Account provisioning");

    if (createError) {
      throw new Error(createError.message || "Unable to create account.");
    }

    authUserId = created.user?.id ?? null;
    createdSupabaseUser = Boolean(authUserId);
    if (!authUserId) throw new Error("Unable to create account.");

    await withTimeout(
      createUser({
        email,
        name,
        role: "Super Admin" as Role,
        organizationId: org.id,
        authUserId,
        mustChangePassword: false,
        isActive: true,
      }),
      15000,
      "Workspace profile creation",
    );

    // Establish session cookies for immediate sign-in.
    try {
      const supabase = await createSupabaseServerClient();
      const { error: signInError } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        15000,
        "Sign-in",
      );
      if (signInError) {
        log.warn("auth.signup.signin_failed", { email, organizationId: org.id, message: signInError.message });
        return NextResponse.json(
          { ok: true, requiresSignIn: true, organization: { id: org.id, name: org.name } },
          { status: 201 },
        );
      }
    } catch (signInError) {
      log.warn("auth.signup.signin_failed", {
        email,
        organizationId: org.id,
        message: signInError instanceof Error ? signInError.message : String(signInError),
      });
      return NextResponse.json(
        { ok: true, requiresSignIn: true, organization: { id: org.id, name: org.name } },
        { status: 201 },
      );
    }

    log.info("auth.signup.success", { email, organizationId: org.id, role: "Super Admin" });
    return NextResponse.json(
      {
        ok: true,
        organization: { id: org.id, name: org.name },
      },
      { status: 201 },
    );
  } catch (error) {
    try {
      await withTimeout(Promise.allSettled([registerFailure(ipCfg), registerFailure(emailCfg)]), 3000, "Signup failure recording");
    } catch (recordError) {
      log.warn("auth.signup.failure_recording_failed", {
        message: recordError instanceof Error ? recordError.message : String(recordError),
      });
    }

    // Best-effort cleanup to avoid orphaned tenant/auth records.
    try {
      if (createdSupabaseUser && authUserId) {
        const admin = createSupabaseAdminClient();
        await withTimeout(admin.auth.admin.deleteUser(authUserId), 5000, "Auth cleanup");
      }
    } catch (cleanupError) {
      log.warn("auth.signup.auth_cleanup_failed", {
        authUserId,
        message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    }
    try {
      if (organizationId) {
        const { sql } = await import("@/lib/db/client");
        // cascade removes org-scoped rows if any were partially created
        await withTimeout(sql()`delete from organizations where id = ${organizationId}`, 5000, "Organization cleanup");
      }
    } catch (cleanupError) {
      log.warn("auth.signup.organization_cleanup_failed", {
        organizationId,
        message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    }

    const message = error instanceof Error ? error.message : "Unable to create organization account.";
    log.warn("auth.signup.failed", { email, ip: meta.ip, message });
    const lower = message.toLowerCase();
    if (lower.includes("temporarily unavailable")) {
      return NextResponse.json(
        { error: "Account creation is temporarily unavailable. Please try again shortly." },
        { status: 503 },
      );
    }
    if (lower.includes("timed out")) {
      return NextResponse.json(
        { error: "Account creation is taking too long. Please try again." },
        { status: 504 },
      );
    }
    if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in or use a different email." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
