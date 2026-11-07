export const CONFIDENT = 0.85;

export interface VariantOption {
  id: string;
  sku: string;
  articleCode: string;
  articleName: string;
  colour: string;
  size: string;
  stock: number;
  /** One line for pickers: "LS-SH-0101 Check Shirt · Navy · M (30 in stock)". */
  label: string;
}

export interface DraftItem {
  /** Local key for React lists. */
  key: string;
  variantId: string | null;
  rawText: string;
  name: string;
  colour: string;
  size: string;
  qty: number;
  rate: number | null;
  amount: number | null;
  method: string | null;
  confidence: number | null;
  /** The owner changed the match, so it is remembered for next time. */
  learn: boolean;
}

export interface BillDraft {
  id: string;
  status: "draft" | "applied" | "undone";
  billNumber: string;
  billDate: string;
  buyerName: string;
  total: number | null;
  items: DraftItem[];
  filePath: string | null;
  fileName: string | null;
  mime: string | null;
  fileUrl: string | null;
  rawText: string | null;
  /** Another APPLIED bill has this number and date, or this very file. */
  duplicate: string | null;
}

export interface ScanJobRow {
  id: string;
  batchRef: string;
  fileName: string;
  status: "queued" | "processing" | "extracted" | "failed";
  error: string | null;
  billId: string | null;
  billStatus: "draft" | "applied" | "undone" | null;
  billNumber: string | null;
  lines: number;
  unmatched: number;
  /** Every line matched with high confidence, nothing flagged: safe for "approve all". */
  confident: boolean;
  createdAt: string;
}

export interface HistoryRow {
  id: string;
  billNumber: string | null;
  billDate: string | null;
  buyer: string | null;
  status: "draft" | "applied" | "undone";
  lines: number;
  pieces: number;
  appliedAt: string | null;
  undoneAt: string | null;
}
