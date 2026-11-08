import { describe, expect, it } from "vitest";
import { isAssortedLine } from "@/modules/bills/assorted";

describe("assorted bill lines", () => {
  it("treats a size range as not one size (the owner's real invoice line)", () => {
    expect(isAssortedLine({ size: "S-XXL", colour: "Assorted Colours", name: "Men's Premium Cotton Shirt (Sizes: S-XXL, Assorted Colours)" })).toBe(true);
  });
  it("treats an empty size as unclear", () => {
    expect(isAssortedLine({ size: "", colour: "Navy", name: "Check Shirt" })).toBe(true);
  });
  it("treats mixed-colour wording as unclear even when one size is named", () => {
    expect(isAssortedLine({ size: "M", colour: "", name: "Check Shirt, assorted colours" })).toBe(true);
    expect(isAssortedLine({ size: "M", colour: "Mixed", name: "Check Shirt" })).toBe(true);
  });
  it("accepts a line with one size and one colour", () => {
    expect(isAssortedLine({ size: "m", colour: "Navy", name: "Check Shirt" })).toBe(false);
    expect(isAssortedLine({ size: "XXL", colour: "Sky Blue", name: "Check Shirt" })).toBe(false);
  });
});
