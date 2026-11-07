import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin, jsonError } from "@/lib/api";
import { rateLimitAllow } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { forgetVisitor } from "@/modules/chat/engine";

/* "Forget me" (AGENTS.md §11): deletes the visitor, their chats and their memory. */

const body = z.object({ visitorId: z.string().uuid() });

export async function POST(request: Request) {
  if (!(await isSameOrigin(request))) return jsonError("This request was not accepted.", 403);
  if (!(await rateLimitAllow(`visitor:${await clientIp()}`, 10, 600))) return jsonError("Too many requests. Please wait a few minutes.", 429);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("That request was not understood.", 400);
  try {
    await forgetVisitor(parsed.data.visitorId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[visitor] forget failed", error);
    return jsonError("We could not remove that right now. Please try again.", 500);
  }
}
