import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/session";
import type { Photo } from "@/modules/images/types";
import type { ActivityRow, BuyerRow, LeadCard, LeadDetail, LeadItemRow, Stage } from "./types";

type LeadRow = { id: string; name: string; business_name: string | null; phone: string; city: string | null; source: string; stage: string; quoted_amount: number | null; next_follow_up: string | null; created_at: string; updated_at: string };

function toCard(l: LeadRow, itemCount: number): LeadCard {
  return { id: l.id, name: l.name, businessName: l.business_name, phone: l.phone, city: l.city, source: l.source, stage: l.stage as Stage, quotedAmount: l.quoted_amount === null ? null : Number(l.quoted_amount), nextFollowUp: l.next_follow_up, createdAt: l.created_at, updatedAt: l.updated_at, itemCount };
}

const LEAD_COLUMNS = "id, name, business_name, phone, city, source, stage, quoted_amount, next_follow_up, created_at, updated_at";

/** Open leads, plus the 40 most recent Won and 40 most recent Lost, so the board stays quick. */
export async function loadBoard(): Promise<LeadCard[]> {
  await requireStaff(undefined, "/admin/crm");
  const supabase = await supabaseServer();
  const [open, won, lost] = await Promise.all([
    supabase.from("leads").select(LEAD_COLUMNS).not("stage", "in", "(won,lost)").order("created_at", { ascending: false }).limit(500),
    supabase.from("leads").select(LEAD_COLUMNS).eq("stage", "won").order("updated_at", { ascending: false }).limit(40),
    supabase.from("leads").select(LEAD_COLUMNS).eq("stage", "lost").order("updated_at", { ascending: false }).limit(40),
  ]);
  const leads = [...(open.data ?? []), ...(won.data ?? []), ...(lost.data ?? [])] as LeadRow[];
  const ids = leads.map((l) => l.id);
  const { data: items } = ids.length ? await supabase.from("lead_items").select("lead_id").in("lead_id", ids) : { data: [] as Array<{ lead_id: string }> };
  const counts = new Map<string, number>();
  for (const i of items ?? []) counts.set(i.lead_id, (counts.get(i.lead_id) ?? 0) + 1);
  return leads.map((l) => toCard(l, counts.get(l.id) ?? 0));
}

export async function loadLeadDetail(id: string): Promise<LeadDetail | null> {
  const supabase = await supabaseServer();
  const { data: lead } = await supabase.from("leads").select(`${LEAD_COLUMNS}, instagram, message, lost_reason, contact_id`).eq("id", id).maybeSingle();
  if (!lead) return null;
  const [{ data: items }, { data: acts }] = await Promise.all([
    supabase.from("lead_items").select("id, quantity, color_id, article_id, articles(code, name, article_images(id, color_id, thumb_url, medium_url, url, blur_data_url, width, height, sort_order)), article_colors(name)").eq("lead_id", id).order("created_at"),
    supabase.from("lead_activities").select("id, kind, body, created_at").eq("lead_id", id).order("created_at", { ascending: false }).limit(200),
  ]);
  type Img = { id: string; color_id: string | null; thumb_url: string; medium_url: string; url: string; blur_data_url: string | null; width: number | null; height: number | null; sort_order: number };
  const itemRows: LeadItemRow[] = (items ?? []).map((i) => {
    const article = i.articles as unknown as { code: string; name: string; article_images: Img[] } | null;
    const colour = (i.article_colors as unknown as { name: string } | null)?.name ?? null;
    const imgs = (article?.article_images ?? []).filter((x) => !i.color_id || x.color_id === i.color_id || x.color_id === null).sort((a, b) => a.sort_order - b.sort_order);
    const photos: Photo[] = imgs.map((x, n) => ({ id: x.id, thumbUrl: x.thumb_url, mediumUrl: x.medium_url, url: x.url, blurDataUrl: x.blur_data_url, width: x.width ?? 1600, height: x.height ?? 2000, alt: `${article?.name ?? "Article"}, photo ${n + 1}` }));
    return { id: i.id, articleCode: article?.code ?? "", articleName: article?.name ?? "Removed article", colour, quantity: i.quantity, photos };
  });
  const activities: ActivityRow[] = (acts ?? []).map((a) => ({ id: a.id, kind: a.kind, body: a.body, createdAt: a.created_at }));
  const card = toCard(lead as unknown as LeadRow, itemRows.length);
  const extra = lead as unknown as { instagram: string | null; message: string | null; lost_reason: string | null; contact_id: string | null };
  return { ...card, instagram: extra.instagram, message: extra.message, lostReason: extra.lost_reason, contactId: extra.contact_id, items: itemRows, activities };
}

export async function loadBuyers(): Promise<BuyerRow[]> {
  await requireStaff(undefined, "/admin/crm/buyers");
  const supabase = await supabaseServer();
  const { data: contacts } = await supabase.from("contacts").select("id, name, business_name, phone, email, instagram, city, gstin, credit_limit, payment_terms_days, notes").contains("roles", ["buyer"]).eq("is_active", true).order("name").limit(1000);
  const ids = (contacts ?? []).map((c) => c.id);
  const { data: bills } = ids.length ? await supabase.from("bills").select("id, bill_number, bill_date, total_amount, contact_id, applied_at").eq("status", "applied").in("contact_id", ids).order("applied_at", { ascending: false }) : { data: [] as Array<{ id: string; bill_number: string | null; bill_date: string | null; total_amount: number | null; contact_id: string | null; applied_at: string | null }> };
  const billIds = (bills ?? []).map((b) => b.id);
  const { data: lines } = billIds.length ? await supabase.from("bill_items").select("bill_id, qty").in("bill_id", billIds) : { data: [] as Array<{ bill_id: string; qty: number }> };
  const pieces = new Map<string, number>();
  for (const l of lines ?? []) pieces.set(l.bill_id, (pieces.get(l.bill_id) ?? 0) + l.qty);
  return (contacts ?? []).map((c) => {
    const mine = (bills ?? []).filter((b) => b.contact_id === c.id);
    const known = mine.filter((b) => b.total_amount !== null);
    return {
      id: c.id, name: c.name, businessName: c.business_name, phone: c.phone, email: c.email, instagram: c.instagram, city: c.city, gstin: c.gstin,
      creditLimit: c.credit_limit === null ? null : Number(c.credit_limit), paymentTermsDays: c.payment_terms_days, notes: c.notes,
      totalPieces: mine.reduce((s, b) => s + (pieces.get(b.id) ?? 0), 0),
      totalValue: known.length ? known.reduce((s, b) => s + Number(b.total_amount), 0) : null,
      billCount: mine.length,
      lastPurchase: mine[0]?.bill_date ?? mine[0]?.applied_at ?? null,
      bills: mine.slice(0, 20).map((b) => ({ id: b.id, billNumber: b.bill_number, billDate: b.bill_date, amount: b.total_amount === null ? null : Number(b.total_amount), pieces: pieces.get(b.id) ?? 0 })),
    };
  });
}
