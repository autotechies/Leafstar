import presets from "./colour-presets.json";
import defaults from "./colour-default.json";

const defaultHex: string = defaults.hex;

/* Shared by forms and server. Presets are starting points the owner can edit per article. */

export const SIZE_OPTIONS = ["S", "M", "L", "XL", "XXL"] as const;
export type SizeName = (typeof SIZE_OPTIONS)[number];

export const GARMENTS = [
  { value: "Shirt", label: "Shirt", category: "upperwear", typeCode: "SH" },
  { value: "Pant", label: "Pant", category: "lowerwear", typeCode: "PN" },
] as const;
export type Garment = (typeof GARMENTS)[number]["value"];

export function garmentInfo(garment: string) {
  return GARMENTS.find((g) => g.value === garment) ?? null;
}

export const SHIRT_STYLES = ["Casual", "Formal", "Check", "Printed", "Plain", "Linen", "Oxford"] as const;
export const PANT_STYLES = ["Cargo", "Jeans", "Formal", "Chino", "Casual", "Track"] as const;
export const FABRICS = ["Cotton", "Cotton blend", "Linen", "Polyester blend", "Denim", "Twill", "Poplin"] as const;
export const PATTERNS = ["Solid", "Checks", "Stripes", "Printed", "Textured"] as const;

/** Common garment colours with a usable swatch. Name, 3-letter code and hex are all editable in the form. */
export const COLOUR_PRESETS: ReadonlyArray<{ name: string; code: string; hex: string }> = presets;
export const DEFAULT_COLOUR_HEX = defaultHex;

export const ARTICLE_CODE = /^LS-(SH|PN)-\d{4}$/;
export const MAX_COLOURS = 24;
export const DEFAULT_MOQ = 50;
