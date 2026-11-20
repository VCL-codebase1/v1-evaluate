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
  "/audit",
  "/admin",
];

const AUTH_PATHS = ["/login", "/forgot-password", "/reset-password"];

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));
}

export async function proxy(request: NextRequest) {
  const response = await updateSupabaseSession(request);
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

  if (isAuthPath && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:png|svg|ico)$).*)"],
};
