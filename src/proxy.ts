import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/rfqs",
  "/estimation",
  "/approval",
  "/reports",
  "/clients",
  "/exchange-rates",
  "/pricing-rules",
  "/audit",
  "/admin",
];

const AUTH_PATHS = ["/login", "/signup", "/forgot-password"];

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = hasSupabaseAuthCookie(request);
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isAuthPath = AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const auth = hasSession ? await updateSupabaseSession(request) : null;
  const response = auth?.response ?? NextResponse.next({ request });

  if (isAuthPath && auth?.authenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    auth.response.cookies.getAll().forEach(({ name, value, ...options }) => {
      redirect.cookies.set(name, value, options);
    });
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:png|svg|ico)$).*)"],
};
