import "server-only";
import { GoogleGenAI, type Part } from "@google/genai";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env.server";

/*
  The ONE way the app calls Gemini (AGENTS.md §11). Every call:
  1. checks the owner's pause switch and today's token budget (ai_allowed),
  2. runs with a timeout and retries rate-limit / overload errors with a growing pause,
  3. records its token use in ai_usage, whether it worked or not.
  When AI cannot be used it throws AiUnavailableError; callers show their own friendly fallback.
*/

export type AiFeature = "bill_scan" | "chat" | "other";

export class AiUnavailableError extends Error {
  constructor(
    message: string,
    readonly reason: "paused-or-budget" | "not-configured" | "failed",
  ) {
    super(message);
  }
}

export interface GenerateRequest {
  feature: AiFeature;
  /** The scan job or chat session this call belongs to (for the usage log). */
  refId?: string;
  system: string;
  parts: Part[];
  /** JSON Schema: the answer is returned as JSON in this shape. */
  jsonSchema?: unknown;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export interface GenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/** What the wrapper needs from Gemini; tests pass a fake. */
export interface GeminiTransport {
  generate(req: { model: string; system: string; parts: Part[]; jsonSchema?: unknown; temperature: number; maxOutputTokens: number; signal: AbortSignal }): Promise<GenerateResult>;
}

function realTransport(apiKey: string): GeminiTransport {
  const ai = new GoogleGenAI({ apiKey });
  return {
    async generate({ model, system, parts, jsonSchema, temperature, maxOutputTokens, signal }) {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: system,
          temperature,
          maxOutputTokens,
          abortSignal: signal,
          ...(jsonSchema ? { responseMimeType: "application/json", responseJsonSchema: jsonSchema } : {}),
        },
      });
      return {
        text: response.text ?? "",
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      };
    },
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Rate limits (429) and overload (503) are worth waiting for; everything else is not. */
export function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number; code?: number } | null)?.status ?? (error as { code?: number } | null)?.code;
  if (status === 429 || status === 503 || status === 500) return true;
  const message = String((error as Error | null)?.message ?? "");
  return /\b(429|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/i.test(message);
}

export async function generate(req: GenerateRequest, deps: { transport?: GeminiTransport; backoffMs?: number } = {}): Promise<GenerateResult> {
  const admin = supabaseAdmin();
  const env = serverEnv();
  const model = env.GEMINI_MODEL;
  if (!deps.transport && (!env.GEMINI_API_KEY || !model)) {
    throw new AiUnavailableError("The AI is not set up yet.", "not-configured");
  }

  const { data: allowed, error: allowError } = await admin.rpc("ai_allowed");
  if (allowError) throw new AiUnavailableError("Could not check the AI budget.", "failed");
  if (allowed !== true) throw new AiUnavailableError("The AI is paused or today's budget is used up.", "paused-or-budget");

  const transport = deps.transport ?? realTransport(env.GEMINI_API_KEY as string);
  const backoff = deps.backoffMs ?? 1500;
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 55_000);
    try {
      const result = await transport.generate({
        model: model ?? "test-model",
        system: req.system,
        parts: req.parts,
        jsonSchema: req.jsonSchema,
        temperature: req.temperature ?? 0.1,
        maxOutputTokens: req.maxOutputTokens ?? 4096,
        signal: controller.signal,
      });
      await record(req, model, result.inputTokens, result.outputTokens, true, null);
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < 3 && isRetryable(error)) {
        await wait(backoff * 2 ** attempt);
        continue;
      }
      break;
    } finally {
      clearTimeout(timer);
    }
  }
  const message = lastError instanceof Error ? lastError.message : "Unknown error";
  await record(req, model, 0, 0, false, message.slice(0, 300));
  throw new AiUnavailableError("The AI did not answer.", "failed");
}

async function record(req: GenerateRequest, model: string | undefined, input: number, output: number, ok: boolean, error: string | null) {
  const { error: insertError } = await supabaseAdmin().from("ai_usage").insert({
    feature: req.feature,
    model: model ?? null,
    input_tokens: input,
    output_tokens: output,
    ok,
    error,
    ref_id: req.refId ?? null,
  });
  if (insertError) console.error("[ai] could not record usage", insertError);
}
