import { NextResponse } from "next/server";
import { createPasswordResetToken } from "@/lib/auth/password-reset";
import { checkThrottle, registerFailure, throttleSubject } from "@/lib/auth/throttle";
import { log, requestMeta } from "@/lib/observability/logger";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase() ?? "";

  if (!EMAIL.test(email)) {
    return NextResponse.json({ error: "Enter a valid work email." }, { status: 400 });
  }

  const meta = requestMeta(request);
  const ipCfg = {
    scope: "forgot:ip",
    subject: throttleSubject("forgot:ip", meta.ip),
    windowMs: 15 * 60_000,
    maxFailures: 10,
    blockMs: 15 * 60_000,
  };
  const emailCfg = {
    scope: "forgot:email",
    subject: throttleSubject("forgot:email", email),
    windowMs: 30 * 60_000,
    maxFailures: 5,
    blockMs: 30 * 60_000,
  };

  const [ipCheck, emailCheck] = await Promise.all([checkThrottle(ipCfg), checkThrottle(emailCfg)]);
  if (ipCheck.blocked || emailCheck.blocked) {
    // Generic success to avoid enumeration; log throttling.
    log.warn("auth.password_reset.throttled", { ip: meta.ip });
    return NextResponse.json({ ok: true });
  }

  await Promise.all([registerFailure(ipCfg), registerFailure(emailCfg)]);

  try {
    await createPasswordResetToken(email, { ip: meta.ip, userAgent: meta.userAgent });
  } catch (error) {
    log.error("auth.password_reset.error", { message: error instanceof Error ? error.message : String(error) });
  }

  // Always generic success.
  return NextResponse.json({ ok: true });
}
