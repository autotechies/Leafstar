import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/session";
import type { Photo } from "@/modules/images/types";
import type {
  ActivityRow,
  BuyerDossier,
  BuyerPurchasedArticle,
  BuyerRow,
  BuyerTimelineItem,
  CustomerAiProfile,
  CustomerTier,
  LeadCard,
  LeadDetail,
  LeadItemRow,
  Stage,
} from "./types";

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
  // The same person's chats with the website assistant, matched by phone number.
  let chat: LeadDetail["chat"] = null;
  const { data: visitor } = await supabase.from("visitors").select("id").eq("phone", lead.phone).order("last_seen", { ascending: false }).limit(1).maybeSingle();
  if (visitor) {
    const [{ data: msgs }, { count }] = await Promise.all([
      supabase.from("chat_messages").select("id, role, content, created_at").eq("visitor_id", visitor.id).order("created_at", { ascending: false }).limit(30),
      supabase.from("chat_sessions").select("id", { count: "exact", head: true }).eq("visitor_id", visitor.id),
    ]);
    if ((msgs ?? []).length > 0) chat = { visitorId: visitor.id, visits: count ?? 1, messages: (msgs ?? []).reverse().map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content, createdAt: m.created_at })) };
  }
  return { ...card, chat, instagram: extra.instagram, message: extra.message, lostReason: extra.lost_reason, contactId: extra.contact_id, items: itemRows, activities };
}

export async function loadBuyers(): Promise<BuyerRow[]> {
  await requireStaff(undefined, "/admin/crm/buyers");
  const supabase = await supabaseServer();

  const { data: contactsData } = await supabase
    .from("contacts")
    .select("id, name, business_name, phone, email, instagram, city, gstin, credit_limit, payment_terms_days, notes, customer_tier, tags, ai_profile, last_evaluated_at")
    .contains("roles", ["buyer"])
    .eq("is_active", true)
    .order("name")
    .limit(1000);

  const contacts = contactsData ?? [];
  const ids = contacts.map((c) => c.id);
  const { data: bills } = ids.length ? await supabase.from("bills").select("id, bill_number, bill_date, total_amount, contact_id, applied_at").eq("status", "applied").in("contact_id", ids).order("applied_at", { ascending: false }) : { data: [] as Array<{ id: string; bill_number: string | null; bill_date: string | null; total_amount: number | null; contact_id: string | null; applied_at: string | null }> };
  const billIds = (bills ?? []).map((b) => b.id);
  const { data: lines } = billIds.length ? await supabase.from("bill_items").select("bill_id, qty").in("bill_id", billIds) : { data: [] as Array<{ bill_id: string; qty: number }> };
  const pieces = new Map<string, number>();
  for (const l of lines ?? []) pieces.set(l.bill_id, (pieces.get(l.bill_id) ?? 0) + l.qty);

  return contacts.map((c) => {
    const mine = (bills ?? []).filter((b) => b.contact_id === c.id);
    const known = mine.filter((b) => b.total_amount !== null);
    return {
      id: c.id,
      name: c.name,
      businessName: c.business_name,
      phone: c.phone,
      email: c.email,
      instagram: c.instagram,
      city: c.city,
      gstin: c.gstin,
      creditLimit: c.credit_limit === null ? null : Number(c.credit_limit),
      paymentTermsDays: c.payment_terms_days === null ? null : Number(c.payment_terms_days),
      notes: c.notes,
      customerTier: (c.customer_tier as CustomerTier) || "new_prospect",
      tags: Array.isArray(c.tags) ? (c.tags as string[]) : [],
      aiProfile: (c.ai_profile as unknown as CustomerAiProfile) || null,
      lastEvaluatedAt: c.last_evaluated_at,
      totalPieces: mine.reduce((s, b) => s + (pieces.get(b.id) ?? 0), 0),
      totalValue: known.length ? known.reduce((s, b) => s + Number(b.total_amount), 0) : null,
      billCount: mine.length,
      lastPurchase: mine[0]?.bill_date ?? mine[0]?.applied_at ?? null,
      bills: mine.slice(0, 20).map((b) => ({ id: b.id, billNumber: b.bill_number, billDate: b.bill_date, amount: b.total_amount === null ? null : Number(b.total_amount), pieces: pieces.get(b.id) ?? 0 })),
    };
  });
}

/**
 * Loads the complete 360° customer dossier for a buyer:
 * - Profile and credit terms
 * - AI classification, tags, and evaluation
 * - Complete itemized product purchase history
 * - Unified activity timeline (bills, leads, chats, notes)
 */
export async function loadBuyerDossier(id: string): Promise<BuyerDossier | null> {
  await requireStaff(undefined, `/admin/crm/buyers/${encodeURIComponent(id)}`);
  const supabase = await supabaseServer();

  const { data: contactData } = await supabase
    .from("contacts")
    .select("id, name, business_name, phone, email, instagram, city, gstin, credit_limit, payment_terms_days, notes, customer_tier, tags, ai_profile, last_evaluated_at, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (!contactData) return null;
  const c = contactData;

  // 1. Fetch all applied bills
  const { data: bills } = await supabase
    .from("bills")
    .select("id, bill_number, bill_date, total_amount, applied_at, status")
    .eq("contact_id", id)
    .eq("status", "applied")
    .order("applied_at", { ascending: false });

  const billRows = bills ?? [];
  const billIds = billRows.map((b) => b.id);

  // 2. Fetch bill items with variant and article details
  const { data: billItems } = billIds.length
    ? await supabase
        .from("bill_items")
        .select(`
          id, bill_id, variant_id, qty, rate, amount, extracted_name,
          variants(
            id, sku, size, size_order, article_id, color_id,
            articles(id, code, name, garment, fabric, article_images(id, thumb_url, medium_url, url, width, height, sort_order)),
            article_colors(name)
          )
        `)
        .in("bill_id", billIds)
    : { data: [] };

  const billMap = new Map(billRows.map((b) => [b.id, b]));
  const articleMap = new Map<string, BuyerPurchasedArticle>();
  const billPiecesMap = new Map<string, number>();

  type ImgRow = {
    id: string;
    thumb_url: string;
    medium_url: string;
    url: string;
    width: number | null;
    height: number | null;
    sort_order: number;
  };

  type VRow = {
    id: string;
    sku: string;
    size: string;
    size_order: number;
    article_id: string;
    articles: {
      id: string;
      code: string;
      name: string;
      garment: string;
      fabric: string | null;
      article_images: ImgRow[];
    } | null;
    article_colors: { name: string } | null;
  };

  for (const item of billItems ?? []) {
    const qty = item.qty ?? 0;
    const bill = billMap.get(item.bill_id);
    const billDate = bill?.bill_date ?? bill?.applied_at ?? new Date().toISOString();
    billPiecesMap.set(item.bill_id, (billPiecesMap.get(item.bill_id) ?? 0) + qty);

    const v = item.variants as unknown as VRow | null;
    if (!v || !v.articles) continue;

    const art = v.articles;
    const artId = art.id;
    const colorName = v.article_colors?.name ?? "Standard";
    const amt = item.amount !== null ? Number(item.amount) : null;

    let existing = articleMap.get(artId);
    if (!existing) {
      const sortedImgs = [...(art.article_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      const photos = sortedImgs.map((img) => ({
        id: img.id,
        thumbUrl: img.thumb_url,
        mediumUrl: img.medium_url,
        url: img.url,
        width: img.width ?? 1200,
        height: img.height ?? 1500,
        alt: art.name,
      }));

      existing = {
        articleId: artId,
        articleCode: art.code,
        articleName: art.name,
        garment: art.garment,
        fabric: art.fabric,
        coverThumb: sortedImgs[0]?.thumb_url ?? null,
        photos,
        totalPieces: 0,
        totalAmount: 0,
        variants: [],
        firstBoughtAt: billDate,
        lastBoughtAt: billDate,
      };
      articleMap.set(artId, existing);
    }

    existing.totalPieces += qty;
    if (amt !== null) existing.totalAmount = (existing.totalAmount ?? 0) + amt;
    if (new Date(billDate) < new Date(existing.firstBoughtAt)) existing.firstBoughtAt = billDate;
    if (new Date(billDate) > new Date(existing.lastBoughtAt)) existing.lastBoughtAt = billDate;

    const vExisting = existing.variants.find((x) => x.sku === v.sku);
    if (vExisting) {
      vExisting.qty += qty;
    } else {
      existing.variants.push({ sku: v.sku, color: colorName, size: v.size, qty });
    }
  }

  const purchasedArticles = [...articleMap.values()].sort((a, b) => b.totalPieces - a.totalPieces);

  // 3. Fetch leads associated with this buyer (by contact_id or by phone)
  const phone = c.phone ? String(c.phone) : null;
  const leadQuery = supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .order("created_at", { ascending: false });

  if (phone) {
    leadQuery.or(`contact_id.eq.${id},phone.eq.${phone}`);
  } else {
    leadQuery.eq("contact_id", id);
  }

  const { data: leadRows } = await leadQuery;
  const leads: LeadCard[] = (leadRows ?? []).map((l) => toCard(l as LeadRow, 0));

  // 4. Fetch chat conversations if matched by phone
  let chatMessages: Array<{ id: string; role: string; content: string; created_at: string }> = [];

  if (phone) {
    const { data: visitor } = await supabase
      .from("visitors")
      .select("id")
      .eq("phone", phone)
      .order("last_seen", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (visitor) {
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("visitor_id", visitor.id)
        .order("created_at", { ascending: false })
        .limit(30);
      chatMessages = msgs ?? [];
    }
  }

  // 5. Compile unified timeline
  const timeline: BuyerTimelineItem[] = [];

  for (const b of billRows) {
    const pcs = billPiecesMap.get(b.id) ?? 0;
    timeline.push({
      id: b.id,
      type: "bill",
      title: b.bill_number ? `Invoice #${b.bill_number}` : "Invoice Applied",
      timestamp: b.bill_date ? `${b.bill_date}T12:00:00Z` : (b.applied_at ?? new Date().toISOString()),
      description: `${pcs} pieces${b.total_amount !== null ? ` • ₹${Number(b.total_amount).toLocaleString("en-IN")}` : ""}`,
      meta: { billId: b.id, amount: b.total_amount, pieces: pcs },
    });
  }

  for (const l of leads) {
    timeline.push({
      id: l.id,
      type: "lead",
      title: `Inquiry (${l.source}) — ${l.stage.toUpperCase()}`,
      timestamp: l.createdAt,
      description: l.quotedAmount ? `Quoted: ₹${l.quotedAmount.toLocaleString("en-IN")}` : null,
      meta: { leadId: l.id, stage: l.stage },
    });
  }

  for (const m of chatMessages) {
    if (m.role === "user") {
      timeline.push({
        id: m.id,
        type: "chat",
        title: "Website Chat Inquiry",
        timestamp: m.created_at,
        description: m.content.length > 120 ? `${m.content.slice(0, 120)}…` : m.content,
      });
    }
  }

  if (c.notes) {
    timeline.push({
      id: `note-${id}`,
      type: "activity",
      title: "Contact Note",
      timestamp: String(c.updated_at ?? c.created_at ?? new Date().toISOString()),
      description: String(c.notes),
    });
  }

  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // 6. Summary metrics
  const totalPieces = purchasedArticles.reduce((s, a) => s + a.totalPieces, 0);
  const totalValue = billRows.reduce((s, b) => s + (b.total_amount !== null ? Number(b.total_amount) : 0), 0);
  const billCount = billRows.length;
  const averageOrderValue = billCount > 0 ? Math.round(totalValue / billCount) : null;
  const averageLotSize = billCount > 0 ? Math.round(totalPieces / billCount) : null;

  const latestBill = billRows[0];
  const lastPurchaseDate = latestBill?.bill_date ?? latestBill?.applied_at ?? null;
  const daysSinceLastPurchase = lastPurchaseDate
    ? Math.floor((Date.now() - new Date(lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    id: String(c.id),
    name: String(c.name),
    businessName: c.business_name ? String(c.business_name) : null,
    phone,
    email: c.email ? String(c.email) : null,
    instagram: c.instagram ? String(c.instagram) : null,
    city: c.city ? String(c.city) : null,
    gstin: c.gstin ? String(c.gstin) : null,
    creditLimit: c.credit_limit === null ? null : Number(c.credit_limit),
    paymentTermsDays: c.payment_terms_days === null ? null : Number(c.payment_terms_days),
    notes: c.notes ? String(c.notes) : null,
    customerTier: (c.customer_tier as CustomerTier) || "new_prospect",
    tags: Array.isArray(c.tags) ? (c.tags as string[]) : [],
    aiProfile: (c.ai_profile as unknown as CustomerAiProfile) || null,
    lastEvaluatedAt: c.last_evaluated_at ? String(c.last_evaluated_at) : null,
    totalPieces,
    totalValue: billCount > 0 ? totalValue : null,
    billCount,
    lastPurchase: lastPurchaseDate,
    bills: billRows.map((b) => ({
      id: b.id,
      billNumber: b.bill_number,
      billDate: b.bill_date,
      amount: b.total_amount === null ? null : Number(b.total_amount),
      pieces: billPiecesMap.get(b.id) ?? 0,
    })),
    averageOrderValue,
    averageLotSize,
    returnedPieces: 0,
    daysSinceLastPurchase,
    purchasedArticles,
    timeline,
    leads,
  };
}
