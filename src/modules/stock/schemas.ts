import { z } from "zod";
import { ARTICLE_CODE, GARMENTS, MAX_COLOURS, SIZE_OPTIONS } from "./constants";

/* The shapes the Add Stock forms send. Validated again on the server: the browser is never trusted. */

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const photoSchema = z.object({
  folder: z.string().regex(/^[a-f0-9]{32}$/),
  thumbUrl: z.url(),
  mediumUrl: z.url(),
  url: z.url(),
  blurDataUrl: z.string().max(4000),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const stockQty = z.number().int("Whole pieces only").min(0, "Cannot be negative").max(1_000_000);

export const colourSchema = z.object({
  name: z.string().trim().min(1, "Colour name is required").max(40),
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use exactly 3 letters"),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Pick a colour"),
  photos: z.array(photoSchema).max(12),
  stock: z.partialRecord(z.enum(SIZE_OPTIONS), stockQty),
});

export const articleFieldsSchema = z.object({
  code: z.string().trim().toUpperCase().regex(ARTICLE_CODE, "Format: LS-SH-0101 (shirt) or LS-PN-0101 (pant)"),
  name: z.string().trim().min(2, "Give the article a name").max(80),
  garment: z.enum(GARMENTS.map((g) => g.value) as [string, ...string[]]),
  style: text(40),
  brandId: z.uuid("Choose a brand"),
  fabric: text(60),
  pattern: text(60),
  description: text(1000),
  moq: z.number().int().min(1, "At least 1 piece").max(100_000),
  lotSize: z.number().int().min(1).max(100_000).nullable(),
  isFeatured: z.boolean(),
  isPublic: z.boolean(),
});

export const newArticleSchema = z
  .object({
    article: articleFieldsSchema,
    sizes: z.array(z.enum(SIZE_OPTIONS)).min(1, "Choose at least one size"),
    colours: z.array(colourSchema).min(1, "Add at least one colour").max(MAX_COLOURS),
    producedOn: z.iso.date(),
    notes: text(500),
  })
  .superRefine((value, ctx) => {
    const codes = new Set<string>();
    const names = new Set<string>();
    value.colours.forEach((c, i) => {
      if (codes.has(c.code)) ctx.addIssue({ code: "custom", path: ["colours", i, "code"], message: "Two colours use this code" });
      if (names.has(c.name.toLowerCase())) ctx.addIssue({ code: "custom", path: ["colours", i, "name"], message: "Two colours share this name" });
      codes.add(c.code);
      names.add(c.name.toLowerCase());
      for (const size of Object.keys(c.stock)) {
        if (!value.sizes.includes(size as (typeof SIZE_OPTIONS)[number])) {
          ctx.addIssue({ code: "custom", path: ["colours", i, "stock", size], message: "This size is not selected" });
        }
      }
    });
    if (value.article.isPublic) {
      value.colours.forEach((c, i) => {
        if (c.photos.length === 0) ctx.addIssue({ code: "custom", path: ["colours", i, "photos"], message: "Add a photo to publish" });
      });
    }
    const info = GARMENTS.find((g) => g.value === value.article.garment);
    if (info && !value.article.code.startsWith(`LS-${info.typeCode}-`)) {
      ctx.addIssue({ code: "custom", path: ["article", "code"], message: `A ${info.label.toLowerCase()} code starts with LS-${info.typeCode}-` });
    }
  });
export type NewArticleInput = z.input<typeof newArticleSchema>;

export const addStockSchema = z.object({
  producedOn: z.iso.date(),
  notes: text(500),
  rows: z
    .array(z.object({ variantId: z.uuid(), qty: z.number().int().min(1, "At least 1 piece").max(1_000_000) }))
    .min(1, "Enter at least one quantity")
    .max(500),
});
export type AddStockInput = z.input<typeof addStockSchema>;

export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
