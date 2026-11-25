import { NextResponse } from "next/server";
import { clearPasswordState } from "@/lib/auth/users";
import { getPasswordChangeSession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { log } from "@/lib/observability/logger";

export async function POST(request: Request) {
  const session = await getPasswordChangeSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!session.mustChangePassword) return NextResponse.json({ error: "Password setup is already complete." }, { status: 409 });

  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error || !data.user || data.user.id !== session.authUserId) {
      log.warn("auth.password_change.provider_failed", { userId: session.userId, message: error?.message });
      return NextResponse.json({ error: "Unable to update your password. Please try again." }, { status: 502 });
    }
    await clearPasswordState(session.userId, { mustChangePassword: false, revokeRefreshTokens: true });
    log.info("auth.password_change.completed", { userId: session.userId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error("auth.password_change.failed", { userId: session.userId, message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to update your password. Please try again." }, { status: 503 });
  }
}
