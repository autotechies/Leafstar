import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { isSameOrigin, jsonError } from "@/lib/api";
import { rateLimitAllow } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fieldErrors } from "./schemas";

/*
  The one door every public enquiry goes through (AGENTS.md §7): same-site only, rate limited in the
  database, checked with zod, then ONE database call. Answers never say whether a phone number is already known.
*/

interface Options<T> {
  route: string;
  schema: ZodType<T>;
  /** Maps the checked form to the create_lead() payload. */
  toLead: (input: T) => Record<string, unknown>;
  limit?: number;
  windowSeconds?: number;
}

export async function handleLead<T extends { website?: string }>(request: Request, { route, schema, toLead, limit = 6, windowSeconds = 600 }: Options<T>) {
  if (!(await isSameOrigin(request))) return jsonError("This request was not accepted.", 403);

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 20_000) return jsonError("That message is too long.", 413);

  const ip = await clientIp();
  if (!(await rateLimitAllow(`${route}:${ip}`, limit, windowSeconds))) return jsonError("Too many requests. Please wait a few minutes.", 429);

  const raw: unknown = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") return jsonError("That request was not understood.", 400);

  // Bot trap: a hidden field a person never fills. Pretend it worked.
  if (typeof (raw as { website?: unknown }).website === "string" && (raw as { website: string }).website !== "") return NextResponse.json({ ok: true });

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonError("Please check the highlighted fields.", 400, { fieldErrors: fieldErrors(parsed.error) });

  const { error } = await supabaseAdmin().rpc("create_lead", { p: toLead(parsed.data) as never });
  if (error) {
    console.error(`[${route}] create_lead failed`, error);
    return jsonError("We could not send that right now. Please call us or message us on WhatsApp.", 500);
  }
  return NextResponse.json({ ok: true });
}
