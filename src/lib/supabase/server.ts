import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { supabaseFetch } from "@/lib/supabase/fetch";
import { authCookieOptions, SESSION_ONLY_COOKIE } from "@/lib/auth/session-cookie";

export async function createSupabaseServerClient(options?: { sessionOnly?: boolean }) {
  const cookieStore = await cookies();
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  const sessionOnly = options?.sessionOnly ?? cookieStore.get(SESSION_ONLY_COOKIE)?.value === "1";

  return createServerClient(url, key, {
    global: { fetch: supabaseFetch },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, authCookieOptions(options, sessionOnly)));
        } catch {
          // setAll can be called from a Server Component; middleware/proxy refresh handles session persistence.
        }
      },
    },
  });
}
