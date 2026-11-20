import { NextResponse } from "next/server";
import { checkThrottle, registerFailure, throttleSubject } from "@/lib/auth/throttle";
import { getUserProfileByAuthId, clearPasswordState } from "@/lib/auth/users";
import { log, requestMeta } from "@/lib/observability/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: string;
    password?: string;
    code?: string;
  } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const code = typeof body?.code === "string" ? body.code : "";
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

  if (password.length < 8) {
    await registerFailure(ipCfg);
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();

    // Support PKCE code flow (recommended) and legacy token_hash flow if provided.
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        await registerFailure(ipCfg);
        log.warn("auth.password_reset.exchange_failed", { ip: meta.ip, message: error.message });
        return NextResponse.json({ error: "Reset link is invalid or has expired." }, { status: 400 });
      }
    } else if (token) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: "recovery" });
      if (error) {
        await registerFailure(ipCfg);
        log.warn("auth.password_reset.verify_failed", { ip: meta.ip, message: error.message });
        return NextResponse.json({ error: "Reset link is invalid or has expired." }, { status: 400 });
      }
    } else {
      // Allow recovery session already established in browser (e.g. hash-based redirect handled client-side).
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        await registerFailure(ipCfg);
        return NextResponse.json({ error: "Reset link is invalid or has expired." }, { status: 400 });
      }
    }

    const { data: userData, error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError || !userData.user) {
      await registerFailure(ipCfg);
      log.warn("auth.password_reset.update_failed", { ip: meta.ip, message: updateError?.message });
      return NextResponse.json({ error: "Unable to reset password." }, { status: 400 });
    }

    const profile = await getUserProfileByAuthId(userData.user.id);
    if (profile) {
      // Clear local lock/must-change flags and (best-effort) local hash marker; Supabase is source of truth.
      await clearPasswordState(profile.id, { mustChangePassword: false, revokeRefreshTokens: true });
    }

    log.info("auth.password_reset.completed", { ip: meta.ip, userId: profile?.id ?? null, provider: "supabase" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await registerFailure(ipCfg);
    log.error("auth.password_reset.consume_error", { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to reset password right now." }, { status: 500 });
  }
}
