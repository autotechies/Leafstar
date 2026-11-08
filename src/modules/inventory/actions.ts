"use server";

import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/session";
import { friendlyStockError } from "@/modules/stock/errors";
import { colourSchema, photoSchema, type ActionResult } from "@/modules/stock/schemas";
import { SIZE_OPTIONS } from "@/modules/stock/constants";

/*
  Inventory actions (Step 5). Stock is only ever changed by adding ledger entries (deltas), never by overwriting
  a number, so two people (or a person and a bill) changing the same cell at once both count.
  Edits to an article send the updated_at they saw and save only if it is unchanged.
*/

const CHANGED = "This article was changed somewhere else since you opened it. Reload to see the latest, then try again.";
const FAIL = "That couldn't be saved. Check your connection and try again.";
const path = (code: string) => `/admin/inventory/${encodeURIComponent(code)}`;

const adjustSchema = z.object({
  code: z.string(),
  variantId: z.uuid(),
  mode: z.enum(["change", "count"]),
  value: z.number().int("Whole pieces only").min(-1_000_000).max(1_000_000),
  note: z.string().trim().min(3, "Write a short reason (at least 3 letters)").max(300),
});

export async function adjustStockAction(input: unknown): Promise<ActionResult<{ movementId: string; delta: number; now: number }>> {
  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const v = parsed.data;
  const staff = await requireStaff(undefined, path(v.code));
  const supabase = await supabaseServer();

  const current = await supabase.from("variants").select("stock").eq("id", v.variantId).maybeSingle();
  if (current.error || !current.data) return { ok: false, error: "That size could not be found." };
  if (v.mode === "count" && v.value < 0) return { ok: false, error: "A count cannot be negative." };
  const delta = v.mode === "count" ? v.value - current.data.stock : v.value;
  if (delta === 0) return { ok: false, error: v.mode === "count" ? "That is already the count. Nothing to change." : "Enter a change other than 0." };

  const { data, error } = await supabase
    .from("stock_movements")
    .insert({ variant_id: v.variantId, qty_change: delta, reason: "adjustment", note: v.note, created_by: staff.id })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[inventory] adjust", error?.message);
    return { ok: false, error: /stock/.test(error?.message ?? "") ? "That would take stock below zero, so nothing was changed." : FAIL };
  }
  return { ok: true, movementId: data.id, delta, now: current.data.stock + delta };
}

export async function undoMovementAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ code: z.string(), movementId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That entry could not be found." };
  await requireStaff(undefined, path(parsed.data.code));
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("undo_movement", { p_movement_id: parsed.data.movementId });
  if (error) {
    console.error("[inventory] undo", error.message);
    const m = error.message;
    if (/already undone/.test(m)) return { ok: false, error: "This entry was already undone." };
    if (/below|stock/i.test(m)) return { ok: false, error: "Undoing this would take stock below zero, so nothing was changed." };
    return { ok: false, error: friendlyStockError(m) };
  }
  return { ok: true };
}

const detailsSchema = z.object({
  code: z.string(),
  articleId: z.uuid(),
  updatedAt: z.string(),
  name: z.string().trim().min(2, "Give the article a name").max(80),
  brandId: z.uuid("Choose a brand"),
  style: z.string().trim().max(40),
  fabric: z.string().trim().max(60),
  pattern: z.string().trim().max(60),
  description: z.string().trim().max(1000),
  moq: z.number().int().min(1, "At least 1 piece").max(100_000),
  lotSize: z.number().int().min(1).max(100_000).nullable(),
  isFeatured: z.boolean(),
});

export async function updateArticleAction(input: unknown): Promise<ActionResult> {
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const v = parsed.data;
  await requireStaff(undefined, path(v.code));
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("articles")
    .update({
      name: v.name, brand_id: v.brandId, style: v.style || null, fabric: v.fabric || null, pattern: v.pattern || null,
      description: v.description || null, moq: v.moq, lot_size: v.lotSize, is_featured: v.isFeatured,
    })
    .eq("id", v.articleId)
    .eq("updated_at", v.updatedAt)
    .select("id");
  if (error) {
    console.error("[inventory] update", error.message);
    return { ok: false, error: FAIL };
  }
  if (!data || data.length === 0) return { ok: false, error: CHANGED };
  return { ok: true };
}

const stateSchema = z.object({
  code: z.string(),
  articleId: z.uuid(),
  updatedAt: z.string(),
  change: z.enum(["publish", "hide", "archive", "restore"]),
});

/** Publish / hide from the website, archive / restore. Archiving also hides. The database enforces the publish rules. */
export async function setArticleStateAction(input: unknown): Promise<ActionResult> {
  const parsed = stateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Request not understood." };
  const v = parsed.data;
  await requireStaff(undefined, path(v.code));
  const patch = v.change === "publish" ? { is_public: true } : v.change === "hide" ? { is_public: false } : v.change === "archive" ? { is_active: false, is_public: false } : { is_active: true };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("articles").update(patch).eq("id", v.articleId).eq("updated_at", v.updatedAt).select("id");
  if (error) {
    console.error("[inventory] state", error.message);
    return { ok: false, error: friendlyStockError(error.message) };
  }
  if (!data || data.length === 0) return { ok: false, error: CHANGED };
  return { ok: true };
}

/* ---------- Delete an article that has no real history (migration 013) ---------- */

const reportSchema = z.object({
  code: z.string(),
  name: z.string(),
  can_delete: z.boolean(),
  blockers: z.array(z.string()),
  colours: z.number(),
  photos: z.number(),
  entries: z.number(),
  pieces: z.number(),
});

export interface DeleteReport {
  code: string;
  name: string;
  canDelete: boolean;
  /** Plain-English reasons the article must be kept (empty when it can be deleted). */
  blockers: string[];
  colours: number;
  photos: number;
  /** The owner's own stock entries that would be removed with it. */
  entries: number;
  pieces: number;
}

async function loadDeleteReport(articleId: string): Promise<DeleteReport | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("article_delete_report", { p_article_id: articleId });
  if (error) {
    console.error("[inventory] delete report", error.message);
    return null;
  }
  const parsed = reportSchema.safeParse(data);
  if (!parsed.success) return null;
  const r = parsed.data;
  return { code: r.code, name: r.name, canDelete: r.can_delete, blockers: r.blockers, colours: r.colours, photos: r.photos, entries: r.entries, pieces: r.pieces };
}

/** What deleting would remove, and what (if anything) means it must be archived instead. Changes nothing. */
export async function checkArticleDeleteAction(input: unknown): Promise<ActionResult<{ report: DeleteReport }>> {
  const parsed = z.object({ code: z.string(), articleId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That article could not be found." };
  await requireStaff(undefined, path(parsed.data.code));
  const report = await loadDeleteReport(parsed.data.articleId);
  if (!report) return { ok: false, error: "That article could not be checked. Reload and try again." };
  return { ok: true, report };
}

const deleteSchema = z.object({ code: z.string(), articleId: z.uuid(), updatedAt: z.string(), confirm: z.string() });

/**
 * Deletes an article only when nothing real depends on it (no bills, no leads, no sales or returns).
 * The owner must type the article code. The database re-checks every rule and does the delete in one step.
 */
export async function deleteArticleAction(input: unknown): Promise<ActionResult<{ code: string; name: string }>> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Request not understood." };
  const v = parsed.data;
  await requireStaff(undefined, path(v.code));

  const report = await loadDeleteReport(v.articleId);
  if (!report) return { ok: false, error: "That article could not be checked. Reload and try again." };
  if (!report.canDelete) return { ok: false, error: `This article has history that must be kept: ${report.blockers.join("; ")}. Archive it instead.` };
  if (v.confirm.trim().toUpperCase() !== report.code.toUpperCase()) return { ok: false, error: "Type the article code exactly as shown to confirm." };

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("delete_article", { p_article_id: v.articleId, p_updated_at: v.updatedAt });
  if (error) {
    console.error("[inventory] delete", error.message);
    if (/changed since you opened it/.test(error.message)) return { ok: false, error: CHANGED };
    if (/must be kept/.test(error.message)) return { ok: false, error: "This article now has history that must be kept. Archive it instead." };
    return { ok: false, error: FAIL };
  }
  return { ok: true, code: report.code, name: report.name };
}

const addColourSchema = z.object({ code: z.string(), articleId: z.uuid(), colour: colourSchema.omit({ stock: true }).extend({ stock: z.record(z.string(), z.number().int().min(0).max(1_000_000)) }) });

export async function addColourAction(input: unknown): Promise<ActionResult> {
  const parsed = addColourSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const v = parsed.data;
  await requireStaff(undefined, path(v.code));
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("add_colour", {
    p: {
      article_id: v.articleId, name: v.colour.name, code: v.colour.code, hex: v.colour.hex,
      images: v.colour.photos.map((p) => ({ thumb_url: p.thumbUrl, medium_url: p.mediumUrl, url: p.url, blur_data_url: p.blurDataUrl, width: p.width, height: p.height })),
      stock: Object.fromEntries(Object.entries(v.colour.stock).filter(([k, q]) => q > 0 && (SIZE_OPTIONS as readonly string[]).includes(k))),
    },
  });
  if (error) {
    console.error("[inventory] add colour", error.message);
    return { ok: false, error: friendlyStockError(error.message) };
  }
  return { ok: true };
}

export async function addSizeAction(input: unknown): Promise<ActionResult<{ added: number }>> {
  const parsed = z.object({ code: z.string(), articleId: z.uuid(), size: z.enum(SIZE_OPTIONS) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a size." };
  await requireStaff(undefined, path(parsed.data.code));
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("add_size", { p_article_id: parsed.data.articleId, p_size: parsed.data.size });
  if (error) return { ok: false, error: /already exists/.test(error.message) ? "This size already exists for every colour." : FAIL };
  return { ok: true, added: data ?? 0 };
}

export async function replacePhotosAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ code: z.string(), colourId: z.uuid(), photos: z.array(photoSchema).min(1, "Add at least one photo").max(12) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Add at least one photo." };
  await requireStaff(undefined, path(parsed.data.code));
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("set_colour_photos", {
    p_color_id: parsed.data.colourId,
    p_images: parsed.data.photos.map((p) => ({ thumb_url: p.thumbUrl, medium_url: p.mediumUrl, url: p.url, blur_data_url: p.blurDataUrl, width: p.width, height: p.height })),
  });
  if (error) {
    console.error("[inventory] photos", error.message);
    return { ok: false, error: FAIL };
  }
  return { ok: true };
}
