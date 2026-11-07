import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/types/database";
import { publicEnv } from "@/lib/env";

/**
 * Server client acting as the visitor or signed-in owner (their session cookie, anon key).
 * Row Level Security still applies, exactly as in the browser.
 */
export async function supabaseServer() {
  // Cookies first: this marks the page as per-visitor before anything else runs, so a build without
  // Supabase settings (GitHub's check) never tries to prerender it.
  // Reading the session checks token times (Date.now). Wait for a real request first so Next.js never tries that while preparing a page ahead of time.
  await connection();
  const cookieStore = await cookies();
  const env = publicEnv();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The session is
          // refreshed by the auth proxy instead (added with login in Step 2).
        }
      },
    },
  });
}
