import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { safeAdminPath } from "@/lib/formats";

/*
  The one place that decides who is signed in and what they may do (AGENTS.md §15, §19: requireRole).
  Every admin page and every admin action calls requireStaff() itself, right next to its data,
  because Next.js renders layouts and pages in parallel: a check in the layout alone protects nothing.
  Row Level Security in the database is the second, independent lock.
*/

export type StaffRole = Database["public"]["Enums"]["app_role"];

export interface Staff {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  /** Two-step login is switched on for this person (a confirmed authenticator app). */
  twoStepOn: boolean;
  /** Signed in with the password, but the authenticator code is still needed. */
  needsSecondStep: boolean;
}

export type StaffLookup =
  | { status: "signed-out" }
  | { status: "no-access"; email: string }
  | { status: "ok"; staff: Staff };

/**
  Reads the session once per request (React cache). The sign-in token's signature and expiry are checked (getClaims),
  and the staff profile (active, role) is read from the database on every request, so a switched-off person is
  locked out at once. This avoids a second round trip to Supabase on every page (proxy.ts already checks the same way).
*/
export const lookupStaff = cache(async (): Promise<StaffLookup> => {
  const supabase = await supabaseServer();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (error || !claims?.sub) return { status: "signed-out" };
  const user = { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };

  const [{ data: profile }, { data: aal }] = await Promise.all([
    supabase.from("profiles").select("full_name, role, is_active").eq("id", user.id).maybeSingle(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!profile || !profile.is_active) return { status: "no-access", email: user.email ?? "" };

  const twoStepOn = aal?.nextLevel === "aal2";
  return {
    status: "ok",
    staff: {
      id: user.id,
      email: user.email ?? "",
      name: profile.full_name || user.email || "Owner",
      role: profile.role,
      twoStepOn,
      needsSecondStep: twoStepOn && aal?.currentLevel !== "aal2",
    },
  };
});

const ADMIN_ROLES: readonly StaffRole[] = ["owner", "manager"];

/**
 * Use at the top of every admin page and action. Signed out → login page; password given but the
 * authenticator code still needed → code page; no staff profile or wrong role → no-access page.
 * `from` is where to return after logging in; by default, the address the person asked for.
 */
export async function requireStaff(roles: readonly StaffRole[] = ADMIN_ROLES, from?: string): Promise<Staff> {
  const result = await lookupStaff();
  if (result.status === "ok" && !result.staff.needsSecondStep && roles.includes(result.staff.role)) return result.staff;
  from ??= safeAdminPath((await headers()).get("x-ls-path"));
  if (result.status === "signed-out") redirect(`/admin/login?next=${encodeURIComponent(from)}`);
  if (result.status === "no-access") redirect("/admin/no-access");
  if (result.staff.needsSecondStep) redirect(`/admin/login/verify?next=${encodeURIComponent(from)}`);
  redirect("/admin/no-access");
}
