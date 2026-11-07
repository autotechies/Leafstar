import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { sameSiteUrl } from "@/lib/redirect-url";

/*
  Runs before every /admin request (Next.js 16 calls middleware "proxy").
  1. Keeps the login session fresh: Supabase may issue a new token, which only a proxy or a
     route can write back as a cookie (pages cannot).
  2. A quick, early redirect to the login page for visitors with no session.
  This is NOT the security check. Every admin page and action verifies the person itself
  (requireStaff), and the database's Row Level Security refuses everyone else regardless.
*/

const OPEN_ADMIN_PAGES = /^\/admin\/(login|forgot-password)(\/|$)/;
/** Tells the pages which address was asked for, so a login redirect can bring the person back to it. */
export const PATH_HEADER = "x-ls-path";

/** Design and photo test pages are for building the site; the live site never serves them unless explicitly allowed. */
const devPagesClosed = () => process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_PAGES !== "1";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/dev" || path.startsWith("/dev/")) {
    return devPagesClosed() ? NextResponse.rewrite(new URL("/not-found-closed", request.url), { status: 404 }) : NextResponse.next();
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATH_HEADER, path + request.nextUrl.search);
  const forward = () => NextResponse.next({ request: { headers: requestHeaders } });

  let response = forward();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        // Pages in this same request must see the refreshed session too.
        requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
        response = forward();
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && !OPEN_ADMIN_PAGES.test(path)) {
    const login = sameSiteUrl(request, "/admin/login");
    login.searchParams.set("next", path + request.nextUrl.search);
    const redirect = NextResponse.redirect(login);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/dev/:path*"],
};
