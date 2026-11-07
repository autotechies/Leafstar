import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { AiUnavailableError, type GeminiTransport } from "@/modules/ai/gemini";
import { UnreadableBillError, extractBill } from "./extract";

type Admin = SupabaseClient<Database>;
type Job = Database["public"]["Tables"]["bill_scan_jobs"]["Row"];

export const BILLS_BUCKET = "bills";
export const AI_RETRY_MESSAGE = "AI unavailable. Press Retry, or enter the lines by hand.";

/** Claims and processes ONE queued job. Returns null when the queue is empty. Failures are recorded on the job, never thrown. */
export async function processNextJob(admin: Admin, transport?: GeminiTransport): Promise<{ jobId: string; status: "extracted" | "failed" } | null> {
  const { data: claimed, error } = await admin.rpc("claim_scan_job");
  if (error) throw error;
  const job = claimed as Job | null;
  if (!job || !job.id) return null;

  const fail = async (message: string) => {
    await admin.from("bill_scan_jobs").update({ status: "failed", error: message, finished_at: new Date().toISOString() }).eq("id", job.id);
    return { jobId: job.id, status: "failed" as const };
  };

  const download = await admin.storage.from(BILLS_BUCKET).download(job.file_path);
  if (download.error || !download.data) return fail("The file did not arrive. Upload it again.");
  const bytes = Buffer.from(await download.data.arrayBuffer());

  try {
    const { bill, rawText } = await extractBill({ name: job.file_name ?? "bill", type: job.mime_type ?? "", bytes }, job.id, transport);
    const hash = job.file_hash ?? createHash("sha256").update(bytes).digest("hex");
    if (!job.file_hash) await admin.from("bill_scan_jobs").update({ file_hash: hash }).eq("id", job.id);
    const { error: finishError } = await admin.rpc("finish_scan_job", { p_job: job.id, p: { ...bill, raw_text: rawText } as never });
    if (finishError) {
      console.error("[bills] finish_scan_job failed", finishError);
      return fail("The bill was read but could not be saved. Press Retry.");
    }
    return { jobId: job.id, status: "extracted" };
  } catch (e) {
    if (e instanceof AiUnavailableError) return fail(AI_RETRY_MESSAGE);
    if (e instanceof UnreadableBillError) return fail(e.message);
    console.error("[bills] unexpected failure", e);
    return fail("Something went wrong reading this bill. Press Retry.");
  }
}
