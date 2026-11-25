import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SESSION_ONLY_COOKIE } from "@/lib/auth/session-cookie";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  (await cookies()).delete(SESSION_ONLY_COOKIE);
  return NextResponse.json({ ok: true });
}
