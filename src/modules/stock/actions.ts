"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/session";
import { garmentInfo } from "./constants";
import { friendlyStockError } from "./errors";
import { checkImport, toImportPayload, UnreadableSheetError, type ImportCheck } from "./importer";
import { addStockSchema, newArticleSchema, type ActionResult } from "./schemas";

/*
  Add Stock (Step 4). Every save is ONE database call (create_article_full / add_stock_batch / import_stock),
  so a failure leaves nothing behind. Every success returns the batch id for the 15-second Undo.
*/

const today = () => new Date().toISOString().slice(0, 10);
const batchCode = (prefix: string) => `${prefix}-${today().replaceAll("-", "")}-${randomBytes(2).toString("hex").toUpperCase()}`;

function invalid(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>): { ok: false; error: string; fieldErrors: Record<string, string> } {
  // Full path as the key ("article.code", "colours.2.name") so the form can show each message under its field.
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  const first = Object.values(fieldErrors)[0];
  return { ok: false, error: first ? `Check the form: ${first}` : "Something is not right. Check the highlighted fields.", fieldErrors };
}

export async function createArticleAction(input: unknown): Promise<ActionResult<{ articleId: string; batchId: string; pieces: number }>> {
  await requireStaff(undefined, "/admin/stock/add");
  const parsed = newArticleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const v = parsed.data;
  const garment = garmentInfo(v.article.garment);
  if (!garment) return { ok: false, error: "Choose Shirt or Pant." };

  const batch = { code: batchCode("B"), produced_on: v.producedOn, notes: v.notes ?? null };
  const payload = {
    article: {
      code: v.article.code,
      name: v.article.name,
      category: garment.category,
      garment: v.article.garment,
      style: v.article.style ?? null,
      brand_id: v.article.brandId,
      fabric: v.article.fabric ?? null,
      pattern: v.article.pattern ?? null,
      description: v.article.description ?? null,
      moq: v.article.moq,
      lot_size: v.article.lotSize,
      is_public: v.article.isPublic,
      is_featured: v.article.isFeatured,
    },
    sizes: v.sizes,
    colors: v.colours.map((c) => ({
      name: c.name,
      code: c.code,
      hex: c.hex,
      images: c.photos.map((p) => ({ thumb_url: p.thumbUrl, medium_url: p.mediumUrl, url: p.url, blur_data_url: p.blurDataUrl, width: p.width, height: p.height })),
      stock: Object.fromEntries(Object.entries(c.stock).filter(([, q]) => q > 0)),
    })),
    batch,
  };

  const supabase = await supabaseServer();
  const { data: articleId, error } = await supabase.rpc("create_article_full", { p: payload });
  if (error || !articleId) {
    console.error("[stock] create_article_full", error?.message);
    return { ok: false, error: friendlyStockError(error?.message) };
  }
  const { data: batchRow } = await supabase.from("batches").select("id").eq("code", batch.code).single();
  const pieces = v.colours.reduce((s, c) => s + Object.values(c.stock).reduce((a, b) => a + b, 0), 0);
  return { ok: true, articleId, batchId: batchRow?.id ?? "", pieces };
}

export async function addStockAction(input: unknown): Promise<ActionResult<{ batchId: string; pieces: number }>> {
  await requireStaff(undefined, "/admin/stock/add");
  const parsed = addStockSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const v = parsed.data;
  const supabase = await supabaseServer();
  const { data: batchId, error } = await supabase.rpc("add_stock_batch", {
    p: { batch: { code: batchCode("B-ADD"), produced_on: v.producedOn, notes: v.notes ?? null }, rows: v.rows.map((r) => ({ variant_id: r.variantId, qty: r.qty })) },
  });
  if (error || !batchId) {
    console.error("[stock] add_stock_batch", error?.message);
    return { ok: false, error: friendlyStockError(error?.message) };
  }
  return { ok: true, batchId, pieces: v.rows.reduce((s, r) => s + r.qty, 0) };
}

const undoSchema = z.object({ batchId: z.uuid(), archiveArticleId: z.uuid().nullable().optional() });

export async function undoStockEntryAction(input: unknown): Promise<ActionResult<{ entries: number }>> {
  await requireStaff(undefined, "/admin/stock/add");
  const parsed = undoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That entry could not be found." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("undo_batch", { p_batch_id: parsed.data.batchId, ...(parsed.data.archiveArticleId ? { p_archive_article: parsed.data.archiveArticleId } : {}) });
  if (error) {
    console.error("[stock] undo_batch", error.message);
    return { ok: false, error: friendlyStockError(error.message) };
  }
  return { ok: true, entries: data ?? 0 };
}

export async function nextArticleCodeAction(garment: string): Promise<ActionResult<{ code: string }>> {
  await requireStaff(undefined, "/admin/stock/add");
  const info = garmentInfo(garment);
  if (!info) return { ok: false, error: "Choose Shirt or Pant first." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("next_article_code", { p_type: info.typeCode });
  if (error || !data) return { ok: false, error: friendlyStockError(error?.message) };
  return { ok: true, code: data };
}

/* ---------- Excel import: check first (saves nothing), then import the same file ---------- */

async function readUpload(formData: FormData): Promise<{ buffer: Buffer; name: string } | string> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return "Choose an Excel (.xlsx) or CSV file first.";
  return { buffer: Buffer.from(await file.arrayBuffer()), name: file.name };
}

export async function checkImportAction(formData: FormData): Promise<ActionResult<{ check: ImportCheck }>> {
  await requireStaff(undefined, "/admin/stock/add");
  const upload = await readUpload(formData);
  if (typeof upload === "string") return { ok: false, error: upload };
  const supabase = await supabaseServer();
  const { data: brands } = await supabase.from("brands").select("id, name");
  try {
    const check = await checkImport(upload.buffer, upload.name, brands ?? []);
    return { ok: true, check };
  } catch (error) {
    if (error instanceof UnreadableSheetError) return { ok: false, error: error.message };
    console.error("[stock] checkImport", error);
    return { ok: false, error: "This file could not be read. Use the template: .xlsx or .csv." };
  }
}

export async function commitImportAction(formData: FormData): Promise<ActionResult<{ batchId: string; pieces: number; articles: number }>> {
  await requireStaff(undefined, "/admin/stock/add");
  const upload = await readUpload(formData);
  if (typeof upload === "string") return { ok: false, error: upload };
  const supabase = await supabaseServer();
  const { data: brands } = await supabase.from("brands").select("id, name");
  let check: ImportCheck;
  try {
    check = await checkImport(upload.buffer, upload.name, brands ?? []);
  } catch (error) {
    return { ok: false, error: error instanceof UnreadableSheetError ? error.message : "This file could not be read." };
  }
  // The file is checked again here: the browser's earlier "all good" is never trusted.
  if (check.problems.length > 0) return { ok: false, error: `${check.problems.length} row(s) still have problems. Fix the file and check it again.` };

  const payload = toImportPayload(check.rows, { code: batchCode("IMP"), producedOn: today(), notes: `Excel import: ${upload.name}`.slice(0, 200) });
  const { data: batchId, error } = await supabase.rpc("import_stock", { p: payload });
  if (error || !batchId) {
    console.error("[stock] import_stock", error?.message);
    return { ok: false, error: friendlyStockError(error?.message) };
  }
  return { ok: true, batchId, pieces: check.summary.pieces, articles: check.summary.articles };
}
