import { NextResponse } from "next/server";
import { listEstimates } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { validateLogin } from "@/lib/validators";
import { log, requestMeta } from "@/lib/observability/logger";
import { checkThrottle, clearThrottle, registerFailure, throttleSubject } from "@/lib/auth/throttle";
import { getUserProfileByAuthId, isUserLocked, markLoginSuccess } from "@/lib/auth/users";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const GENERIC_AUTH_ERROR = "Email or password is incorrect.";
const LOCKED_ERROR = "This account is temporarily unavailable. Try again later or reset your password.";

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

  const [ipCheck, emailCheck] = await Promise.all([checkThrottle(ipCfg), checkThrottle(emailCfg)]);
  const blocked = ipCheck.blocked ? ipCheck : emailCheck.blocked ? emailCheck : null;
  if (blocked) {
    log.warn("auth.login.rate_limited", { email, ip: meta.ip });
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(blocked.retryAfterSec) } },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: result.password,
  });

  if (error || !data.user) {
    await Promise.all([registerFailure(ipCfg), registerFailure(emailCfg)]);
    // Best-effort local lock tracking for known app users (by email/profile linkage).
    // We do not enumerate account existence in responses.
    log.warn("auth.login.failed", { email, ip: meta.ip, reason: "supabase_auth" });
    return NextResponse.json({ error: GENERIC_AUTH_ERROR, field: "password" }, { status: 401 });
  }

  const profile = await getUserProfileByAuthId(data.user.id);
  if (!profile) {
    await supabase.auth.signOut();
    await Promise.all([registerFailure(ipCfg), registerFailure(emailCfg)]);
    log.warn("auth.login.failed", { email, ip: meta.ip, reason: "no_profile" });
    return NextResponse.json({ error: GENERIC_AUTH_ERROR, field: "password" }, { status: 401 });
  }

  if (!profile.isActive) {
    await supabase.auth.signOut();
    await Promise.all([registerFailure(ipCfg), registerFailure(emailCfg)]);
    log.warn("auth.login.failed", { email, ip: meta.ip, reason: "inactive", userId: profile.id });
    return NextResponse.json({ error: GENERIC_AUTH_ERROR, field: "password" }, { status: 401 });
  }

  if (isUserLocked(profile)) {
    await supabase.auth.signOut();
    log.warn("auth.login.failed", { email, ip: meta.ip, reason: "locked", userId: profile.id });
    return NextResponse.json({ error: LOCKED_ERROR, field: "password" }, { status: 403 });
  }

  let estimateId = "EST-2026-001";
  try {
    const estimates = await listEstimates();
    estimateId = estimates[0]?.id ?? estimateId;
  } catch {
    // keep fallback
  }

  const session: SessionUser = {
    email: profile.email,
    role: profile.role,
    name: profile.name,
    estimateId,
    version: "v1",
  };

  await Promise.all([markLoginSuccess(profile.id), clearThrottle("login:ip", ipSubject), clearThrottle("login:email", emailSubject)]);
  log.info("auth.login.success", { email: profile.email, role: profile.role, ip: meta.ip, auth: "supabase" });

  return NextResponse.json({ user: session, mustChangePassword: profile.mustChangePassword });
}
