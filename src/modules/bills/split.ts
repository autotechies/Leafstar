import { SIZE_OPTIONS } from "@/modules/stock/constants";

/*
  Suggesting how an "assorted" bill line splits across colours and sizes (the bill says "S-XXL, assorted colours" and
  cannot say which pieces). This is a SUGGESTION: the owner sees every resulting line and confirms before any stock moves.

  Basis, in order: what this buyer was actually sent on earlier applied bills; otherwise what we hold now. A suggestion
  never exceeds the stock of a colour and size, and never invents pieces: if stock cannot cover the line, the rest is
  reported as a shortfall for the owner to settle by hand.
*/

export interface SplitVariant { id: string; colour: string; size: string; stock: number }
export interface SplitSuggestion {
  lines: Array<{ variantId: string; qty: number }>;
  /** Pieces on the line that current stock cannot cover. */
  shortfall: number;
  basis: "history" | "stock";
}

const SIZES: readonly string[] = SIZE_OPTIONS;
const MIXED = /assort|mixed|multi|various|all\s+colou?rs?|colou?rs?\s+mix/i;

/** "S-XXL" or "S to XL" → S..XL; "S, M, L" → those; nothing recognised → null (every size). */
export function sizesInText(text: string): string[] | null {
  const t = text.toUpperCase();
  const range = t.match(/\b(XXL|XL|S|M|L)\b\s*(?:-|–|—|TO)\s*\b(XXL|XL|S|M|L)\b/);
  if (range) {
    const a = SIZES.indexOf(range[1]);
    const b = SIZES.indexOf(range[2]);
    if (a >= 0 && b >= 0) return SIZES.slice(Math.min(a, b), Math.max(a, b) + 1) as string[];
  }
  const listed = [...new Set(t.match(/\b(?:XXL|XL|S|M|L)\b/g) ?? [])];
  return listed.length ? listed : null;
}

export function suggestSplit(input: { qty: number; variants: SplitVariant[]; sizeText: string; colourText: string; history?: Record<string, number> }): SplitSuggestion | null {
  const qty = Math.round(input.qty);
  if (qty <= 0) return null;
  let pool = input.variants.filter((v) => v.stock > 0);

  const sizes = sizesInText(input.sizeText);
  if (sizes) {
    const bySize = pool.filter((v) => sizes.includes(v.size.toUpperCase()));
    if (bySize.length) pool = bySize;
  }
  const colour = input.colourText.trim();
  if (colour && !MIXED.test(colour)) {
    const byColour = pool.filter((v) => v.colour.toLowerCase().includes(colour.toLowerCase()) || colour.toLowerCase().includes(v.colour.toLowerCase()));
    if (byColour.length) pool = byColour;
  }
  if (pool.length === 0) return null;

  const history = input.history ?? {};
  const historyTotal = pool.reduce((s, v) => s + (history[v.id] ?? 0), 0);
  let basis: SplitSuggestion["basis"] = historyTotal > 0 ? "history" : "stock";
  let usedHistory = false;
  let weight = (v: SplitVariant) => (basis === "history" ? history[v.id] ?? 0 : v.stock);

  const alloc = new Map<string, number>(pool.map((v) => [v.id, 0]));
  let remaining = qty;
  for (let round = 0; round < 12 && remaining > 0; round++) {
    const open = pool.filter((v) => (alloc.get(v.id) ?? 0) < v.stock && weight(v) > 0);
    if (open.length === 0) {
      if (basis === "history") {
        // What this buyer took before is used up: finish with what we hold.
        basis = "stock";
        weight = (v) => v.stock;
        continue;
      }
      break;
    }
    if (basis === "history") usedHistory = true;
    const sum = open.reduce((s, v) => s + weight(v), 0);
    const shares = open.map((v) => ({ v, ideal: (remaining * weight(v)) / sum }));
    let given = 0;
    for (const s of shares) {
      const give = Math.min(Math.floor(s.ideal), s.v.stock - (alloc.get(s.v.id) ?? 0));
      alloc.set(s.v.id, (alloc.get(s.v.id) ?? 0) + give);
      given += give;
    }
    let left = remaining - given;
    for (const s of [...shares].sort((a, b) => b.ideal - Math.floor(b.ideal) - (a.ideal - Math.floor(a.ideal)))) {
      if (left <= 0) break;
      if ((alloc.get(s.v.id) ?? 0) < s.v.stock) {
        alloc.set(s.v.id, (alloc.get(s.v.id) ?? 0) + 1);
        left--;
      }
    }
    remaining = left;
  }

  const order = new Map(pool.map((v, i) => [v.id, i]));
  const lines = [...alloc]
    .filter(([, q]) => q > 0)
    .sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0))
    .map(([variantId, q]) => ({ variantId, qty: q }));
  const placed = lines.reduce((s, l) => s + l.qty, 0);
  return { lines, shortfall: qty - placed, basis: usedHistory ? "history" : "stock" };
}
