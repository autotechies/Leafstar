/*
  Last line of defence for the chatbot (AGENTS.md §11). The prompt already tells the assistant never to give prices or
  stock numbers, but a reply is checked here anyway, so a mistake by the model never reaches a visitor.
  Pure functions: the same rules run in tests.
*/

export const PRICE_REFUSAL = "Our prices depend on the quantity and the lot, so the owner quotes them personally. Tap Request price on the article, or leave your number and we will call you back.";

const PRICE_PATTERNS: RegExp[] = [
  /₹\s*\d/,
  /\b(?:rs\.?|inr|rupees?)\s*\d/i,
  /\d\s*(?:rs\.?|inr|rupees?|\/-)(?![a-z])/i,
  /\b(?:price|rate|cost|costs|priced|charges?)\b[^.\n]{0,40}\b\d{2,}\b/i,
  /\b\d{2,}\s*(?:per|a|\/)\s*(?:piece|pc|pcs|shirt|pant|unit|lot)\b/i,
];

const STOCK_PATTERNS: RegExp[] = [
  /\b\d+\s*(?:pieces?|pcs|units?)\s*(?:in stock|available|left|remaining)\b/i,
  /\b(?:only|just)\s*\d+\s*(?:left|remaining|pieces?|pcs)\b/i,
  /\b(?:we have|stock is|stock of)\s*\d+\b/i,
];

export function leaksPrice(text: string): boolean {
  return PRICE_PATTERNS.some((p) => p.test(text));
}

export function leaksStock(text: string): boolean {
  return STOCK_PATTERNS.some((p) => p.test(text));
}

/** Returns the reply to show, and whether it had to be replaced. */
export function guardReply(reply: string, hiddenNames: string[] = []): { text: string; replaced: boolean } {
  const trimmed = reply.trim();
  if (!trimmed) return { text: PRICE_REFUSAL, replaced: true };
  if (leaksPrice(trimmed)) return { text: PRICE_REFUSAL, replaced: true };
  if (leaksStock(trimmed)) return { text: "I can tell you whether an article is available, but not exact stock numbers. Tell us how many pieces you need and the owner will confirm.", replaced: true };
  const lower = trimmed.toLowerCase();
  if (hiddenNames.some((n) => n.length > 2 && lower.includes(n.toLowerCase()))) {
    return { text: "Some of our work is made for other brands, so I cannot share that. I can tell you about our own articles, minimum lots and how ordering works.", replaced: true };
  }
  return { text: trimmed.slice(0, 1500), replaced: false };
}

/** A phone number the visitor typed in their own message (never taken from the model). */
export function phoneFromMessage(message: string): string | null {
  for (const m of message.matchAll(/(?:\+?\d[\d\s\-()]{8,16}\d)/g)) {
    const digits = m[0].replace(/\D/g, "");
    let d = digits;
    if (d.length === 10) d = `91${d}`;
    if (d.length === 11 && d.startsWith("0")) d = `91${d.slice(1)}`;
    if (d.length >= 11 && d.length <= 13) return d;
  }
  return null;
}
