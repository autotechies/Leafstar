"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/session";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form-state";
import { normalizeFacebook, normalizeGstin, normalizeInstagram, normalizePhone } from "@/lib/formats";
import type { Database } from "@/types/database";

/*
  Settings saves (AGENTS.md §6 "edits don't overwrite others' edits").
  Business details, alert email and the AI budget live in one row, so each form sends the values it
  showed and saves only if those exact fields are still unchanged: two tabs editing DIFFERENT sections
  never clash, the same section never silently overwrites. Brands and FAQ entries use their updated_at.
*/

const CHANGED_ELSEWHERE = "This was changed somewhere else since you opened the page. Reload to see the latest, then make your change again.";
const SAVE_FAILED = "That couldn't be saved. Check your connection and try again.";

type Supabase = Awaited<ReturnType<typeof supabaseServer>>;
type SettingsUpdate = Database["public"]["Tables"]["business_settings"]["Update"];

/** Optional text: trimmed; empty becomes null. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters`)
    .transform((v) => (v === "" ? null : v));

const optionalFormatted = (normalise: (v: string) => string | null, message: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const out = normalise(v);
      if (out === null) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return out;
    });

/** The values a form displayed when it was opened, sent back for the "unchanged since" check. */
function readOriginal(formData: FormData): Record<string, string | number | boolean | null> {
  try {
    const parsed: unknown = JSON.parse(String(formData.get("original") ?? "{}"));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string | number | boolean | null>) : {};
  } catch {
    return {};
  }
}

/** Updates the single settings row only if every field in `original` still holds that value. */
async function updateSettingsIfUnchanged(
  supabase: Supabase,
  changes: SettingsUpdate,
  original: Record<string, string | number | boolean | null>,
  fields: readonly string[],
): Promise<"saved" | "conflict" | "failed"> {
  let query = supabase.from("business_settings").update(changes).eq("id", true);
  for (const field of fields) {
    const was = field in original ? original[field] : undefined;
    if (was === undefined) return "conflict";
    query = was === null ? query.filter(field, "is", null) : query.filter(field, "eq", String(was));
  }
  const { data, error } = await query.select("id");
  if (error) {
    console.error("[settings] save failed", error.message);
    return "failed";
  }
  return data && data.length === 1 ? "saved" : "conflict";
}

function outcome(result: "saved" | "conflict" | "failed", success: string, values?: Record<string, string>): FormState {
  if (result === "saved") {
    refresh();
    return { status: "success", message: success };
  }
  return { status: "error", message: result === "conflict" ? CHANGED_ELSEWHERE : SAVE_FAILED, values };
}

// ---------- business details ----------

const BUSINESS_FIELDS = ["business_name", "tagline", "phone", "whatsapp", "email", "address", "city", "gstin", "instagram", "facebook", "established_year"] as const;

const businessSchema = z.object({
  business_name: z.string().trim().min(1, "Enter the business name").max(80, "Business name can be at most 80 characters"),
  tagline: z.string().trim().max(120, "Tagline can be at most 120 characters"),
  phone: optionalFormatted(normalizePhone, "Enter a phone number with 10 digits, or with the country code"),
  whatsapp: optionalFormatted(normalizePhone, "Enter the WhatsApp number with 10 digits, or with the country code"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.email("Enter a valid email address").nullable()),
  address: optionalText(300, "Address"),
  city: optionalText(60, "City"),
  gstin: optionalFormatted(normalizeGstin, "That doesn't look like a GSTIN (15 characters, e.g. 27ABCDE1234F1Z5)"),
  instagram: optionalFormatted(normalizeInstagram, "Enter the Instagram username, e.g. @leafstar"),
  facebook: optionalFormatted(normalizeFacebook, "Paste the link to your Facebook page"),
  established_year: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int("Enter a year, like 2016").min(1900, "Enter a year, like 2016").max(2100, "Enter a year, like 2016").nullable()),
});

export async function saveBusinessDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff(undefined, "/admin/settings");
  const values = formValues(formData, BUSINESS_FIELDS);
  const parsed = businessSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error.issues), values };

  const supabase = await supabaseServer();
  const result = await updateSettingsIfUnchanged(supabase, parsed.data, readOriginal(formData), BUSINESS_FIELDS);
  return outcome(result, "Business details saved.", values);
}

// ---------- alerts ----------

export async function saveAlertEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff(undefined, "/admin/settings");
  const values = formValues(formData, ["alert_email"]);
  const parsed = z
    .object({
      alert_email: z
        .string()
        .trim()
        .toLowerCase()
        .transform((v) => (v === "" ? null : v))
        .pipe(z.email("Enter a valid email address").nullable()),
    })
    .safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error.issues), values };

  const supabase = await supabaseServer();
  const result = await updateSettingsIfUnchanged(supabase, parsed.data, readOriginal(formData), ["alert_email"]);
  return outcome(result, "Alert email saved.", values);
}

// ---------- AI budget and pause ----------

export async function saveAiBudget(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff(undefined, "/admin/settings");
  const values = formValues(formData, ["ai_daily_token_budget"]);
  const parsed = z
    .object({
      ai_daily_token_budget: z
        .string()
        .trim()
        .transform((v) => (v === "" ? Number.NaN : Number(v.replace(/[,\s]/g, ""))))
        .pipe(
          z
            .number({ message: "Enter a whole number" })
            .int("Enter a whole number")
            .min(0, "The limit can't be negative")
            .max(1_000_000_000, "That limit is too large"),
        ),
    })
    .safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error.issues), values };

  const supabase = await supabaseServer();
  const result = await updateSettingsIfUnchanged(supabase, parsed.data, readOriginal(formData), ["ai_daily_token_budget"]);
  return outcome(result, "Daily AI limit saved.", values);
}

/** The pause switch sets a state ("paused" or "running"); repeating it is harmless, so no conflict check. */
export async function setAiPaused(paused: boolean): Promise<{ ok: boolean; message: string }> {
  await requireStaff(undefined, "/admin/settings");
  const supabase = await supabaseServer();
  const { error } = await supabase.from("business_settings").update({ ai_paused: paused }).eq("id", true);
  if (error) return { ok: false, message: SAVE_FAILED };
  refresh();
  return { ok: true, message: paused ? "AI is paused. Bill scanning and the chatbot will use their fallbacks." : "AI is running again." };
}

// ---------- brands ----------

const brandName = z.string().trim().min(1, "Enter the brand name").max(60, "Brand name can be at most 60 characters");

function brandError(code: string | undefined): string {
  if (code === "23505") return "A brand with this name already exists (names ignore capitals).";
  if (code === "23503") return "This brand has articles, so it can't be deleted. Turn off \"Show on website\" to hide it instead.";
  return SAVE_FAILED;
}

export async function addBrand(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff(undefined, "/admin/settings");
  const values = formValues(formData, ["name"]);
  const parsed = z.object({ name: brandName }).safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error.issues), values };

  const supabase = await supabaseServer();
  const { error } = await supabase.from("brands").insert({ name: parsed.data.name, is_public: formData.get("is_public") === "on" });
  if (error) return { status: "error", fieldErrors: { name: brandError(error.code) }, values };
  refresh();
  return { status: "success", message: `${parsed.data.name} added.` };
}

export async function renameBrand(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff(undefined, "/admin/settings");
  const values = formValues(formData, ["id", "name", "original_name"]);
  const parsed = z.object({ id: z.uuid(), name: brandName, original_name: z.string() }).safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error.issues), values };

  // Only the name is compared: switching "Show on website" in the meantime is not a conflict.
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("brands")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id)
    .eq("name", parsed.data.original_name)
    .select("id");
  if (error) return { status: "error", fieldErrors: { name: brandError(error.code) }, values };
  if (!data?.length) return { status: "error", message: CHANGED_ELSEWHERE, values };
  refresh();
  return { status: "success", message: "Brand renamed." };
}

export async function setBrandPublic(id: string, isPublic: boolean): Promise<{ ok: boolean; message: string }> {
  await requireStaff(undefined, "/admin/settings");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: SAVE_FAILED };
  const supabase = await supabaseServer();
  const { error } = await supabase.from("brands").update({ is_public: isPublic }).eq("id", id);
  if (error) return { ok: false, message: SAVE_FAILED };
  refresh();
  return {
    ok: true,
    message: isPublic ? "Shown on the website. Its public articles can now appear." : "Hidden from the website. None of its articles will appear.",
  };
}

export async function deleteBrand(id: string): Promise<{ ok: boolean; message: string }> {
  await requireStaff(undefined, "/admin/settings");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: SAVE_FAILED };
  const supabase = await supabaseServer();
  const { error } = await supabase.from("brands").delete().eq("id", id);
  if (error) return { ok: false, message: brandError(error.code) };
  refresh();
  return { ok: true, message: "Brand deleted." };
}

// ---------- FAQ and policies ----------

const faqSchema = z.object({
  topic: optionalText(40, "Topic"),
  question: z.string().trim().min(3, "Write the question as a buyer would ask it").max(200, "Keep the question under 200 characters"),
  answer: z.string().trim().min(2, "Write the answer").max(1500, "Keep the answer under 1,500 characters"),
});

export async function addFaq(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff(undefined, "/admin/settings");
  const values = formValues(formData, ["topic", "question", "answer"]);
  const parsed = faqSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error.issues), values };

  const supabase = await supabaseServer();
  const { data: last } = await supabase.from("faq_entries").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const { error } = await supabase.from("faq_entries").insert({ ...parsed.data, sort_order: (last?.[0]?.sort_order ?? -1) + 1 });
  if (error) return { status: "error", message: SAVE_FAILED, values };
  refresh();
  return { status: "success", message: "Answer added. The chatbot will use it." };
}

export async function updateFaq(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff(undefined, "/admin/settings");
  const values = formValues(formData, ["id", "topic", "question", "answer"]);
  const parsed = faqSchema.extend({ id: z.uuid() }).safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error.issues), values };

  // Compares the topic, question and answer the form showed; pausing the answer meanwhile is not a conflict.
  const original = readOriginal(formData);
  const { id, ...changes } = parsed.data;
  const supabase = await supabaseServer();
  let query = supabase.from("faq_entries").update(changes).eq("id", id);
  for (const field of ["topic", "question", "answer"] as const) {
    if (!(field in original)) return { status: "error", message: CHANGED_ELSEWHERE, values };
    const was = original[field];
    query = was === null ? query.filter(field, "is", null) : query.filter(field, "eq", String(was));
  }
  const { data, error } = await query.select("id");
  if (error) return { status: "error", message: SAVE_FAILED, values };
  if (!data?.length) return { status: "error", message: CHANGED_ELSEWHERE, values };
  refresh();
  return { status: "success", message: "Answer updated." };
}

export async function setFaqActive(id: string, active: boolean): Promise<{ ok: boolean; message: string }> {
  await requireStaff(undefined, "/admin/settings");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: SAVE_FAILED };
  const supabase = await supabaseServer();
  const { error } = await supabase.from("faq_entries").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, message: SAVE_FAILED };
  refresh();
  return { ok: true, message: active ? "The chatbot will use this answer." : "The chatbot will no longer use this answer." };
}

export async function deleteFaq(id: string): Promise<{ ok: boolean; message: string }> {
  await requireStaff(undefined, "/admin/settings");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: SAVE_FAILED };
  const supabase = await supabaseServer();
  const { error } = await supabase.from("faq_entries").delete().eq("id", id);
  if (error) return { ok: false, message: SAVE_FAILED };
  refresh();
  return { ok: true, message: "Answer deleted." };
}
