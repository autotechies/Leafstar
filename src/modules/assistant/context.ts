import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { loadCounts, loadSince } from "./briefing";

/*
  The business snapshot given to the owner's assistant with every question: counts, what is waiting, stock by article,
  recent bills. It is read with the signed-in owner's own rights (row security applies). It is NEVER shown to the public
  chatbot, which has its own, separate, public-only data (src/modules/chat).
*/

const trim = (s: string | null | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export async function buildSnapshot(): Promise<string> {
  const { since } = await loadSince();
  const supabase = await supabaseServer();
  const [counts, inbox, leads, variants, bills, moves, questions] = await Promise.all([
    loadCounts(since),
    supabase.from("inbox_items").select("kind, name, phone, preview, created_at").eq("status", "unanswered").order("created_at", { ascending: false }).limit(15),
    supabase.from("leads").select("name, phone, business_name, stage, source, message, next_follow_up, created_at").not("stage", "in", "(won,lost)").order("created_at", { ascending: false }).limit(20),
    supabase.from("variants").select("sku, stock, low_stock_threshold, is_active, articles(code, name)").eq("is_active", true).limit(3000),
    supabase.from("bills").select("bill_number, bill_date, buyer_name_raw, status, total_amount").order("created_at", { ascending: false }).limit(10),
    supabase.from("stock_movements").select("qty_change, reason, created_at, variants(sku)").order("created_at", { ascending: false }).limit(15),
    supabase.from("unanswered_questions").select("question, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(10),
  ]);

  type V = { sku: string; stock: number; low_stock_threshold: number; articles: { code: string; name: string } | null };
  const byArticle = new Map<string, { code: string; name: string; total: number; out: number; low: number; sizes: number }>();
  for (const v of (variants.data ?? []) as unknown as V[]) {
    if (!v.articles) continue;
    const a = byArticle.get(v.articles.code) ?? { code: v.articles.code, name: v.articles.name, total: 0, out: 0, low: 0, sizes: 0 };
    a.total += v.stock;
    a.sizes += 1;
    if (v.stock <= 0) a.out += 1;
    else if (v.stock <= v.low_stock_threshold) a.low += 1;
    byArticle.set(v.articles.code, a);
  }
  const articles = [...byArticle.values()].sort((x, y) => y.out + y.low - (x.out + x.low) || x.total - y.total).slice(0, 40);

  const lines: string[] = [];
  lines.push(`Owner last marked things as seen at: ${since} (all "new" counts below are since then).`);
  lines.push(`COUNTS: ${JSON.stringify(counts)}`);
  lines.push("WAITING FOR A REPLY (Inbox, newest first):");
  for (const i of inbox.data ?? []) lines.push(`- ${i.kind} | ${trim(i.name, 40) || "no name"} | ${i.phone ?? "no phone"} | ${trim(i.preview, 100)} | ${i.created_at}`);
  lines.push("OPEN LEADS (newest first):");
  for (const l of leads.data ?? []) lines.push(`- ${trim(l.name, 40)}${l.business_name ? ` (${trim(l.business_name, 40)})` : ""} | ${l.phone} | stage ${l.stage} | via ${l.source} | follow-up ${l.next_follow_up ?? "none"} | ${trim(l.message, 100)}`);
  lines.push("STOCK BY ARTICLE (pieces in total; colour-size combinations out of stock / low; most worrying first, max 40):");
  for (const a of articles) lines.push(`- ${a.code} ${trim(a.name, 40)} | ${a.total} pieces | ${a.out} out of ${a.sizes} | ${a.low} low`);
  lines.push("RECENT BILLS:");
  for (const b of bills.data ?? []) lines.push(`- ${b.bill_number ?? "no number"} | ${b.bill_date ?? "no date"} | ${trim(b.buyer_name_raw, 40) || "no buyer"} | ${b.status}${b.total_amount !== null ? ` | Rs ${b.total_amount}` : ""}`);
  lines.push("RECENT STOCK CHANGES:");
  for (const m of (moves.data ?? []) as unknown as Array<{ qty_change: number; reason: string; created_at: string; variants: { sku: string } | null }>) lines.push(`- ${m.variants?.sku ?? "?"} | ${m.qty_change > 0 ? "+" : ""}${m.qty_change} | ${m.reason} | ${m.created_at}`);
  lines.push("QUESTIONS THE WEBSITE ASSISTANT COULD NOT ANSWER (open):");
  for (const q of questions.data ?? []) lines.push(`- ${trim(q.question, 120)}`);
  return lines.join("\n");
}
