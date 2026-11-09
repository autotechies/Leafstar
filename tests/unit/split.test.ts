import { describe, expect, it } from "vitest";
import { sizesInText, suggestSplit, type SplitVariant } from "@/modules/bills/split";

const colours = ["Navy", "Sky Blue", "Grey"];
const sizes = ["S", "M", "L", "XL", "XXL"];
const stockOf: Record<string, number> = { Navy: 300, "Sky Blue": 200, Grey: 100 };
const variants: SplitVariant[] = colours.flatMap((c) => sizes.map((s) => ({ id: `${c}-${s}`, colour: c, size: s, stock: stockOf[c] / 5 })));
const total = (r: { lines: Array<{ qty: number }> }) => r.lines.reduce((s, l) => s + l.qty, 0);

describe("sizes in the bill text", () => {
  it("reads ranges, lists and nothing", () => {
    expect(sizesInText("S-XXL")).toEqual(["S", "M", "L", "XL", "XXL"]);
    expect(sizesInText("Sizes S to XL")).toEqual(["S", "M", "L", "XL"]);
    expect(sizesInText("M, L")).toEqual(["M", "L"]);
    expect(sizesInText("free size")).toBeNull();
  });
});

describe("suggested split of an assorted line", () => {
  it("covers the whole line from stock, in proportion, never above any stock", () => {
    const r = suggestSplit({ qty: 300, variants, sizeText: "S-XXL", colourText: "Assorted Colours" })!;
    expect(total(r)).toBe(300);
    expect(r.shortfall).toBe(0);
    expect(r.basis).toBe("stock");
    for (const l of r.lines) expect(l.qty).toBeLessThanOrEqual(variants.find((v) => v.id === l.variantId)!.stock);
    const navy = r.lines.filter((l) => l.variantId.startsWith("Navy")).reduce((s, l) => s + l.qty, 0);
    const grey = r.lines.filter((l) => l.variantId.startsWith("Grey")).reduce((s, l) => s + l.qty, 0);
    expect(navy).toBe(150); // 300 of 600 in stock
    expect(grey).toBe(50);
  });
  it("reports a shortfall instead of inventing pieces", () => {
    const r = suggestSplit({ qty: 1000, variants, sizeText: "S-XXL", colourText: "assorted" })!;
    expect(total(r)).toBe(600);
    expect(r.shortfall).toBe(400);
  });
  it("keeps to the sizes on the bill and to a named colour", () => {
    const r = suggestSplit({ qty: 60, variants, sizeText: "S to L", colourText: "Navy" })!;
    expect(total(r)).toBe(60);
    expect(r.lines.every((l) => l.variantId.startsWith("Navy") && ["S", "M", "L"].some((s) => l.variantId.endsWith(`-${s}`)))).toBe(true);
  });
  it("follows what the buyer took before, in the same proportion", () => {
    const r = suggestSplit({ qty: 20, variants, sizeText: "S-XXL", colourText: "Assorted", history: { "Grey-M": 30, "Grey-L": 10 } })!;
    expect(r.basis).toBe("history");
    expect(r.lines).toEqual([{ variantId: "Grey-M", qty: 15 }, { variantId: "Grey-L", qty: 5 }]);
  });
  it("never goes above stock, and tops up from what we hold when the buyer's usual pieces run out", () => {
    const r = suggestSplit({ qty: 100, variants, sizeText: "S-XXL", colourText: "Assorted", history: { "Grey-M": 30, "Grey-L": 10 } })!;
    expect(total(r)).toBe(100);
    expect(r.lines.find((l) => l.variantId === "Grey-M")!.qty).toBe(20);
    expect(r.lines.find((l) => l.variantId === "Grey-L")!.qty).toBe(20);
    for (const l of r.lines) expect(l.qty).toBeLessThanOrEqual(variants.find((v) => v.id === l.variantId)!.stock);
  });
  it("skips colours and sizes with no stock and gives nothing for an empty pool", () => {
    const none = variants.map((v) => ({ ...v, stock: 0 }));
    expect(suggestSplit({ qty: 10, variants: none, sizeText: "", colourText: "" })).toBeNull();
    expect(suggestSplit({ qty: 0, variants, sizeText: "", colourText: "" })).toBeNull();
  });
});
