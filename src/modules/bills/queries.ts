import "server-only";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/session";
import { CONFIDENT, type BillDraft, type DraftItem, type HistoryRow, type ScanJobRow, type VariantOption } from "./types";

export async function loadVariantOptions(): Promise<VariantOption[]> {
  const supabase = await supabaseServer();
  const [{ data: variants }, { data: articles }, { data: colours }] = await Promise.all([
    supabase.from("variants").select("id, sku, size, size_order, stock, article_id, color_id").eq("is_active", true).limit(5000),
    supabase.from("articles").select("id, code, name"),
    supabase.from("article_colors").select("id, name"),
  ]);
  const a = new Map((articles ?? []).map((x) => [x.id, x]));
  const c = new Map((colours ?? []).map((x) => [x.id, x.name]));
  return (variants ?? [])
    .map((v) => {
      const art = a.get(v.article_id);
      const colour = c.get(v.color_id) ?? "";
      return {
        id: v.id,
        sku: v.sku,
        articleCode: art?.code ?? "",
        articleName: art?.name ?? "",
        colour,
        size: v.size,
        stock: v.stock,
        order: v.size_order,
        label: `${art?.code ?? ""} ${art?.name ?? ""} · ${colour} · ${v.size} (${v.stock} in stock)`,
      };
    })
    .sort((x, y) => x.articleCode.localeCompare(y.articleCode) || x.colour.localeCompare(y.colour) || x.order - y.order)
    .map(({ order: _order, ...rest }) => rest);
}

export async function loadQueue(): Promise<ScanJobRow[]> {
  // Today's date is read below, so this must run at request time, not while the page is prepared ahead of time.
  await connection();
  await requireStaff(undefined, "/admin/bills/scan");
  const supabase = await supabaseServer();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: jobs, error } = await supabase
    .from("bill_scan_jobs")
    .select("id, batch_ref, file_name, status, error, bill_id, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  const billIds = (jobs ?? []).map((j) => j.bill_id).filter((x): x is string => Boolean(x));
  const [{ data: bills }, { data: items }] = billIds.length
    ? await Promise.all([
        supabase.from("bills").select("id, bill_number, bill_date, status, file_hash").in("id", billIds),
        supabase.from("bill_items").select("bill_id, variant_id, match_confidence, qty").in("bill_id", billIds),
      ])
    : [{ data: [] }, { data: [] }];
  const billMap = new Map((bills ?? []).map((b) => [b.id, b]));
  const byBill = new Map<string, NonNullable<typeof items>>();
  for (const it of items ?? []) byBill.set(it.bill_id, [...(byBill.get(it.bill_id) ?? []), it]);

  // Applied bills, to flag a draft that repeats one.
  const { data: applied } = await supabase.from("bills").select("bill_number, bill_date, file_hash").eq("status", "applied");
  const appliedKeys = new Set((applied ?? []).filter((b) => b.bill_number).map((b) => `${b.bill_number?.toLowerCase()}|${b.bill_date ?? ""}`));
  const appliedHashes = new Set((applied ?? []).map((b) => b.file_hash).filter(Boolean));

  return (jobs ?? []).map((j) => {
    const bill = j.bill_id ? billMap.get(j.bill_id) : undefined;
    const lines = (j.bill_id && byBill.get(j.bill_id)) || [];
    const unmatched = lines.filter((l) => !l.variant_id).length;
    const dup = bill?.status === "draft" && ((bill.bill_number && appliedKeys.has(`${bill.bill_number.toLowerCase()}|${bill.bill_date ?? ""}`)) || (bill.file_hash && appliedHashes.has(bill.file_hash)));
    return {
      id: j.id,
      batchRef: j.batch_ref,
      fileName: j.file_name ?? "bill",
      status: j.status,
      error: j.error,
      billId: j.bill_id,
      billStatus: bill?.status ?? null,
      billNumber: bill?.bill_number ?? null,
      lines: lines.length,
      unmatched,
      confident: bill?.status === "draft" && lines.length > 0 && unmatched === 0 && !dup && lines.every((l) => (l.match_confidence ?? 0) >= CONFIDENT),
      createdAt: j.created_at,
    };
  });
}

export async function loadBill(id: string): Promise<{ bill: BillDraft; options: VariantOption[]; nextDraftId: string | null }> {
  await requireStaff(undefined, `/admin/bills/review/${id}`);
  const supabase = await supabaseServer();
  const { data: bill } = await supabase.from("bills").select("*").eq("id", id).maybeSingle();
  if (!bill) notFound();
  const [{ data: items }, { data: job }, options, { data: drafts }] = await Promise.all([
    supabase.from("bill_items").select("*").eq("bill_id", id).order("created_at"),
    supabase.from("bill_scan_jobs").select("file_name, mime_type, file_path").eq("bill_id", id).maybeSingle(),
    loadVariantOptions(),
    supabase.from("bills").select("id").eq("status", "draft").neq("id", id).order("created_at").limit(1),
  ]);
  const path = job?.file_path ?? bill.file_path;
  const signed = path ? await supabase.storage.from("bills").createSignedUrl(path, 3600) : null;

  let duplicate: string | null = null;
  if (bill.status === "draft") {
    const { data: same } = await supabase.from("bills").select("id, bill_number, bill_date, file_hash").eq("status", "applied").neq("id", id);
    const hit = (same ?? []).find(
      (b) => (bill.bill_number && b.bill_number?.toLowerCase() === bill.bill_number.toLowerCase() && b.bill_date === bill.bill_date) || (bill.file_hash && b.file_hash === bill.file_hash),
    );
    if (hit) duplicate = hit.file_hash === bill.file_hash ? "This exact file has already been applied." : `A bill numbered ${hit.bill_number} on this date has already been applied.`;
  }

  const extracted = bill.extracted_json as { raw_text?: string | null } | null;
  const draftItems: DraftItem[] = (items ?? []).map((i) => ({
    key: i.id,
    variantId: i.variant_id,
    rawText: i.raw_text ?? "",
    name: i.extracted_name ?? "",
    colour: i.extracted_color ?? "",
    size: i.extracted_size ?? "",
    qty: i.qty,
    rate: i.rate,
    amount: i.amount,
    method: i.match_method,
    confidence: i.match_confidence,
    learn: false,
  }));
  return {
    bill: {
      id: bill.id,
      status: bill.status,
      billNumber: bill.bill_number ?? "",
      billDate: bill.bill_date ?? "",
      buyerName: bill.buyer_name_raw ?? "",
      total: bill.total_amount,
      items: draftItems,
      filePath: path ?? null,
      fileName: job?.file_name ?? null,
      mime: job?.mime_type ?? null,
      fileUrl: signed?.data?.signedUrl ?? null,
      rawText: extracted?.raw_text ?? null,
      duplicate,
    },
    options,
    nextDraftId: drafts?.[0]?.id ?? null,
  };
}

export async function loadHistory(): Promise<HistoryRow[]> {
  await requireStaff(undefined, "/admin/bills");
  const supabase = await supabaseServer();
  const { data: bills, error } = await supabase.from("bills").select("id, bill_number, bill_date, buyer_name_raw, status, applied_at, undone_at, created_at").order("created_at", { ascending: false }).limit(300);
  if (error) throw error;
  const ids = (bills ?? []).map((b) => b.id);
  const { data: items } = ids.length ? await supabase.from("bill_items").select("bill_id, qty").in("bill_id", ids) : { data: [] };
  const totals = new Map<string, { lines: number; pieces: number }>();
  for (const i of items ?? []) {
    const t = totals.get(i.bill_id) ?? { lines: 0, pieces: 0 };
    totals.set(i.bill_id, { lines: t.lines + 1, pieces: t.pieces + i.qty });
  }
  return (bills ?? []).map((b) => ({
    id: b.id,
    billNumber: b.bill_number,
    billDate: b.bill_date,
    buyer: b.buyer_name_raw,
    status: b.status,
    lines: totals.get(b.id)?.lines ?? 0,
    pieces: totals.get(b.id)?.pieces ?? 0,
    appliedAt: b.applied_at,
    undoneAt: b.undone_at,
  }));
}
