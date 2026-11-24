import { NextResponse } from "next/server";
import { getLatestEstimateId } from "@/lib/estimates";
import type { SessionUser } from "@/lib/types";
import { validateLogin } from "@/lib/validators";
import { log, requestMeta } from "@/lib/observability/logger";
import { checkThrottles, clearThrottle, registerFailure, throttleSubject } from "@/lib/auth/throttle";
import { getUserProfileByAuthId, isUserLocked, markLoginSuccess } from "@/lib/auth/users";
import { getOrganizationById } from "@/lib/auth/organizations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const GENERIC_AUTH_ERROR = "Email or password is incorrect.";
const LOCKED_ERROR = "This account is temporarily unavailable. Try again later or reset your password.";

function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${operation} timed out.`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
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

    if (error || !data.user) {
      await Promise.allSettled([registerFailure(ipCfg), registerFailure(emailCfg)]);
      log.warn("auth.login.failed", { email, ip: meta.ip, reason: "supabase_auth" });
      return NextResponse.json({ error: GENERIC_AUTH_ERROR, field: "password" }, { status: 401 });
    }

    const profile = await withTimeout(getUserProfileByAuthId(data.user.id), 10000, "Workspace profile lookup");
    if (!profile) {
      await supabase.auth.signOut().catch(() => {});
      await Promise.allSettled([registerFailure(ipCfg), registerFailure(emailCfg)]);
      log.warn("auth.login.failed", { email, ip: meta.ip, reason: "no_profile" });
      return NextResponse.json(
        { error: "Your account is not linked to an organization workspace. Contact your administrator.", field: "email" },
        { status: 403 },
      );
    }

    if (!profile.isActive) {
      await supabase.auth.signOut().catch(() => {});
      await Promise.allSettled([registerFailure(ipCfg), registerFailure(emailCfg)]);
      log.warn("auth.login.failed", { email, ip: meta.ip, reason: "inactive", userId: profile.id });
      return NextResponse.json({ error: GENERIC_AUTH_ERROR, field: "password" }, { status: 401 });
    }

    if (isUserLocked(profile)) {
      await supabase.auth.signOut().catch(() => {});
      log.warn("auth.login.failed", { email, ip: meta.ip, reason: "locked", userId: profile.id });
      return NextResponse.json({ error: LOCKED_ERROR, field: "password" }, { status: 403 });
    }

    const [org, estimateId] = await Promise.all([
      getOrganizationById(profile.organizationId).catch(() => null),
      getLatestEstimateId(profile.organizationId).then((id) => id ?? "").catch(() => ""),
    ]);

    const session: SessionUser = {
      email: profile.email,
      role: profile.role,
      name: profile.name,
      estimateId,
      version: "v1",
      organizationId: profile.organizationId,
      organizationName: org?.name ?? "Organization",
    };

    await Promise.allSettled([
      markLoginSuccess(profile.id),
      clearThrottle("login:ip", ipSubject),
      clearThrottle("login:email", emailSubject),
    ]);
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
    return NextResponse.json({ error: "Unable to sign in right now. Please try again." }, { status: 500 });
  }
}
