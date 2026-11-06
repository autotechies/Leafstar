import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { lookupStaff, type Staff } from "@/modules/auth/session";

/*
  Shared guards for server routes (AGENTS.md §15): who may call, and from where.
  Routes never redirect; they answer with a short JSON error a form can show.
*/

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/** Staff who are fully signed in (password and, if switched on, the authenticator step). Null otherwise. */
export async function apiStaff(): Promise<Staff | null> {
  const result = await lookupStaff();
  if (result.status !== "ok") return null;
  if (result.staff.needsSecondStep) return null;
  if (result.staff.role !== "owner" && result.staff.role !== "manager") return null;
  return result.staff;
}

/**
 * Browsers always send Origin on POST. Anything without one, or from another site, is refused,
 * so a page on some other site can never make a visitor's browser call these routes.
 */
export async function isSameOrigin(request: Request): Promise<boolean> {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const configured = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host : null;
  return originHost === host || originHost === configured;
}
