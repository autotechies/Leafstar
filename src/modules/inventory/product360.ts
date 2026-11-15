import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

export interface ProductBuyerHistory {
  contactId: string | null;
  name: string;
  businessName: string | null;
  phone: string | null;
  city: string | null;
  totalPieces: number;
  totalValue: number | null;
  lastPurchaseDate: string | null;
  billCount: number;
}

export interface Product360Stats {
  producedPieces: number;
  soldPieces: number;
  returnedPieces: number;
  adjustments: number;
  currentStock: number;
  lastSoldAt: string | null;
  daysSinceLastSale: number | null;
  isDeadStock: boolean;
  deadStockAlert: string | null;
  buyers: ProductBuyerHistory[];
}

/**
 * Loads complete 360° commercial and operational metrics for an article:
 * - Produced vs Sold vs In-Stock vs Returned (from ledger)
 * - Dead stock / velocity status (aging analysis)
 * - Itemized list of all buyers who purchased this article
 */
export async function loadProduct360(articleId: string, createdAt?: string): Promise<Product360Stats> {
  const supabase = await supabaseServer();

  // 1. Fetch all variants for this article
  const { data: variants } = await supabase
    .from("variants")
    .select("id, sku, stock")
    .eq("article_id", articleId);

  const variantList = variants ?? [];
  const variantIds = variantList.map((v) => v.id);
  const currentStock = variantList.reduce((sum, v) => sum + (v.stock ?? 0), 0);

  if (variantIds.length === 0) {
    return {
      producedPieces: 0,
      soldPieces: 0,
      returnedPieces: 0,
      adjustments: 0,
      currentStock: 0,
      lastSoldAt: null,
      daysSinceLastSale: null,
      isDeadStock: false,
      deadStockAlert: null,
      buyers: [],
    };
  }

  // 2. Fetch stock movements and bill items concurrently in parallel
  const [{ data: movements }, { data: billItems }] = await Promise.all([
    supabase
      .from("stock_movements")
      .select("id, qty_change, reason, created_at, bill_id")
      .in("variant_id", variantIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("bill_items")
      .select("qty, amount, bill_id, bills(id, bill_number, bill_date, status, contact_id, buyer_name_raw, contacts(id, name, business_name, phone, city))")
      .in("variant_id", variantIds),
  ]);

  const moveRows = movements ?? [];

  let producedPieces = 0;
  let soldPieces = 0;
  let returnedPieces = 0;
  let adjustments = 0;
  let lastSoldAt: string | null = null;

  for (const m of moveRows) {
    const qty = m.qty_change ?? 0;
    if (m.reason === "production" || m.reason === "opening") {
      if (qty > 0) producedPieces += qty;
    } else if (m.reason === "sale" || m.bill_id) {
      if (qty < 0) {
        soldPieces += Math.abs(qty);
        if (!lastSoldAt || new Date(m.created_at) > new Date(lastSoldAt)) {
          lastSoldAt = m.created_at;
        }
      }
    } else if (m.reason === "return") {
      if (qty > 0) returnedPieces += qty;
    } else if (m.reason === "adjustment") {
      adjustments += qty;
    }
  }

  // 3. Compute velocity & dead stock status
  const now = Date.now();
  let daysSinceLastSale: number | null = null;
  let isDeadStock = false;
  let deadStockAlert: string | null = null;

  if (lastSoldAt) {
    daysSinceLastSale = Math.floor((now - new Date(lastSoldAt).getTime()) / (1000 * 60 * 60 * 24));
    if (currentStock > 0 && daysSinceLastSale >= 60) {
      isDeadStock = true;
      deadStockAlert = `Dead stock warning: No sales in ${daysSinceLastSale} days with ${currentStock} pieces in warehouse.`;
    }
  } else {
    // Never sold
    if (createdAt) {
      const daysSinceCreated = Math.floor((now - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
      if (currentStock > 0 && daysSinceCreated >= 60) {
        isDeadStock = true;
        deadStockAlert = `Slow moving: In inventory for ${daysSinceCreated} days with 0 sales and ${currentStock} pieces in warehouse.`;
      }
    } else if (currentStock > 0) {
      deadStockAlert = `No sales recorded yet (${currentStock} pieces in stock).`;
    }
  }

  // 4. Process buyers who bought this article
  type BillRow = {
    id: string;
    bill_number: string | null;
    bill_date: string | null;
    status: string;
    contact_id: string | null;
    buyer_name_raw: string | null;
    contacts: { id: string; name: string; business_name: string | null; phone: string | null; city: string | null } | null;
  };

  const buyerMap = new Map<string, ProductBuyerHistory>();

  for (const item of billItems ?? []) {
    const bill = item.bills as unknown as BillRow | null;
    if (!bill || bill.status !== "applied") continue;

    const contact = bill.contacts;
    const key = contact?.id ?? bill.contact_id ?? bill.buyer_name_raw ?? "unknown";
    const name = contact?.name ?? bill.buyer_name_raw ?? "Unknown buyer";
    const existing = buyerMap.get(key);

    const qty = item.qty ?? 0;
    const amt = item.amount ? Number(item.amount) : null;
    const billDate = bill.bill_date;

    if (!existing) {
      buyerMap.set(key, {
        contactId: contact?.id ?? bill.contact_id,
        name,
        businessName: contact?.business_name ?? null,
        phone: contact?.phone ?? null,
        city: contact?.city ?? null,
        totalPieces: qty,
        totalValue: amt,
        lastPurchaseDate: billDate,
        billCount: 1,
      });
    } else {
      existing.totalPieces += qty;
      if (amt !== null) {
        existing.totalValue = (existing.totalValue ?? 0) + amt;
      }
      if (billDate && (!existing.lastPurchaseDate || new Date(billDate) > new Date(existing.lastPurchaseDate))) {
        existing.lastPurchaseDate = billDate;
      }
      existing.billCount += 1;
    }
  }

  const buyers = [...buyerMap.values()].sort((a, b) => b.totalPieces - a.totalPieces);

  return {
    producedPieces,
    soldPieces,
    returnedPieces,
    adjustments,
    currentStock,
    lastSoldAt,
    daysSinceLastSale,
    isDeadStock,
    deadStockAlert,
    buyers,
  };
}
