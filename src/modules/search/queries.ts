import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/session";
import type { CustomerTier } from "@/modules/crm/types";
import { loadProduct360, type Product360Stats } from "@/modules/inventory/product360";

/*
  One search box for SKU, article, buyer, lead and bill (AGENTS.md §14).
  Typing an article or customer immediately returns 360° commercial and operational dossier.
*/

export interface VariantHit { id: string; sku: string; stock: number; size: string; colour: string; articleCode: string; articleName: string }

export interface BuyerHit {
  id: string;
  name: string;
  phone: string | null;
  businessName: string | null;
  city: string | null;
  customerTier: CustomerTier;
  totalPieces: number;
  totalValue: number | null;
}

export interface ExactArticleHit {
  id: string;
  code: string;
  name: string;
  garment: string;
  fabric: string | null;
  stats: Product360Stats;
}

export interface SearchResults {
  q: string;
  articles: Array<{ code: string; name: string; garment: string; id?: string }>;
  exactArticle: ExactArticleHit | null;
  variants: VariantHit[];
  leads: Array<{ id: string; name: string; phone: string; stage: string; businessName: string | null }>;
  buyers: BuyerHit[];
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
  const empty: SearchResults = { q, articles: [], exactArticle: null, variants: [], leads: [], buyers: [], bills: [], exact: null };
  if (q.length < 2) return empty;
  const supabase = await supabaseServer();
  const p = like(q);
  const digits = q.replace(/\D/g, "");

  const [byCode, byName, variants, leadName, leadBiz, leadPhone, buyerName, buyerPhone, bills] = await Promise.all([
    supabase.from("articles").select("id, code, name, garment, fabric, created_at").ilike("code", p).limit(8),
    supabase.from("articles").select("id, code, name, garment, fabric, created_at").ilike("name", p).limit(8),
    supabase.from("variants").select("id, sku, stock, size, article_id, color_id, articles(code, name), article_colors(name)").ilike("sku", p).limit(10),
    supabase.from("leads").select("id, name, phone, stage, business_name").ilike("name", p).limit(8),
    supabase.from("leads").select("id, name, phone, stage, business_name").ilike("business_name", p).limit(8),
    digits.length >= 4 ? supabase.from("leads").select("id, name, phone, stage, business_name").ilike("phone", like(digits)).limit(8) : Promise.resolve({ data: [] as Array<{ id: string; name: string; phone: string; stage: string; business_name: string | null }> }),
    supabase.from("contacts").select("id, name, phone, business_name, city, customer_tier").ilike("name", p).limit(8),
    digits.length >= 4 ? supabase.from("contacts").select("id, name, phone, business_name, city, customer_tier").ilike("phone", like(digits)).limit(8) : Promise.resolve({ data: [] as Array<{ id: string; name: string; phone: string | null; business_name: string | null; city: string | null; customer_tier?: string }> }),
    supabase.from("bills").select("id, bill_number, bill_date, status").ilike("bill_number", p).limit(8),
  ]);

  const uniq = <T extends { [k: string]: unknown }>(rows: T[], key: keyof T) => [...new Map(rows.map((r) => [r[key], r])).values()];
  type V = { id: string; sku: string; stock: number; size: string; articles: { code: string; name: string } | null; article_colors: { name: string } | null };
  const variantHits: VariantHit[] = ((variants.data ?? []) as unknown as V[]).map((v) => ({ id: v.id, sku: v.sku, stock: v.stock, size: v.size, colour: v.article_colors?.name ?? "", articleCode: v.articles?.code ?? "", articleName: v.articles?.name ?? "" }));

  const matchedArticles = uniq([...(byCode.data ?? []), ...(byName.data ?? [])], "code") as Array<{ id: string; code: string; name: string; garment: string; fabric: string | null; created_at?: string }>;

  // Check for exact article match or top match for Product 360
  let exactArticle: ExactArticleHit | null = null;
  const upperQ = q.toUpperCase();
  const directArt = matchedArticles.find((a) => a.code.toUpperCase() === upperQ) ?? (matchedArticles.length === 1 ? matchedArticles[0] : null);

  if (directArt) {
    const stats = await loadProduct360(directArt.id, directArt.created_at);
    exactArticle = {
      id: directArt.id,
      code: directArt.code,
      name: directArt.name,
      garment: directArt.garment,
      fabric: directArt.fabric,
      stats,
    };
  }

  // Load purchase summaries for matched buyers
  const rawBuyers = uniq(
    [
      ...((buyerName.data ?? []) as unknown as Array<Record<string, unknown>>),
      ...((buyerPhone.data ?? []) as unknown as Array<Record<string, unknown>>),
    ],
    "id"
  ) as unknown as Array<{ id: string; name: string; phone: string | null; business_name: string | null; city: string | null; customer_tier?: string }>;
  const buyerIds = rawBuyers.map((b) => b.id);

  const buyerPiecesMap = new Map<string, number>();
  const buyerValueMap = new Map<string, number>();

  if (buyerIds.length > 0) {
    const { data: buyerBills } = await supabase
      .from("bills")
      .select("id, contact_id, total_amount, bill_items(qty)")
      .in("contact_id", buyerIds)
      .eq("status", "applied");

    type BB = { id: string; contact_id: string; total_amount: number | null; bill_items: Array<{ qty: number }> };
    for (const b of (buyerBills ?? []) as unknown as BB[]) {
      if (!b.contact_id) continue;
      const pcs = (b.bill_items ?? []).reduce((sum, item) => sum + (item.qty ?? 0), 0);
      buyerPiecesMap.set(b.contact_id, (buyerPiecesMap.get(b.contact_id) ?? 0) + pcs);
      if (b.total_amount !== null) {
        buyerValueMap.set(b.contact_id, (buyerValueMap.get(b.contact_id) ?? 0) + Number(b.total_amount));
      }
    }
  }

  const enrichedBuyers: BuyerHit[] = rawBuyers.map((b) => ({
    id: b.id,
    name: b.name,
    phone: b.phone,
    businessName: b.business_name,
    city: b.city,
    customerTier: (b.customer_tier as CustomerTier) || "new_prospect",
    totalPieces: buyerPiecesMap.get(b.id) ?? 0,
    totalValue: buyerValueMap.get(b.id) ?? null,
  }));

  let exact: SearchResults["exact"] = null;
  const hit = variantHits.find((v) => v.sku === upperQ);
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
    articles: matchedArticles.map((a) => ({ id: a.id, code: a.code, name: a.name, garment: a.garment })),
    exactArticle,
    variants: variantHits,
    leads: uniq([...(leadName.data ?? []), ...(leadBiz.data ?? []), ...(leadPhone.data ?? [])], "id").map((l) => ({ id: l.id, name: l.name, phone: l.phone, stage: l.stage, businessName: l.business_name })),
    buyers: enrichedBuyers,
    bills: (bills.data ?? []).map((b) => ({ id: b.id, billNumber: b.bill_number, billDate: b.bill_date, status: b.status })),
    exact,
  };
}
