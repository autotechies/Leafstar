import { z } from "zod";
import { normalizeInstagram, normalizePhone } from "@/lib/formats";

/* The checks for every public form. The same schema runs in the browser (friendly messages) and on the server (the real check). */

const phone = z
  .string()
  .trim()
  .refine((v) => normalizePhone(v) !== null, "Enter a phone number with 10 digits")
  .transform((v) => normalizePhone(v) as string);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((v) => (v === "" ? null : v))
    .nullish()
    .transform((v) => v ?? null);

const instagram = z
  .string()
  .trim()
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null;
    const handle = normalizeInstagram(v);
    if (!handle) ctx.addIssue({ code: "custom", message: "Enter a valid Instagram handle, like leafstar" });
    return handle;
  });

const quantity = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v, ctx) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 1_000_000) {
      ctx.addIssue({ code: "custom", message: "Enter the number of pieces, like 100" });
      return null;
    }
    return n;
  });

const item = z.object({
  articleId: z.uuid(),
  colourId: z.uuid().nullish().transform((v) => v ?? null),
  quantity,
});

const person = {
  name: z.string().trim().min(2, "Enter your name").max(80, "Keep your name under 80 characters"),
  phone,
  /** Bot trap: real visitors never see or fill this. */
  website: z.string().max(0).optional(),
};

export const requestSchema = z.object({
  ...person,
  businessName: optionalText(100),
  city: optionalText(60),
  instagram,
  quantity,
  note: optionalText(500),
  items: z.array(item).max(30),
});
export type RequestInput = z.input<typeof requestSchema>;

export const callbackSchema = z.object({ ...person, instagram });
export const contactSchema = z.object({
  ...person,
  email: z.string().trim().max(120).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address").nullish().transform((v) => v || null),
  message: z.string().trim().min(5, "Write a few words about what you need").max(1000, "Keep your message under 1,000 characters"),
});

/** Field → first message, for showing under each input. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
