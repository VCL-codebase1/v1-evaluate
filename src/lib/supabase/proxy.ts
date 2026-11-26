import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { supabaseFetch } from "@/lib/supabase/fetch";
import { authCookieOptions, SESSION_ONLY_COOKIE } from "@/lib/auth/session-cookie";

export async function updateSupabaseSession(request: NextRequest, verify = false) {
  let response = NextResponse.next({ request });
  const sessionOnly = request.cookies.get(SESSION_ONLY_COOKIE)?.value === "1";
  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    global: { fetch: supabaseFetch },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, authCookieOptions(options, sessionOnly)));
      },
    },
  });

  // Workspace requests only need cookie refresh here. The server verifies claims
  // before reading any organization data, avoiding two remote checks per page.
  if (!verify) {
    try {
      await supabase.auth.getSession();
    } catch {
      // Leave transient auth failures to the server session check and retry UI.
    }
    return { response, authenticated: false };
  }

  const { data, error } = await supabase.auth.getClaims();
  return { response, authenticated: !error && Boolean(data?.claims?.sub) };
}
