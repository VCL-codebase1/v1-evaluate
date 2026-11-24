import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/types";
import { validateLogin } from "@/lib/validators";
import { log, requestMeta } from "@/lib/observability/logger";
import { checkThrottles, completeLogin, registerFailure, throttleSubject } from "@/lib/auth/throttle";
import { getSessionProfileByAuthId, isUserLocked } from "@/lib/auth/users";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const GENERIC_AUTH_ERROR = "Email or password is incorrect.";
const LOCKED_ERROR = "This account is temporarily unavailable. Try again later or reset your password.";

function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  const startedAt = performance.now();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${operation} timed out.`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
    const durationMs = Math.round(performance.now() - startedAt);
    if (durationMs >= 2000) log.warn("auth.login.slow_stage", { operation, durationMs });
  }) as Promise<T>;
}

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    remember?: boolean;
  } | null;

  const result = validateLogin({
    email: body?.email,
    password: body?.password,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error, field: result.field }, { status: 400 });
  }

  const meta = requestMeta(request);
  const email = result.email.toLowerCase();
  const ipSubject = throttleSubject("login:ip", meta.ip);
  const emailSubject = throttleSubject("login:email", email);
  const ipCfg = { scope: "login:ip", subject: ipSubject, windowMs: 15 * 60_000, maxFailures: 20, blockMs: 15 * 60_000 };
  const emailCfg = { scope: "login:email", subject: emailSubject, windowMs: 15 * 60_000, maxFailures: 8, blockMs: 15 * 60_000 };

  try {
    const blocked = await withTimeout(checkThrottles(ipCfg, emailCfg), 5000, "Login throttle check");
    if (blocked.blocked) {
      log.warn("auth.login.rate_limited", { email, ip: meta.ip });
      return NextResponse.json(
        { error: "Too many sign-in attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(blocked.retryAfterSec) } },
      );
    }
  } catch (error) {
    log.warn("auth.login.throttle_check_failed", {
      email,
      ip: meta.ip,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Sign-in is temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({
        email,
        password: result.password,
      }),
      10000,
      "Supabase sign-in",
    );

    if (error && error.status !== 400) {
      throw error;
    }

    if (error || !data.user) {
      await withTimeout(Promise.all([registerFailure(ipCfg), registerFailure(emailCfg)]), 5000, "Login failure tracking");
      log.warn("auth.login.failed", { email, ip: meta.ip, reason: "supabase_auth" });
      return NextResponse.json({ error: GENERIC_AUTH_ERROR, field: "password" }, { status: 401 });
    }

    const profile = await withTimeout(getSessionProfileByAuthId(data.user.id), 10000, "Workspace profile lookup");
    if (!profile) {
      await withTimeout(supabase.auth.signOut({ scope: "local" }), 3000, "Local sign-out").catch(() => {});
      await withTimeout(Promise.all([registerFailure(ipCfg), registerFailure(emailCfg)]), 5000, "Login failure tracking");
      log.warn("auth.login.failed", { email, ip: meta.ip, reason: "no_profile" });
      return NextResponse.json(
        { error: "Your account is not linked to an organization workspace. Contact your administrator.", field: "email" },
        { status: 403 },
      );
    }

    if (!profile.isActive) {
      await withTimeout(supabase.auth.signOut({ scope: "local" }), 3000, "Local sign-out").catch(() => {});
      await withTimeout(Promise.all([registerFailure(ipCfg), registerFailure(emailCfg)]), 5000, "Login failure tracking");
      log.warn("auth.login.failed", { email, ip: meta.ip, reason: "inactive", userId: profile.id });
      return NextResponse.json({ error: GENERIC_AUTH_ERROR, field: "password" }, { status: 401 });
    }

    if (isUserLocked(profile)) {
      await withTimeout(supabase.auth.signOut({ scope: "local" }), 3000, "Local sign-out").catch(() => {});
      log.warn("auth.login.failed", { email, ip: meta.ip, reason: "locked", userId: profile.id });
      return NextResponse.json({ error: LOCKED_ERROR, field: "password" }, { status: 403 });
    }

    const session: SessionUser = {
      email: profile.email,
      role: profile.role,
      name: profile.name,
      estimateId: profile.estimateId,
      version: "v1",
      organizationId: profile.organizationId,
      organizationName: profile.organizationName,
    };

    try {
      await withTimeout(completeLogin(profile.id, ipSubject, emailSubject), 5000, "Login bookkeeping");
    } catch (bookkeepingError) {
      log.warn("auth.login.bookkeeping_failed", {
        userId: profile.id,
        message: bookkeepingError instanceof Error ? bookkeepingError.message : String(bookkeepingError),
      });
    }
    log.info("auth.login.success", {
      email: profile.email,
      role: profile.role,
      ip: meta.ip,
      auth: "supabase",
      organizationId: profile.organizationId,
    });

    return NextResponse.json({ user: session, mustChangePassword: profile.mustChangePassword });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn("auth.login.error", { email, ip: meta.ip, message });
    if (/timed out/i.test(message)) {
      return NextResponse.json(
        { error: "Sign-in is taking too long. Please try again." },
        { status: 504 },
      );
    }
    const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
    if (status === 429 || status >= 500) {
      return NextResponse.json({ error: "Sign-in is temporarily unavailable. Please try again shortly." }, { status: 503 });
    }
    return NextResponse.json({ error: "Unable to sign in right now. Please try again." }, { status: 500 });
  }
}
