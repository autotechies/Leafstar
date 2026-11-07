import { NextResponse } from "next/server";
import { isSameOrigin, jsonError } from "@/lib/api";
import { rateLimitAllow } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { chatInput, chatTurn } from "@/modules/chat/engine";

export async function POST(request: Request) {
  if (!(await isSameOrigin(request))) return jsonError("This request was not accepted.", 403);
  if (Number(request.headers.get("content-length") ?? 0) > 8_000_000) return jsonError("That message is too long.", 413);
  const ip = await clientIp();
  if (!(await rateLimitAllow(`chat:${ip}`, 20, 600))) return jsonError("You are sending messages quickly. Please wait a few minutes, or call us.", 429);

  const raw: unknown = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") return jsonError("That request was not understood.", 400);
  // Bot trap: a hidden field a person never fills. Pretend it worked.
  if (typeof (raw as { website?: unknown }).website === "string" && (raw as { website: string }).website !== "") {
    return NextResponse.json({ ok: true, reply: "Thank you.", sessionId: null, needsOwner: false, suggestions: [], fallback: false, leadSaved: false });
  }
  const parsed = chatInput.safeParse(raw);
  if (!parsed.success) return jsonError("Please type a message of up to 800 characters.", 400);
  // Photos cost more to read, so they have their own, lower limit.
  if (parsed.data.image && !(await rateLimitAllow(`chat-photo:${ip}`, 6, 600))) return jsonError("You have sent several photos. Please wait a few minutes, or call us.", 429);

  try {
    return NextResponse.json(await chatTurn(parsed.data));
  } catch (error) {
    console.error("[chat] failed", error);
    return jsonError("The assistant could not answer. Please call us or message us on WhatsApp.", 500);
  }
}
