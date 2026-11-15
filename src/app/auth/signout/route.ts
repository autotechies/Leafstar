import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { sameSiteUrl } from "@/lib/redirect-url";

/**
 * Architectural sign-out endpoint.
 * Completely purges both Supabase server-side session and all auth cookies,
 * ensuring no stale tokens linger in browser storage or request headers.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    await supabase.auth.signOut({ scope: "global" });
  } catch (error) {
    console.error("[auth] signout failed:", error);
  }

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const redirectUrl = sameSiteUrl(request, "/admin/login?signed-out=1");

  const response = NextResponse.redirect(redirectUrl, {
    status: 303,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      "Clear-Site-Data": '"cache", "storage"',
    },
  });

  // Explicitly invalidate all Supabase auth and session cookies
  for (const cookie of allCookies) {
    if (cookie.name.startsWith("sb-") || cookie.name.includes("auth-token") || cookie.name.includes("session")) {
      response.cookies.set(cookie.name, "", {
        path: "/",
        maxAge: 0,
        expires: new Date(0),
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
  }

  return response;
}

