import { beforeEach, describe, expect, it, vi } from "vitest";

/* Bill reading and the Gemini wrapper, with Gemini and Supabase replaced by fakes. */

const usage: Array<Record<string, unknown>> = [];
let allowed = true;
const rpcCalls: Array<{ name: string; args: unknown }> = [];
const jobUpdates: Array<Record<string, unknown>> = [];
let claimed: Record<string, unknown> | null = null;
let fileBytes = Buffer.from("");
let finishError: { message: string } | null = null;

vi.mock("@/lib/env.server", () => ({ serverEnv: () => ({ GEMINI_API_KEY: "k".repeat(12), GEMINI_MODEL: "test-model", SUPABASE_SERVICE_ROLE_KEY: "s".repeat(30) }) }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      if (name === "ai_allowed") return { data: allowed, error: null };
      if (name === "claim_scan_job") return { data: claimed, error: null };
      if (name === "finish_scan_job") return { data: "bill-1", error: finishError };
      return { data: null, error: null };
    },
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        if (table === "ai_usage") usage.push(row);
        return { error: null };
      },
      update: (row: Record<string, unknown>) => {
        jobUpdates.push(row);
        return { eq: async () => ({ error: null }) };
      },
    }),
    storage: { from: () => ({ download: async () => ({ data: new Blob([new Uint8Array(fileBytes)]), error: null }) }) },
  }),
}));

import { AiUnavailableError, generate, isRetryable, type GeminiTransport } from "@/modules/ai/gemini";
import { checkBillFile } from "@/modules/bills/formats";
import { billSchema } from "@/modules/bills/schema";
import { prepareParts, UnreadableBillError } from "@/modules/bills/extract";
import { processNextJob, AI_RETRY_MESSAGE } from "@/modules/bills/process";

const reply = (obj: unknown): GeminiTransport => ({ generate: async () => ({ text: JSON.stringify(obj), inputTokens: 120, outputTokens: 40 }) });

beforeEach(() => {
  usage.length = 0;
  rpcCalls.length = 0;
  jobUpdates.length = 0;
  allowed = true;
  claimed = null;
  finishError = null;
});

describe("which bill files are accepted", () => {
  it("accepts photos, PDF, Word, Excel and CSV", () => {
    for (const [name, kind] of [["a.jpg", "image"], ["a.HEIC", "image"], ["a.pdf", "pdf"], ["a.docx", "docx"], ["a.xlsx", "sheet"], ["a.csv", "sheet"]] as const) {
      expect(checkBillFile(name, "", 1000)).toMatchObject({ ok: true, kind });
    }
  });
  it("refuses old .doc/.xls with instructions, other types, empty and huge files", () => {
    expect(checkBillFile("a.doc", "", 10).error).toMatch(/Save it as \.docx/);
    expect(checkBillFile("a.xls", "", 10).error).toMatch(/Save it as \.xlsx/);
    expect(checkBillFile("a.zip", "", 10).ok).toBe(false);
    expect(checkBillFile("a.pdf", "", 0).ok).toBe(false);
    expect(checkBillFile("a.pdf", "", 21 * 1024 * 1024).ok).toBe(false);
  });
});

describe("the bill answer check", () => {
  it("cleans numbers, dates and units", () => {
    const b = billSchema.parse({ bill_date: "2026-11-01", lines: [{ raw_text: "x", name: "Shirt", qty: "₹1,200", unit: null, rate: "55.5" }] });
    expect(b.lines[0]).toMatchObject({ qty: 1200, unit: "pieces", rate: 55.5 });
    expect(billSchema.parse({ bill_date: "01/11/2026", lines: [] }).bill_date).toBeNull();
    expect(billSchema.safeParse({ lines: [{ raw_text: "x", name: "y", qty: 1, unit: "boxes" }] }).success).toBe(false);
  });
});

describe("reading a CSV bill", () => {
  it("turns the sheet into text for Gemini", async () => {
    const csv = Buffer.from("Item,Colour,Size,Qty\nOxford Shirt,Navy,M,24\nOxford Shirt,Sky,L,12\n");
    const out = await prepareParts({ name: "bill.csv", type: "text/csv", bytes: csv });
    expect(out.text).toContain("Oxford Shirt | Navy | M | 24");
    await expect(prepareParts({ name: "bill.csv", type: "text/csv", bytes: Buffer.from("  \n") })).rejects.toBeInstanceOf(UnreadableBillError);
    await expect(prepareParts({ name: "bill.xls", type: "", bytes: csv })).rejects.toThrow(/\.xlsx/);
  });
});

describe("the Gemini wrapper", () => {
  it("records the tokens of every successful call", async () => {
    const result = await generate({ feature: "bill_scan", refId: "job-1", system: "s", parts: [{ text: "hi" }] }, { transport: reply({ ok: 1 }) });
    expect(result.outputTokens).toBe(40);
    expect(usage).toEqual([expect.objectContaining({ feature: "bill_scan", input_tokens: 120, output_tokens: 40, ok: true, ref_id: "job-1" })]);
  });

  it("refuses without calling Gemini when AI is paused or over budget", async () => {
    allowed = false;
    const transport = { generate: vi.fn() };
    await expect(generate({ feature: "chat", system: "s", parts: [] }, { transport })).rejects.toMatchObject({ reason: "paused-or-budget" });
    expect(transport.generate).not.toHaveBeenCalled();
  });

  it("waits and retries on rate limits, then succeeds", async () => {
    let calls = 0;
    const transport: GeminiTransport = {
      generate: async () => {
        if (++calls < 3) throw Object.assign(new Error("RESOURCE_EXHAUSTED"), { status: 429 });
        return { text: "{}", inputTokens: 1, outputTokens: 1 };
      },
    };
    await generate({ feature: "chat", system: "s", parts: [] }, { transport, backoffMs: 1 });
    expect(calls).toBe(3);
  });

  it("does not retry other errors, and logs the failure", async () => {
    const transport = { generate: vi.fn().mockRejectedValue(new Error("bad request")) };
    await expect(generate({ feature: "chat", system: "s", parts: [] }, { transport, backoffMs: 1 })).rejects.toBeInstanceOf(AiUnavailableError);
    expect(transport.generate).toHaveBeenCalledTimes(1);
    expect(usage[0]).toMatchObject({ ok: false });
    expect(isRetryable(Object.assign(new Error("x"), { status: 503 }))).toBe(true);
    expect(isRetryable(new Error("nope"))).toBe(false);
  });
});

describe("processing one scan job", () => {
  const job = { id: "job-9", file_path: "u/b/x.csv", file_name: "x.csv", mime_type: "text/csv", file_hash: "abc" };
  const csv = "Item,Size,Qty\nOxford Shirt,M,10\n";

  it("returns null when the queue is empty", async () => {
    const admin = (await import("@/lib/supabase/admin")).supabaseAdmin();
    expect(await processNextJob(admin)).toBeNull();
  });

  it("reads the bill and saves it through finish_scan_job", async () => {
    claimed = job;
    fileBytes = Buffer.from(csv);
    const admin = (await import("@/lib/supabase/admin")).supabaseAdmin();
    const out = await processNextJob(admin, reply({ bill_number: "7", lines: [{ raw_text: "Oxford Shirt M 10", name: "Oxford Shirt", size: "M", qty: 10 }] }));
    expect(out).toEqual({ jobId: "job-9", status: "extracted" });
    const finish = rpcCalls.find((c) => c.name === "finish_scan_job");
    expect(finish?.args).toMatchObject({ p_job: "job-9", p: { bill_number: "7", lines: [{ qty: 10, unit: "pieces" }] } });
  });

  it("marks the file 'AI unavailable' with a Retry hint when AI is paused", async () => {
    claimed = job;
    fileBytes = Buffer.from(csv);
    allowed = false;
    const admin = (await import("@/lib/supabase/admin")).supabaseAdmin();
    const out = await processNextJob(admin, reply({}));
    expect(out?.status).toBe("failed");
    expect(jobUpdates.at(-1)).toMatchObject({ status: "failed", error: AI_RETRY_MESSAGE });
  });

  it("gives a clear message when Gemini keeps returning nonsense", async () => {
    claimed = job;
    fileBytes = Buffer.from(csv);
    const admin = (await import("@/lib/supabase/admin")).supabaseAdmin();
    const out = await processNextJob(admin, { generate: async () => ({ text: "not json", inputTokens: 1, outputTokens: 1 }) });
    expect(out?.status).toBe("failed");
    expect(String(jobUpdates.at(-1)?.error)).toMatch(/enter its lines by hand/);
  });
});
