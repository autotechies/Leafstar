import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/session";

/*
  One search box for SKU, article, buyer, lead and bill (AGENTS.md §14). Typing a full variant SKU shows that variant's
  stock, its latest movements, the bills it appeared on and the leads that asked for its article.
*/

export interface VariantHit { id: string; sku: string; stock: number; size: string; colour: string; articleCode: string; articleName: string }
export interface SearchResults {
  q: string;
  articles: Array<{ code: string; name: string; garment: string }>;
  variants: VariantHit[];
  leads: Array<{ id: string; name: string; phone: string; stage: string; businessName: string | null }>;
  buyers: Array<{ id: string; name: string; phone: string | null; businessName: string | null }>;
  bills: Array<{ id: string; billNumber: string | null; billDate: string | null; status: string }>;
  exact: null | {
    variant: VariantHit;
    movements: Array<{ id: string; qty: number; reason: string; note: string | null; at: string; billId: string | null }>;
    bills: Array<{ id: string; billNumber: string | null; billDate: string | null; status: string }>;
    leads: Array<{ id: string; name: string; stage: string; quantity: number | null }>;
  };
}

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function searchAdmin(raw: string): Promise<SearchResults> {
  await requireStaff(undefined, "/admin/search");
  const q = raw.trim().slice(0, 80);
  const empty: SearchResults = { q, articles: [], variants: [], leads: [], buyers: [], bills: [], exact: null };
  if (q.length < 2) return empty;
  const supabase = await supabaseServer();
  const p = like(q);
  const digits = q.replace(/\D/g, "");

  const [byCode, byName, variants, leadName, leadBiz, leadPhone, buyerName, buyerPhone, bills] = await Promise.all([
    supabase.from("articles").select("code, name, garment").ilike("code", p).limit(8),
    supabase.from("articles").select("code, name, garment").ilike("name", p).limit(8),
    supabase.from("variants").select("id, sku, stock, size, article_id, color_id, articles(code, name), article_colors(name)").ilike("sku", p).limit(10),
    supabase.from("leads").select("id, name, phone, stage, business_name").ilike("name", p).limit(8),
    supabase.from("leads").select("id, name, phone, stage, business_name").ilike("business_name", p).limit(8),
    digits.length >= 4 ? supabase.from("leads").select("id, name, phone, stage, business_name").ilike("phone", like(digits)).limit(8) : Promise.resolve({ data: [] as Array<{ id: string; name: string; phone: string; stage: string; business_name: string | null }> }),
    supabase.from("contacts").select("id, name, phone, business_name").ilike("name", p).limit(8),
    digits.length >= 4 ? supabase.from("contacts").select("id, name, phone, business_name").ilike("phone", like(digits)).limit(8) : Promise.resolve({ data: [] as Array<{ id: string; name: string; phone: string | null; business_name: string | null }> }),
    supabase.from("bills").select("id, bill_number, bill_date, status").ilike("bill_number", p).limit(8),
  ]);

  const uniq = <T extends { [k: string]: unknown }>(rows: T[], key: keyof T) => [...new Map(rows.map((r) => [r[key], r])).values()];
  type V = { id: string; sku: string; stock: number; size: string; articles: { code: string; name: string } | null; article_colors: { name: string } | null };
  const variantHits: VariantHit[] = ((variants.data ?? []) as unknown as V[]).map((v) => ({ id: v.id, sku: v.sku, stock: v.stock, size: v.size, colour: v.article_colors?.name ?? "", articleCode: v.articles?.code ?? "", articleName: v.articles?.name ?? "" }));

  let exact: SearchResults["exact"] = null;
  const hit = variantHits.find((v) => v.sku === q.toUpperCase());
  if (hit) {
    const { data: art } = await supabase.from("variants").select("article_id").eq("id", hit.id).single();
    const [moves, items] = await Promise.all([
      supabase.from("stock_movements").select("id, qty_change, reason, note, created_at, bill_id").eq("variant_id", hit.id).order("created_at", { ascending: false }).limit(15),
      art ? supabase.from("lead_items").select("quantity, leads(id, name, stage)").eq("article_id", art.article_id).limit(20) : Promise.resolve({ data: [] }),
    ]);
    const billIds = [...new Set((moves.data ?? []).map((m) => m.bill_id).filter((x): x is string => Boolean(x)))];
    const { data: billRows } = billIds.length ? await supabase.from("bills").select("id, bill_number, bill_date, status").in("id", billIds) : { data: [] as Array<{ id: string; bill_number: string | null; bill_date: string | null; status: string }> };
    exact = {
      variant: hit,
      movements: (moves.data ?? []).map((m) => ({ id: m.id, qty: m.qty_change, reason: m.reason, note: m.note, at: m.created_at, billId: m.bill_id })),
      bills: (billRows ?? []).map((b) => ({ id: b.id, billNumber: b.bill_number, billDate: b.bill_date, status: b.status })),
      leads: ((items.data ?? []) as unknown as Array<{ quantity: number | null; leads: { id: string; name: string; stage: string } | null }>).filter((i) => i.leads).map((i) => ({ id: (i.leads as { id: string }).id, name: (i.leads as { name: string }).name, stage: (i.leads as { stage: string }).stage, quantity: i.quantity })),
    };
  }

  return {
    q,
    articles: uniq([...(byCode.data ?? []), ...(byName.data ?? [])], "code"),
    variants: variantHits,
    leads: uniq([...(leadName.data ?? []), ...(leadBiz.data ?? []), ...(leadPhone.data ?? [])], "id").map((l) => ({ id: l.id, name: l.name, phone: l.phone, stage: l.stage, businessName: l.business_name })),
    buyers: uniq([...(buyerName.data ?? []), ...(buyerPhone.data ?? [])], "id").map((b) => ({ id: b.id, name: b.name, phone: b.phone, businessName: b.business_name })),
    bills: (bills.data ?? []).map((b) => ({ id: b.id, billNumber: b.bill_number, billDate: b.bill_date, status: b.status })),
    exact,
  };
}
