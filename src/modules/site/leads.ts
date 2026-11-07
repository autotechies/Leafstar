import "server-only";
import { after, NextResponse } from "next/server";
import type { ZodType } from "zod";
import { isSameOrigin, jsonError } from "@/lib/api";
import { rateLimitAllow } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notifyOwner } from "@/modules/notify/notify";
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

  const lead = toLead(parsed.data);
  const { error } = await supabaseAdmin().rpc("create_lead", { p: lead as never });
  if (error) {
    console.error(`[${route}] create_lead failed`, error);
    return jsonError("We could not send that right now. Please call us or message us on WhatsApp.", 500);
  }
  const what: Record<string, string> = { request_price: "asked for a price", enquiry_list: "sent an enquiry list", call_click: "asked for a call back", contact_form: "sent a message" };
  const who = [lead.name, lead.phone ? `+${String(lead.phone)}` : null].filter(Boolean).join(" ");
  after(() => notifyOwner({ title: "A buyer is waiting", body: `${who} ${what[String(lead.source)] ?? "contacted you"}.` }));
  return NextResponse.json({ ok: true });
}
