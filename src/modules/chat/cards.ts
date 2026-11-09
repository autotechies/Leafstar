import type { PublicArticle } from "@/modules/site/data";

/*
  What the chat shows besides words (AGENTS.md §11). The assistant only NAMES article codes; the cards are built here from
  the public catalog, so a card can never show a made-up article, a price or an exact stock number.
*/

export interface ChatProduct {
  code: string;
  name: string;
  garment: string;
  thumb: string | null;
  colours: Array<{ name: string; hex: string }>;
  sizes: string[];
  moq: number;
  lowStock: boolean;
}

export function toChatProduct(a: PublicArticle): ChatProduct {
  const photo = a.colours.find((c) => c.photos.length)?.photos[0] ?? a.photos[0];
  return {
    code: a.code,
    name: a.name,
    garment: a.garment,
    thumb: photo?.thumbUrl ?? null,
    colours: a.colours.map((c) => ({ name: c.name, hex: c.hex })).slice(0, 8),
    sizes: a.sizes,
    moq: a.moq,
    lowStock: a.availability === "low_stock",
  };
}

/** Only codes that are really on the website, in the order given, no repeats. */
export function pickProducts(codes: string[], articles: PublicArticle[], max: number): ChatProduct[] {
  const byCode = new Map(articles.map((a) => [a.code.toUpperCase(), a]));
  const seen = new Set<string>();
  const out: ChatProduct[] = [];
  for (const raw of codes) {
    const code = raw.trim().toUpperCase();
    const article = byCode.get(code);
    if (!article || seen.has(code)) continue;
    seen.add(code);
    out.push(toChatProduct(article));
    if (out.length >= max) break;
  }
  return out;
}

/** Tappable follow-ups: short, plain text only, at most three, none that mention money. */
export function cleanQuickReplies(list: string[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    const text = raw.replace(/[*_`#<>]/g, "").replace(/\s+/g, " ").trim();
    if (text.length < 2 || text.length > 32) continue;
    if (/₹|\b(?:rs\.?|inr|rupees?)\b|\d\s*\/-/i.test(text)) continue;
    if (out.some((t) => t.toLowerCase() === text.toLowerCase())) continue;
    out.push(text);
    if (out.length === 3) break;
  }
  return out;
}
