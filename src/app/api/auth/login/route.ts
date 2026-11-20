import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";
import { listEstimates } from "@/lib/db";
import { encodeSession } from "@/lib/session-token";
import type { SessionUser } from "@/lib/types";
import { validateLogin } from "@/lib/validators";
import { log, requestMeta } from "@/lib/observability/logger";
import { checkThrottle, clearThrottle, registerFailure, throttleSubject } from "@/lib/auth/throttle";
import { findUserByEmail, isUserLocked, markLoginFailure, markLoginSuccess, verifyUserPassword } from "@/lib/auth/users";

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
    log.warn("auth.login.rate_limited", { ip: meta.ip, email });
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(blocked.retryAfterSec) } },
    );
  }

  const user = await findUserByEmail(email);

  // Avoid account enumeration: same response shape for missing/invalid/disabled/locked user.
  if (!user || !user.isActive || isUserLocked(user)) {
    await Promise.all([registerFailure(ipCfg), registerFailure(emailCfg)]);
    log.warn("auth.login.failed", { ip: meta.ip, email, reason: !user ? "not_found" : !user.isActive ? "inactive" : "locked" });
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
  }

  const ok = verifyUserPassword(user, result.password);
  if (!ok) {
    const failure = await markLoginFailure(user.id);
    await Promise.all([registerFailure(ipCfg), registerFailure(emailCfg)]);
    log.warn("auth.login.failed", { ip: meta.ip, email, reason: "bad_password", locked: Boolean(failure.lockedUntil) });
    const message = failure.lockedUntil ? LOCKED_ERROR : GENERIC_AUTH_ERROR;
    return NextResponse.json({ error: message }, { status: 401 });
  }

  await Promise.all([markLoginSuccess(user.id), clearThrottle("login:ip", ipSubject), clearThrottle("login:email", emailSubject)]);

  let estimateId = "EST-2026-001";
  try {
    const estimates = await listEstimates();
    estimateId = estimates[0]?.id ?? estimateId;
  } catch {
    // allow login even if estimate listing fails; workspace can recover
  }

  const session: SessionUser = {
    email: user.email,
    role: user.role,
    name: user.name,
    estimateId,
    version: "v1",
  };

  const maxAge = body?.remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12;
  const response = NextResponse.json({ user: session, mustChangePassword: user.mustChangePassword });
  response.cookies.set(SESSION_COOKIE, encodeSession(session, maxAge), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  log.info("auth.login.success", { userId: user.id, role: user.role });
  return response;
}
