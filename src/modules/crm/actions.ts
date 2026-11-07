"use server";

import { z } from "zod";
import { normalizeGstin, normalizeInstagram, normalizePhone } from "@/lib/formats";
import { supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/session";
import { loadLeadDetail } from "./queries";
import { STAGES, type LeadDetail } from "./types";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error = "Could not save that. Try again."): { ok: false; error: string } => ({ ok: false, error });
const friendly = (message: string | undefined) => (message && /changed by someone|already has another|Tell us why|no longer exists/.test(message) ? message : "Could not save that. Try again.");

export async function loadLeadAction(id: string): Promise<Result<{ lead: LeadDetail }>> {
  await requireStaff(undefined, "/admin/crm");
  if (!z.uuid().safeParse(id).success) return fail("That lead was not found.");
  const lead = await loadLeadDetail(id);
  return lead ? { ok: true, lead } : fail("That lead was not found.");
}

const moveSchema = z.object({ id: z.uuid(), stage: z.enum(STAGES), reason: z.string().trim().max(300).optional(), expected: z.string().optional() });

export async function moveLeadAction(raw: unknown): Promise<Result<{ updatedAt: string; contactId: string | null }>> {
  await requireStaff(undefined, "/admin/crm");
  const parsed = moveSchema.safeParse(raw);
  if (!parsed.success) return fail();
  if (parsed.data.stage === "lost" && !parsed.data.reason) return fail("Tell us why this lead was lost.");
  const { data, error } = await (await supabaseServer()).rpc("move_lead", { p_lead: parsed.data.id, p_stage: parsed.data.stage, p_reason: parsed.data.reason, p_expected: parsed.data.expected });
  if (error) return fail(friendly(error.message));
  const r = data as { updated_at: string; contact_id: string | null };
  return { ok: true, updatedAt: r.updated_at, contactId: r.contact_id };
}

const newLead = z.object({
  name: z.string().trim().min(1, "Enter the name").max(100),
  phone: z.string().trim().refine((v) => normalizePhone(v) !== null, "Enter a phone number with 10 digits"),
  businessName: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  instagram: z.string().trim().max(60).optional(),
  message: z.string().trim().max(500).optional(),
  nextFollowUp: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

export async function createLeadAction(raw: unknown): Promise<Result<{ leadId: string; existing: boolean }>> {
  await requireStaff(undefined, "/admin/crm");
  const parsed = newLead.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");
  const d = parsed.data;
  const instagram = d.instagram ? normalizeInstagram(d.instagram) : null;
  if (d.instagram && !instagram) return fail("Enter a valid Instagram handle, like leafstar.");
  const { data, error } = await (await supabaseServer()).rpc("create_manual_lead", {
    p: { name: d.name, phone: normalizePhone(d.phone), business_name: d.businessName ?? "", city: d.city ?? "", instagram: instagram ?? "", message: d.message ?? "", next_follow_up: d.nextFollowUp ?? "" },
  });
  if (error) return fail(friendly(error.message));
  const r = data as { lead_id: string; existing: boolean };
  return { ok: true, leadId: r.lead_id, existing: r.existing };
}

const detailsSchema = z.object({
  id: z.uuid(),
  expected: z.string().min(10),
  quotedAmount: z.number().min(0).max(1_000_000_000).nullable(),
  nextFollowUp: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export async function saveLeadDetailsAction(raw: unknown): Promise<Result<{ updatedAt: string }>> {
  const staff = await requireStaff(undefined, "/admin/crm");
  const parsed = detailsSchema.safeParse(raw);
  if (!parsed.success) return fail("Check the amount and the date.");
  const d = parsed.data;
  const supabase = await supabaseServer();
  const { data: before } = await supabase.from("leads").select("quoted_amount, next_follow_up").eq("id", d.id).maybeSingle();
  const { data, error } = await supabase.from("leads").update({ quoted_amount: d.quotedAmount, next_follow_up: d.nextFollowUp }).eq("id", d.id).eq("updated_at", d.expected).select("updated_at");
  if (error) return fail();
  if (!data?.length) return fail("This lead was changed by someone else. Reload and try again.");
  const notes: string[] = [];
  if ((before?.quoted_amount === null ? null : Number(before?.quoted_amount)) !== d.quotedAmount && d.quotedAmount !== null) notes.push(`Quoted ${d.quotedAmount}`);
  if (before?.next_follow_up !== d.nextFollowUp && d.nextFollowUp) notes.push(`Follow up on ${d.nextFollowUp}`);
  for (const body of notes) await supabase.from("lead_activities").insert({ lead_id: d.id, kind: body.startsWith("Quoted") ? "quote" : "follow_up", body, created_by: staff.id });
  return { ok: true, updatedAt: data[0].updated_at };
}

const noteSchema = z.object({ id: z.uuid(), kind: z.enum(["note", "call", "whatsapp"]), body: z.string().trim().min(1, "Write a note").max(1000) });

export async function addActivityAction(raw: unknown): Promise<Result> {
  const staff = await requireStaff(undefined, "/admin/crm");
  const parsed = noteSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Write a note.");
  const { error } = await (await supabaseServer()).from("lead_activities").insert({ lead_id: parsed.data.id, kind: parsed.data.kind, body: parsed.data.body, created_by: staff.id });
  return error ? fail() : { ok: true };
}

const buyerSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, "Enter the name").max(100),
  businessName: z.string().trim().max(120).optional(),
  email: z.string().trim().max(120).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email").optional(),
  city: z.string().trim().max(80).optional(),
  gstin: z.string().trim().max(20).optional(),
  creditLimit: z.number().min(0).max(1_000_000_000).nullable(),
  paymentTermsDays: z.number().int().min(0).max(365).nullable(),
  notes: z.string().trim().max(1000).optional(),
});

export async function saveBuyerAction(raw: unknown): Promise<Result> {
  await requireStaff(undefined, "/admin/crm/buyers");
  const parsed = buyerSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");
  const d = parsed.data;
  let gstin: string | null = null;
  if (d.gstin) {
    gstin = normalizeGstin(d.gstin);
    if (!gstin) return fail("That GSTIN does not look right. It has 15 characters, like 24ABCDE1234F1Z5.");
  }
  const { error } = await (await supabaseServer()).from("contacts").update({
    name: d.name, business_name: d.businessName || null, email: d.email || null, city: d.city || null, gstin,
    credit_limit: d.creditLimit, payment_terms_days: d.paymentTermsDays, notes: d.notes || null,
  }).eq("id", d.id);
  return error ? fail() : { ok: true };
}
