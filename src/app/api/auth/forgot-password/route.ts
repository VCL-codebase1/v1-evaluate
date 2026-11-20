import { NextResponse } from "next/server";
import { checkThrottle, registerFailure, throttleSubject } from "@/lib/auth/throttle";
import { log, requestMeta } from "@/lib/observability/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function appBaseUrl(request: Request) {
  const envBase = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envBase) return envBase.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

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
    log.warn("auth.password_reset.throttled", { ip: meta.ip });
    return NextResponse.json({ ok: true });
  }

  await Promise.all([registerFailure(ipCfg), registerFailure(emailCfg)]);

  try {
    const supabase = await createSupabaseServerClient();
    const redirectTo = `${appBaseUrl(request)}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      // Keep response generic; log for operators.
      log.warn("auth.password_reset.request_failed", { ip: meta.ip, message: error.message });
    } else {
      log.info("auth.password_reset.requested", { ip: meta.ip, delivery: "supabase" });
    }
  } catch (error) {
    log.error("auth.password_reset.error", { message: error instanceof Error ? error.message : String(error) });
  }

  // Always generic success.
  return NextResponse.json({ ok: true });
}
