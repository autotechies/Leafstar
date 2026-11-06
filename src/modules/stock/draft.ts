import type { UploadedPhoto } from "@/modules/images/components/PhotoUploader";
import { ARTICLE_CODE, DEFAULT_MOQ, MAX_COLOURS, garmentInfo, type SizeName } from "./constants";
import { newArticleSchema, type NewArticleInput } from "./schemas";

/*
  The "New article" form's working state, kept as plain text fields (so half-typed numbers never break anything),
  plus the pure functions that check each step and turn the draft into what the server receives.
*/

export interface ColourDraft {
  key: string;
  name: string;
  code: string;
  hex: string;
  photos: UploadedPhoto[];
  stock: Record<string, string>;
}

export interface Draft {
  step: number;
  garment: string;
  code: string;
  name: string;
  brandId: string;
  style: string;
  fabric: string;
  pattern: string;
  description: string;
  moq: string;
  lotSize: string;
  featured: boolean;
  isPublic: boolean;
  sizes: SizeName[];
  colours: ColourDraft[];
  producedOn: string;
  notes: string;
}

export const STEPS = ["Article", "Colours & sizes", "Photos", "Stock", "Review"] as const;

export function emptyDraft(today: string): Draft {
  return {
    step: 0, garment: "", code: "", name: "", brandId: "", style: "", fabric: "", pattern: "", description: "",
    moq: String(DEFAULT_MOQ), lotSize: "", featured: false, isPublic: false,
    sizes: ["S", "M", "L", "XL"], colours: [], producedOn: today, notes: "",
  };
}

const num = (v: string): number => (v.trim() === "" ? Number.NaN : Number(v.replace(/,/g, "")));

export function toInput(d: Draft): NewArticleInput {
  return {
    article: {
      code: d.code, name: d.name, garment: d.garment, style: d.style, brandId: d.brandId, fabric: d.fabric, pattern: d.pattern,
      description: d.description, moq: num(d.moq), lotSize: d.lotSize.trim() === "" ? null : num(d.lotSize),
      isFeatured: d.featured, isPublic: d.isPublic,
    },
    sizes: d.sizes,
    colours: d.colours.map((c) => ({
      name: c.name, code: c.code, hex: c.hex,
      photos: c.photos.filter((p) => p.status === "done" && p.image).map((p) => ({ ...p.image! })),
      stock: Object.fromEntries(d.sizes.map((s) => [s, c.stock[s]?.trim() === "" || c.stock[s] === undefined ? 0 : num(c.stock[s])])) as Partial<Record<SizeName, number>>,
    })),
    producedOn: d.producedOn,
    notes: d.notes,
  };
}

/** Problems that stop the person moving past a step. Keys are field paths, as the server uses. */
export function stepProblems(d: Draft, step: number): Record<string, string> {
  const out: Record<string, string> = {};
  if (step === 0) {
    if (!garmentInfo(d.garment)) out["article.garment"] = "Choose Shirt or Pant";
    if (!ARTICLE_CODE.test(d.code.trim().toUpperCase())) out["article.code"] = "Format: LS-SH-0101 (shirt) or LS-PN-0101 (pant)";
    else {
      const info = garmentInfo(d.garment);
      if (info && !d.code.trim().toUpperCase().startsWith(`LS-${info.typeCode}-`)) out["article.code"] = `A ${info.label.toLowerCase()} code starts with LS-${info.typeCode}-`;
    }
    if (d.name.trim().length < 2) out["article.name"] = "Give the article a name";
    if (!d.brandId) out["article.brandId"] = "Choose a brand";
    const moq = num(d.moq);
    if (!Number.isInteger(moq) || moq < 1) out["article.moq"] = "Whole pieces, at least 1";
    if (d.lotSize.trim() !== "") {
      const lot = num(d.lotSize);
      if (!Number.isInteger(lot) || lot < 1) out["article.lotSize"] = "Whole pieces, or leave empty";
    }
  }
  if (step === 1) {
    if (d.sizes.length === 0) out.sizes = "Choose at least one size";
    if (d.colours.length === 0) out.colours = "Add at least one colour";
    if (d.colours.length > MAX_COLOURS) out.colours = `At most ${MAX_COLOURS} colours`;
    const codes = new Set<string>();
    const names = new Set<string>();
    d.colours.forEach((c, i) => {
      if (c.name.trim() === "") out[`colours.${i}.name`] = "Colour name is required";
      else if (names.has(c.name.trim().toLowerCase())) out[`colours.${i}.name`] = "Two colours share this name";
      if (!/^[A-Za-z]{3}$/.test(c.code.trim())) out[`colours.${i}.code`] = "Use exactly 3 letters";
      else if (codes.has(c.code.trim().toUpperCase())) out[`colours.${i}.code`] = "Two colours use this code";
      if (!/^#[0-9A-Fa-f]{6}$/.test(c.hex)) out[`colours.${i}.hex`] = "Pick a colour";
      codes.add(c.code.trim().toUpperCase());
      names.add(c.name.trim().toLowerCase());
    });
  }
  if (step === 2 && d.colours.some((c) => c.photos.some((p) => p.status === "uploading"))) out.photos = "Wait for the photos to finish uploading";
  if (step === 3) {
    d.colours.forEach((c, i) =>
      d.sizes.forEach((s) => {
        const raw = c.stock[s];
        if (raw !== undefined && raw.trim() !== "") {
          const q = num(raw);
          if (!Number.isInteger(q) || q < 0) out[`colours.${i}.stock.${s}`] = "Whole pieces, 0 or more";
        }
      }),
    );
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.producedOn)) out.producedOn = "Choose the production date";
  }
  return out;
}

/** The server's own checks, applied to the whole draft (used on the Review step before saving). */
export function wholeDraftProblems(d: Draft): Record<string, string> {
  const parsed = newArticleSchema.safeParse(toInput(d));
  if (parsed.success) return {};
  const out: Record<string, string> = {};
  for (const issue of parsed.error.issues) out[issue.path.map(String).join(".") || "form"] ??= issue.message;
  return out;
}

export function totalPieces(d: Draft): number {
  return d.colours.reduce((sum, c) => sum + d.sizes.reduce((s, size) => s + (Number.isInteger(num(c.stock[size] ?? "")) ? num(c.stock[size] ?? "") : 0), 0), 0);
}

/* ---------- saving the draft in the browser (AGENTS.md §6: browser storage holds only form drafts) ---------- */

const KEY = "ls-draft-new-article-v1";

export function saveDraft(d: Draft): void {
  try {
    const slim: Draft = {
      ...d,
      // Only photos that finished uploading are kept: a half-sent file cannot be resumed.
      colours: d.colours.map((c) => ({ ...c, photos: c.photos.filter((p) => p.status === "done").map((p) => ({ ...p, file: null, preview: "" })) })),
    };
    window.localStorage.setItem(KEY, JSON.stringify(slim));
  } catch {
    /* storage can be full or blocked: the form still works, it just won't be remembered */
  }
}

export function loadDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!d || !Array.isArray(d.colours) || !Array.isArray(d.sizes)) return null;
    return d;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** True when the person has typed or chosen anything worth keeping. */
export function isDirty(d: Draft, today: string): boolean {
  const base = emptyDraft(today);
  return d.garment !== "" || d.code !== "" || d.name !== "" || d.colours.length > 0 || d.notes !== "" || d.description !== "" || d.step !== base.step;
}
