import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/session";

/*
  Dashboard (AGENTS.md §14): read-only. Everything is computed from the same tables Inventory, Inbox and CRM use, so a
  number here always matches the page it links to. India time is used for "today" and for grouping by day.
*/

export type Range = 7 | 30 | 90;
export const parseRange = (v: string | undefined): Range => (v === "7" ? 7 : v === "90" ? 90 : 30);

const istDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export interface Dashboard {
  range: Range;
  attention: { waiting: number; oldestWaitingHours: number | null; outArticles: number; lowArticles: number; followUps: number };
  kpi: { piecesInStock: number; liveArticles: number; sold: number; made: number; openLeads: number };
  flow: Array<{ day: string; inPieces: number; outPieces: number }>;
  byArticle: Array<{ label: string; value: number }>;
  sizes: Array<{ label: string; value: number }>;
  colours: Array<{ label: string; value: number }>;
  categories: Array<{ label: string; value: number }>;
  restock: Array<{ sku: string; articleCode: string; stock: number; sold: number; daysLeft: number | null }>;
  demand: Array<{ code: string; name: string; asked: number; stock: number }>;
  slow: Array<{ code: string; name: string; stock: number }>;
  recent: Array<{ id: string; sku: string; qty: number; reason: string; at: string }>;
  checks: { noPhotos: number; draftBills: number; failedScans: number; hiddenNoStock: number };
  ai: { tokensToday: number; budget: number; paused: boolean };
}

type V = { id: string; sku: string; size: string; stock: number; low_stock_threshold: number; is_active: boolean; article_id: string; color_id: string };

export async function loadDashboard(range: Range): Promise<Dashboard> {
  await requireStaff(undefined, "/admin");
  const supabase = await supabaseServer();
  const now = new Date();
  const since = new Date(now.getTime() - range * 86_400_000).toISOString();
  const today = istDay(now);

  const [variants, articles, colours, moves, recent, waiting, leads, leadItems, imgs, drafts, failed, aiToday, settings] = await Promise.all([
    supabase.from("variants").select("id, sku, size, stock, low_stock_threshold, is_active, article_id, color_id").eq("is_active", true).limit(20000),
    supabase.from("articles").select("id, code, name, category, is_active, is_public").eq("is_active", true).limit(5000),
    supabase.from("article_colors").select("id, name").limit(20000),
    supabase.from("stock_movements").select("variant_id, qty_change, reason, created_at").gte("created_at", since).order("created_at").limit(50000),
    supabase.from("stock_movements").select("id, variant_id, qty_change, reason, created_at").order("created_at", { ascending: false }).limit(10),
    supabase.from("inbox_open_by_contact").select("oldest_at"),
    supabase.from("leads").select("id, stage, next_follow_up").not("stage", "in", "(won,lost)").limit(5000),
    supabase.from("lead_items").select("article_id, quantity, leads!inner(stage)").not("leads.stage", "in", "(won,lost)").limit(5000),
    supabase.from("article_images").select("article_id").limit(50000),
    supabase.from("bills").select("id", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("bill_scan_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase.from("ai_usage_daily").select("tokens").eq("day", today),
    supabase.from("business_settings").select("ai_daily_token_budget, ai_paused").limit(1).maybeSingle(),
  ]);

  const vs = (variants.data ?? []) as V[];
  const arts = new Map((articles.data ?? []).map((a) => [a.id, a]));
  const colourName = new Map((colours.data ?? []).map((c) => [c.id, c.name]));
  const vById = new Map(vs.map((v) => [v.id, v]));
  const liveV = vs.filter((v) => arts.has(v.article_id));

  const stockOf = new Map<string, number>();
  const lowOf = new Map<string, number>();
  for (const v of liveV) {
    stockOf.set(v.article_id, (stockOf.get(v.article_id) ?? 0) + v.stock);
    if (v.stock > 0 && v.stock <= v.low_stock_threshold) lowOf.set(v.article_id, (lowOf.get(v.article_id) ?? 0) + 1);
  }
  const articleList = [...arts.values()];
  const outArticles = articleList.filter((a) => (stockOf.get(a.id) ?? 0) === 0).length;
  const lowArticles = articleList.filter((a) => (lowOf.get(a.id) ?? 0) > 0).length;

  // Stock flow per India day
  const days: string[] = [];
  for (let i = range - 1; i >= 0; i--) days.push(istDay(new Date(now.getTime() - i * 86_400_000)));
  const flowMap = new Map(days.map((d) => [d, { day: d, inPieces: 0, outPieces: 0 }]));
  let sold = 0;
  let made = 0;
  const soldBy = new Map<string, number>();
  for (const m of moves.data ?? []) {
    const bucket = flowMap.get(istDay(new Date(m.created_at)));
    if (bucket) {
      if (m.qty_change > 0) bucket.inPieces += m.qty_change; else bucket.outPieces += -m.qty_change;
    }
    if (m.reason === "sale") {
      sold += -m.qty_change;
      soldBy.set(m.variant_id, (soldBy.get(m.variant_id) ?? 0) - m.qty_change);
    }
    if (m.reason === "production") made += m.qty_change;
  }

  const spread = (key: (v: V) => string) => {
    const m = new Map<string, number>();
    for (const v of liveV) m.set(key(v), (m.get(key(v)) ?? 0) + v.stock);
    return [...m].map(([label, value]) => ({ label, value })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  };
  const sizeOrder = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
  const sizes = spread((v) => v.size).sort((a, b) => (sizeOrder.indexOf(a.label) + 99) % 99 - (sizeOrder.indexOf(b.label) + 99) % 99);
  const categories = spread((v) => (arts.get(v.article_id)?.category === "lowerwear" ? "Pants and lowerwear" : "Shirts and upperwear"));

  // Restock first: selling variants that are low or out, quickest to run out first
  const restock = liveV
    .map((v) => {
      const s = soldBy.get(v.id) ?? 0;
      const perDay = s / range;
      return { sku: v.sku, articleCode: arts.get(v.article_id)?.code ?? "", stock: v.stock, sold: s, daysLeft: perDay > 0 ? Math.floor(v.stock / perDay) : null, low: v.stock <= v.low_stock_threshold };
    })
    .filter((r) => r.sold > 0 && (r.low || (r.daysLeft !== null && r.daysLeft <= 14)))
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))
    .slice(0, 8)
    .map((r) => ({ sku: r.sku, articleCode: r.articleCode, stock: r.stock, sold: r.sold, daysLeft: r.daysLeft }));

  // Demand vs stock: pieces open leads asked for, against what we hold
  const asked = new Map<string, number>();
  for (const i of (leadItems.data ?? []) as Array<{ article_id: string; quantity: number | null }>) asked.set(i.article_id, (asked.get(i.article_id) ?? 0) + (i.quantity ?? 0));
  const demand = [...asked]
    .filter(([, q]) => q > 0)
    .map(([id, q]) => ({ code: arts.get(id)?.code ?? "", name: arts.get(id)?.name ?? "", asked: q, stock: stockOf.get(id) ?? 0 }))
    .filter((d) => d.code)
    .sort((a, b) => b.asked - a.asked)
    .slice(0, 6);

  // Slow movers: stock on the shelf, nothing sold in the range
  const soldArticles = new Set([...soldBy.keys()].map((id) => vById.get(id)?.article_id));
  const slow = articleList
    .filter((a) => (stockOf.get(a.id) ?? 0) > 0 && !soldArticles.has(a.id))
    .map((a) => ({ code: a.code, name: a.name, stock: stockOf.get(a.id) ?? 0 }))
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 6);

  const withPhotos = new Set((imgs.data ?? []).map((i) => i.article_id));
  const oldest = (waiting.data ?? []).map((w) => w.oldest_at).filter((x): x is string => Boolean(x)).sort()[0];

  return {
    range,
    attention: {
      waiting: waiting.data?.length ?? 0,
      oldestWaitingHours: oldest ? Math.floor((now.getTime() - new Date(oldest).getTime()) / 3_600_000) : null,
      outArticles,
      lowArticles,
      followUps: (leads.data ?? []).filter((l) => l.next_follow_up !== null && l.next_follow_up <= today).length,
    },
    kpi: {
      piecesInStock: liveV.reduce((s, v) => s + v.stock, 0),
      liveArticles: articleList.filter((a) => a.is_public && (stockOf.get(a.id) ?? 0) > 0).length,
      sold,
      made,
      openLeads: leads.data?.length ?? 0,
    },
    flow: [...flowMap.values()],
    byArticle: articleList.map((a) => ({ label: a.code, value: stockOf.get(a.id) ?? 0 })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 8),
    sizes,
    colours: spread((v) => colourName.get(v.color_id) ?? "Other").slice(0, 8),
    categories,
    restock,
    demand,
    slow,
    recent: (recent.data ?? []).map((m) => ({ id: m.id, sku: vById.get(m.variant_id)?.sku ?? "", qty: m.qty_change, reason: m.reason, at: m.created_at })),
    checks: {
      noPhotos: articleList.filter((a) => !withPhotos.has(a.id)).length,
      draftBills: drafts.count ?? 0,
      failedScans: failed.count ?? 0,
      hiddenNoStock: articleList.filter((a) => a.is_public && (stockOf.get(a.id) ?? 0) === 0).length,
    },
    ai: { tokensToday: (aiToday.data ?? []).reduce((s, r) => s + Number(r.tokens ?? 0), 0), budget: Number(settings.data?.ai_daily_token_budget ?? 0), paused: settings.data?.ai_paused ?? false },
  };
}
