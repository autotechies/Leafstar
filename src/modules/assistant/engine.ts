import "server-only";
import { z } from "zod";
import { AiUnavailableError, generate } from "@/modules/ai/gemini";
import { rateLimitAllow } from "@/lib/rate-limit";
import { requireStaff } from "@/modules/auth/session";
import { buildSnapshot } from "./context";
import { ASSISTANT_JSON_SCHEMA, buildAssistantPrompt } from "./prompt";
import type { AssistantLink, AssistantReply, AssistantTurn } from "./types";

const modelAnswer = z.object({
  reply: z.string().min(1).max(4000),
  links: z.array(z.object({ label: z.string(), href: z.string() })).max(6).default([]),
  quick_replies: z.array(z.string()).max(6).default([]),
});

/** Only real admin screens: a path that starts with /admin, no other site, no tricks. */
const SAFE_ADMIN_HREF = /^\/admin(?:\/[A-Za-z0-9_-]+)*(?:\?[A-Za-z0-9_=&.%-]*)?$/;
export function safeLinks(links: Array<{ label: string; href: string }>): AssistantLink[] {
  return links
    .filter((l) => SAFE_ADMIN_HREF.test(l.href.trim()) && l.label.trim())
    .map((l) => ({ label: l.label.trim().slice(0, 40), href: l.href.trim() }))
    .slice(0, 3);
}

export const REST_MESSAGE = "I can't think right now (the AI is paused or its daily limit is used up). The \"Since last visit\" tab above still shows what changed, and every screen works as normal.";

export async function askAssistant(input: { message: string; history: AssistantTurn[] }): Promise<AssistantReply> {
  const staff = await requireStaff();
  const message = input.message.trim().slice(0, 600);
  if (!message) return { reply: "Type a question first.", links: [], quickReplies: [], fallback: true };
  if (!(await rateLimitAllow(`assistant:${staff.id}`, 40, 600))) {
    return { reply: "You are asking very quickly. Please wait a few minutes.", links: [], quickReplies: [], fallback: true };
  }
  try {
    const system = buildAssistantPrompt({ ownerName: staff.name, snapshot: await buildSnapshot() });
    const turns = input.history.slice(-8).map((t) => `${t.role === "user" ? "Owner" : "Assistant"}: ${t.text.slice(0, 1200)}`);
    const result = await generate({
      feature: "other",
      system,
      parts: [{ text: `Conversation so far:\n${turns.join("\n")}\nOwner: ${message}\n\nWrite the assistant's next reply.` }],
      jsonSchema: ASSISTANT_JSON_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 2048,
      timeoutMs: 25_000,
    });
    const parsed = modelAnswer.safeParse(JSON.parse(result.text));
    if (!parsed.success) throw new Error("Unreadable answer");
    return {
      reply: parsed.data.reply,
      links: safeLinks(parsed.data.links),
      quickReplies: parsed.data.quick_replies.map((q) => q.trim().slice(0, 60)).filter(Boolean).slice(0, 3),
      fallback: false,
    };
  } catch (error) {
    if (!(error instanceof AiUnavailableError)) console.error("[assistant] turn failed", error);
    return { reply: REST_MESSAGE, links: [], quickReplies: [], fallback: true };
  }
}
