import { NextResponse } from "next/server";
import { consumePasswordResetToken } from "@/lib/auth/password-reset";
import { checkThrottle, registerFailure, throttleSubject } from "@/lib/auth/throttle";
import { log, requestMeta } from "@/lib/observability/logger";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: string; password?: string } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const meta = requestMeta(request);
  const ipCfg = {
    scope: "reset:ip",
    subject: throttleSubject("reset:ip", meta.ip),
    windowMs: 15 * 60_000,
    maxFailures: 20,
    blockMs: 15 * 60_000,
  };
  const check = await checkThrottle(ipCfg);
  if (check.blocked) {
    log.warn("auth.password_reset.consume_throttled", { ip: meta.ip });
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(check.retryAfterSec) } },
    );
  }

  if (!token || password.length < 8) {
    await registerFailure(ipCfg);
    return NextResponse.json({ error: "Reset link is invalid or has expired." }, { status: 400 });
  }

  try {
    const result = await consumePasswordResetToken(token, password);
    if (!result.ok) {
      await registerFailure(ipCfg);
      log.warn("auth.password_reset.consume_failed", { ip: meta.ip });
      return NextResponse.json({ error: result.error || "Reset link is invalid or has expired." }, { status: 400 });
    }
    log.info("auth.password_reset.consume_success", { ip: meta.ip });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await registerFailure(ipCfg);
    log.error("auth.password_reset.consume_error", { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to reset password right now." }, { status: 500 });
  }
}
