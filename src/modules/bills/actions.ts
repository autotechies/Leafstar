"use server";

import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/session";
import { friendlyBillError } from "./errors";
import { checkBillFile } from "./formats";
import { CONFIDENT } from "./types";

/*
  Bill scanning actions (Step 7). Applying a bill is ONE database call (save_bill_draft with apply = true):
  stock drops, the correction is learned and the buyer is linked, or nothing changes at all.
*/

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const fileSchema = z.object({ path: z.string().min(10).max(300), name: z.string().min(1).max(200), type: z.string().max(100), size: z.number().int().positive(), hash: z.string().regex(/^[a-f0-9]{64}$/).nullable() });

export async function checkDuplicateFilesAction(hashes: string[]): Promise<Result<{ duplicates: string[] }>> {
  await requireStaff(undefined, "/admin/bills/scan");
  const clean = hashes.filter((h) => /^[a-f0-9]{64}$/.test(h)).slice(0, 500);
  if (!clean.length) return { ok: true, duplicates: [] };
  const supabase = await supabaseServer();
  const [{ data: bills }, { data: jobs }] = await Promise.all([
    supabase.from("bills").select("file_hash").eq("status", "applied").in("file_hash", clean),
    supabase.from("bill_scan_jobs").select("file_hash").in("file_hash", clean),
  ]);
  const found = new Set([...(bills ?? []).map((b) => b.file_hash), ...(jobs ?? []).map((j) => j.file_hash)].filter((h): h is string => Boolean(h)));
  return { ok: true, duplicates: [...found] };
}

export async function createScanJobsAction(input: unknown): Promise<Result<{ count: number }>> {
  const staff = await requireStaff(undefined, "/admin/bills/scan");
  const parsed = z.object({ batch: z.uuid(), files: z.array(fileSchema).min(1).max(100) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Those files were not understood. Try again." };
  const rows = [];
  for (const f of parsed.data.files) {
    const check = checkBillFile(f.name, f.type, f.size);
    if (!check.ok) return { ok: false, error: `${f.name}: ${check.error}` };
    // A person may only queue files they uploaded themselves.
    if (!f.path.startsWith(`${staff.id}/`) || f.path.includes("..")) return { ok: false, error: "That upload was refused." };
    rows.push({ batch_ref: parsed.data.batch, file_path: f.path, file_name: f.name, mime_type: check.mime ?? f.type, file_size: f.size, file_hash: f.hash, created_by: staff.id });
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.from("bill_scan_jobs").insert(rows);
  if (error) return { ok: false, error: "Could not queue the bills. Try again." };
  return { ok: true, count: rows.length };
}

export async function retryScanJobAction(jobId: string): Promise<Result> {
  await requireStaff(undefined, "/admin/bills/scan");
  const supabase = await supabaseServer();
  const { error, data } = await supabase.from("bill_scan_jobs").update({ status: "queued", error: null, attempts: 0, finished_at: null }).eq("id", jobId).eq("status", "failed").select("id");
  if (error || !data?.length) return { ok: false, error: "That bill cannot be retried." };
  return { ok: true };
}

export async function discardScanJobAction(jobId: string): Promise<Result> {
  await requireStaff(undefined, "/admin/bills/scan");
  const supabase = await supabaseServer();
  const { data: job } = await supabase.from("bill_scan_jobs").select("id, bill_id, file_path").eq("id", jobId).maybeSingle();
  if (!job) return { ok: false, error: "That bill is already gone." };
  if (job.bill_id) {
    const { data: bill } = await supabase.from("bills").select("status").eq("id", job.bill_id).maybeSingle();
    if (bill && bill.status !== "draft") return { ok: false, error: "An applied bill cannot be discarded. Undo it from Bills instead." };
    await supabase.from("bills").delete().eq("id", job.bill_id).eq("status", "draft");
  }
  await supabase.from("bill_scan_jobs").delete().eq("id", jobId);
  await supabase.storage.from("bills").remove([job.file_path]);
  return { ok: true };
}

/** For a bill the AI could not read: an empty draft that keeps the file attached, so the owner can type the lines. */
export async function startManualBillAction(jobId: string): Promise<Result<{ billId: string }>> {
  await requireStaff(undefined, "/admin/bills/scan");
  const supabase = await supabaseServer();
  const { data: job } = await supabase.from("bill_scan_jobs").select("id, file_path, file_hash, status, bill_id").eq("id", jobId).maybeSingle();
  if (!job) return { ok: false, error: "That bill is gone." };
  if (job.bill_id) return { ok: true, billId: job.bill_id };
  const { data: bill, error } = await supabase.from("bills").insert({ file_path: job.file_path, file_hash: job.file_hash, status: "draft" }).select("id").single();
  if (error || !bill) return { ok: false, error: "Could not start the bill. Try again." };
  const { error: linkError } = await supabase.from("bill_scan_jobs").update({ status: "extracted", bill_id: bill.id, error: null, finished_at: new Date().toISOString() }).eq("id", jobId);
  if (linkError) {
    await supabase.from("bills").delete().eq("id", bill.id);
    return { ok: false, error: "Could not start the bill. Try again." };
  }
  return { ok: true, billId: bill.id };
}

const itemSchema = z.object({
  variantId: z.uuid().nullable(),
  rawText: z.string().max(500),
  name: z.string().max(200),
  colour: z.string().max(100),
  size: z.string().max(20),
  qty: z.number().int().min(1, "Every line needs a quantity of at least 1").max(1_000_000),
  rate: z.number().nonnegative().nullable(),
  amount: z.number().nonnegative().nullable(),
  method: z.string().max(20).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  learn: z.boolean(),
});
const saveSchema = z.object({
  billId: z.uuid(),
  billNumber: z.string().trim().max(60),
  billDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Enter a valid date"),
  buyerName: z.string().trim().max(120),
  items: z.array(itemSchema).max(200),
  apply: z.boolean(),
});

export async function saveBillAction(input: unknown): Promise<Result<{ billId: string; applied: boolean }>> {
  await requireStaff(undefined, "/admin/bills");
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the bill and try again." };
  const v = parsed.data;
  if (v.apply && v.items.length === 0) return { ok: false, error: "Add at least one line to the bill." };
  if (v.apply && v.items.some((i) => !i.variantId)) return { ok: false, error: "Some lines are not matched to an article yet. Choose one for each." };
  const supabase = await supabaseServer();
  const payload = {
    bill_number: v.billNumber,
    bill_date: v.billDate,
    buyer_name: v.buyerName,
    items: v.items.map((i) => ({ variant_id: i.variantId, raw_text: i.rawText, name: i.name, colour: i.colour, size: i.size, qty: i.qty, rate: i.rate, amount: i.amount, method: i.method, confidence: i.confidence, learn: i.learn })),
  };
  const { error } = await supabase.rpc("save_bill_draft", { p_bill: v.billId, p: payload, p_apply: v.apply });
  if (error) return { ok: false, error: friendlyBillError(error.message) };
  return { ok: true, billId: v.billId, applied: v.apply };
}

export async function undoBillAction(billId: string): Promise<Result> {
  await requireStaff(undefined, "/admin/bills");
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("undo_bill", { p_bill_id: billId });
  if (error) return { ok: false, error: friendlyBillError(error.message) };
  return { ok: true };
}

/** Applies every draft whose lines are all matched with high confidence. Each bill stands alone: one failing never blocks the others. */
export async function approveConfidentAction(): Promise<Result<{ applied: number; skipped: Array<{ name: string; reason: string }> }>> {
  await requireStaff(undefined, "/admin/bills/scan");
  const supabase = await supabaseServer();
  const { data: drafts } = await supabase.from("bills").select("id, bill_number, bill_date, buyer_name_raw, file_hash").eq("status", "draft");
  if (!drafts?.length) return { ok: true, applied: 0, skipped: [] };
  const { data: items } = await supabase.from("bill_items").select("*").in("bill_id", drafts.map((d) => d.id));
  let applied = 0;
  const skipped: Array<{ name: string; reason: string }> = [];
  for (const d of drafts) {
    const lines = (items ?? []).filter((i) => i.bill_id === d.id);
    const name = d.bill_number ?? "Bill";
    if (!lines.length || lines.some((l) => !l.variant_id || (l.match_confidence ?? 0) < CONFIDENT)) continue; // needs a human look; not an error
    const { error } = await supabase.rpc("save_bill_draft", {
      p_bill: d.id,
      p: {
        bill_number: d.bill_number ?? "", bill_date: d.bill_date ?? "", buyer_name: d.buyer_name_raw ?? "",
        items: lines.map((l) => ({ variant_id: l.variant_id, raw_text: l.raw_text, name: l.extracted_name, colour: l.extracted_color, size: l.extracted_size, qty: l.qty, rate: l.rate, amount: l.amount, method: l.match_method, confidence: l.match_confidence, learn: false })),
      },
      p_apply: true,
    });
    if (error) skipped.push({ name, reason: friendlyBillError(error.message) });
    else applied += 1;
  }
  return { ok: true, applied, skipped };
}

/** The queue as the scan page polls it. */
export async function loadQueueAction() {
  const { loadQueue } = await import("./queries");
  return loadQueue();
}
