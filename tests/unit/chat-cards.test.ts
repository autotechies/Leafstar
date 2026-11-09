import { describe, expect, it } from "vitest";
import { cleanQuickReplies, pickProducts } from "@/modules/chat/cards";
import { formatReply } from "@/modules/chat/format";
import { buildSystemPrompt, CHAT_JSON_SCHEMA } from "@/modules/chat/prompt";
import type { PublicArticle } from "@/modules/site/data";

const art = (code: string, over: Partial<PublicArticle> = {}): PublicArticle => ({
  id: code, code, name: `Shirt ${code}`, garment: "Shirt", category: "upperwear", style: null, brand: "Leaf Star", fabric: null, pattern: null, description: null, moq: 50, lotSize: null,
  featured: false, createdAt: "2026-01-01", sizes: ["M", "L"], colours: [{ id: "c", name: "Navy", hex: "#1C2B4A", sizes: ["M"], photos: [{ id: "p", thumbUrl: "/t.jpg", mediumUrl: "/m.jpg", url: "/l.jpg", width: 1, height: 1, alt: "" }] }], photos: [], availability: "in_stock", ...over,
});

describe("product cards", () => {
  const articles = [art("LS-SH-0001"), art("LS-SH-0002", { availability: "low_stock" })];
  it("builds cards only for codes that are on the website, in order, without repeats", () => {
    const cards = pickProducts(["ls-sh-0002", "LS-XX-9999", "LS-SH-0001", "LS-SH-0002"], articles, 4);
    expect(cards.map((c) => c.code)).toEqual(["LS-SH-0002", "LS-SH-0001"]);
    expect(cards[0].lowStock).toBe(true);
    expect(cards[1]).toMatchObject({ moq: 50, sizes: ["M", "L"], thumb: "/t.jpg", colours: [{ name: "Navy", hex: "#1C2B4A" }] });
  });
  it("respects the maximum", () => {
    expect(pickProducts(["LS-SH-0001", "LS-SH-0002"], articles, 1)).toHaveLength(1);
  });
  it("cards carry no price and no exact stock", () => {
    expect(Object.keys(pickProducts(["LS-SH-0001"], articles, 1)[0]).sort()).toEqual(["code", "colours", "garment", "lowStock", "moq", "name", "sizes", "thumb"]);
  });
});

describe("quick replies", () => {
  it("keeps short plain options, at most three, no repeats", () => {
    expect(cleanQuickReplies(["Show me pants", "show me PANTS", "Minimum order", "**How to order**", "Talk to the owner"])).toEqual(["Show me pants", "Minimum order", "How to order"]);
  });
  it("drops anything about money or too long", () => {
    expect(cleanQuickReplies(["Price is ₹450", "Rs 300 offer", "Rate 200/-", "a".repeat(40), "x"])).toEqual([]);
  });
});

describe("reply formatting", () => {
  it("makes paragraphs, bullets and bold, and never HTML", () => {
    const blocks = formatReply("We have two shirts:\n- **LS-SH-0001** in navy\n- **LS-SH-0002** in grey\n\nWant sizes?");
    expect(blocks).toEqual([
      { kind: "p", parts: [{ text: "We have two shirts:", bold: false }] },
      { kind: "ul", items: [[{ text: "LS-SH-0001", bold: true }, { text: " in navy", bold: false }], [{ text: "LS-SH-0002", bold: true }, { text: " in grey", bold: false }]] },
      { kind: "p", parts: [{ text: "Want sizes?", bold: false }] },
    ]);
    const evil = formatReply("<img src=x onerror=alert(1)> **hi**");
    expect(JSON.stringify(evil)).toContain("<img"); // kept as plain text; the widget renders text nodes only
    expect(evil[0].kind).toBe("p");
  });
  it("handles numbered lists and stray asterisks", () => {
    expect(formatReply("1. First\n2) Second")[0]).toMatchObject({ kind: "ul" });
    expect(formatReply("a * b")[0]).toMatchObject({ kind: "p", parts: [{ text: "a  b" }] });
  });
});

describe("assistant persona and schema", () => {
  const prompt = buildSystemPrompt({ settings: null, articles: [art("LS-SH-0001")], faqs: [], memory: null, focus: null });
  it("is Leaf Star, with the writing style and without unconfirmed claims", () => {
    expect(prompt).toContain("You are Leaf Star");
    expect(prompt).toContain("HOW TO WRITE");
    expect(prompt).toContain("never ask something you already asked");
    expect(prompt).not.toMatch(/own label\.\s*$/m);
    expect(prompt).toContain("NOT confirmed");
  });
  it("asks the model for cards and chips", () => {
    expect(CHAT_JSON_SCHEMA.required).toEqual(expect.arrayContaining(["product_codes", "quick_replies"]));
  });
});
