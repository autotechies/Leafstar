import { describe, expect, it } from "vitest";
import { guardReply, leaksPrice, leaksStock, phoneFromMessage, PRICE_REFUSAL } from "@/modules/chat/guard";
import { buildSystemPrompt } from "@/modules/chat/prompt";
import type { PublicArticle } from "@/modules/site/data";

const article: PublicArticle = {
  id: "a1", code: "LS-SH-9100", name: "Oxford Shirt", garment: "shirt", category: "formal", style: null, brand: "Leaf Star", fabric: "cotton", pattern: null,
  description: null, moq: 50, lotSize: 10, featured: false, createdAt: "2026-01-01", sizes: ["M", "L"], colours: [{ id: "c1", name: "Navy", hex: "#000", sizes: ["M"], photos: [] }], photos: [], availability: "in_stock",
};

describe("price and stock guard", () => {
  it.each(["It costs ₹450 per piece", "Rs. 399 only", "the rate is 450 per piece", "About 300 rupees", "price is around 500", "450/-"])("blocks price: %s", (t) => {
    expect(leaksPrice(t)).toBe(true);
    expect(guardReply(t).text).toBe(PRICE_REFUSAL);
  });
  it.each(["We have 120 pieces in stock", "Only 5 left", "stock is 300"])("blocks stock: %s", (t) => {
    expect(leaksStock(t)).toBe(true);
    expect(guardReply(t).replaced).toBe(true);
  });
  it("lets normal answers through", () => {
    const ok = "Our minimum order is 50 pieces and shirts come in M, L and XL.";
    expect(guardReply(ok)).toEqual({ text: ok, replaced: false });
    expect(guardReply("Lots of 100 pieces are possible for pants.").replaced).toBe(false);
  });
  it("never names a hidden brand", () => {
    expect(guardReply("We also make for Zorro Wear.", ["Zorro Wear"]).replaced).toBe(true);
  });
  it("replaces an empty reply", () => {
    expect(guardReply("   ").replaced).toBe(true);
  });
});

describe("phone from the visitor's own message", () => {
  it("finds Indian numbers in several writings", () => {
    expect(phoneFromMessage("call me on 98765 43210")).toBe("919876543210");
    expect(phoneFromMessage("my number is +91-98765-43210 thanks")).toBe("919876543210");
    expect(phoneFromMessage("09876543210")).toBe("919876543210");
  });
  it("ignores numbers that are not phones", () => {
    expect(phoneFromMessage("I need 100 pieces of 3 colours")).toBeNull();
    expect(phoneFromMessage("hello")).toBeNull();
  });
});

describe("system prompt", () => {
  const prompt = buildSystemPrompt({
    settings: { businessName: "Leaf Star", tagline: "Wholesale", phone: "919876543210", whatsapp: "919876543210", email: null, address: null, city: "Surat", instagram: null },
    articles: [article], faqs: [{ question: "Do you give credit?", answer: "Yes, to known buyers." }], memory: null, focus: article,
  });
  it("carries the rules, the article and the FAQ", () => {
    expect(prompt).toContain("Never state or estimate a price");
    expect(prompt).toContain("LS-SH-9100");
    expect(prompt).toContain("Do you give credit?");
    expect(prompt).toContain("THE VISITOR IS LOOKING AT");
  });
  it("contains no price or stock figure and omits memory when there is none", () => {
    expect(prompt).not.toMatch(/₹/);
    expect(prompt).not.toContain("WHAT WE REMEMBER");
  });
});
