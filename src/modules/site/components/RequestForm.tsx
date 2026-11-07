"use client";

import { useState } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Feedback";
import { TextInput, Textarea } from "@/components/ui/Field";
import { submitJson } from "../api-client";
import { whatsappLink } from "../links";
import { requestSchema, fieldErrors } from "../schemas";

/*
  Request Price (DESIGN.md §7): name and phone are required, everything else is optional.
  Used for one article (modal) and for the whole enquiry list (page). Below the minimum order we warn, never block.
*/

export interface RequestTarget {
  articleId: string;
  colourId: string | null;
  quantity: number | null;
  code: string;
  name: string;
  moq: number;
}

interface Props {
  targets: RequestTarget[];
  endpoint: "/api/leads" | "/api/enquiry";
  whatsapp: string | null;
  /** Show the single quantity field (one article). The list sets a quantity per row instead. */
  askQuantity?: boolean;
  onDone?: () => void;
  onSent?: () => void;
  formId: string;
}

export function RequestForm({ targets, endpoint, whatsapp, askQuantity = false, onDone, onSent, formId }: Props) {
  const [f, setF] = useState({ name: "", phone: "", businessName: "", city: "", instagram: "", quantity: "", note: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (c: Partial<typeof f>) => setF((cur) => ({ ...cur, ...c }));

  const qty = Number(f.quantity);
  const moq = targets.length === 1 ? targets[0].moq : 0;
  const belowMoq = askQuantity && moq > 0 && f.quantity.trim() !== "" && Number.isInteger(qty) && qty > 0 && qty < moq;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const body = {
      name: f.name, phone: f.phone, businessName: f.businessName, city: f.city, instagram: f.instagram, note: f.note, website: f.website,
      quantity: askQuantity ? f.quantity : null,
      items: targets.map((t) => ({ articleId: t.articleId, colourId: t.colourId, quantity: t.quantity })),
      ...(endpoint === "/api/leads" ? { kind: "request_price" as const } : {}),
    };
    const checked = requestSchema.safeParse(body);
    if (!checked.success) return setErrors(fieldErrors(checked.error));
    if (endpoint === "/api/enquiry" && targets.length === 0) return setFormError("Add at least one article to your list first.");
    setErrors({});
    setSending(true);
    const result = await submitJson(endpoint, body);
    setSending(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      return setFormError(result.error);
    }
    setSent(true);
    onSent?.();
  }

  if (sent) {
    const text = `Hello Leaf Star, this is ${f.name.trim()}. I just sent a price request${targets.length ? ` for ${targets.map((t) => t.code).join(", ")}` : ""}.`;
    const link = whatsappLink(whatsapp, text);
    return (
      <div role="status" className="flex flex-col items-center gap-4 py-4 text-center">
        <span className="inline-flex size-fab items-center justify-center rounded-full bg-success-bg text-success">
          <CheckCircle2 aria-hidden="true" className="size-icon-lg" />
        </span>
        <h3 className="type-h3">Thank you, we have your request</h3>
        <p className="max-w-prose type-body text-fg-muted">We will call you on the number you gave. If you would like a faster reply, message us on WhatsApp.</p>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "whatsapp", size: "lg" })}>
            <MessageCircle aria-hidden="true" className="size-icon" /> Continue on WhatsApp
          </a>
        ) : null}
        {onDone ? (
          <Button variant="secondary" onClick={onDone}>Close</Button>
        ) : null}
      </div>
    );
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <TextInput label="Your name" required autoComplete="name" value={f.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} />
      <TextInput label="Phone number" required type="tel" inputMode="tel" autoComplete="tel" prefix="+91" value={f.phone} onChange={(e) => set({ phone: e.target.value })} error={errors.phone} helper="We will call you on this number." />
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Business name" autoComplete="organization" value={f.businessName} onChange={(e) => set({ businessName: e.target.value })} error={errors.businessName} />
        <TextInput label="City" autoComplete="address-level2" value={f.city} onChange={(e) => set({ city: e.target.value })} error={errors.city} />
      </div>
      <TextInput label="Instagram handle" prefix="@" autoCapitalize="none" value={f.instagram} onChange={(e) => set({ instagram: e.target.value })} error={errors.instagram} helper="Optional" />
      {askQuantity ? (
        <TextInput
          label="Pieces needed"
          inputMode="numeric"
          value={f.quantity}
          onChange={(e) => set({ quantity: e.target.value })}
          error={errors.quantity}
          helper={moq > 0 ? `Minimum order for this article is ${moq} pieces.` : undefined}
        />
      ) : null}
      {belowMoq ? <Banner tone="warning">That is below our minimum of {moq} pieces. You can still send it and we will tell you what is possible.</Banner> : null}
      <Textarea label="Anything else we should know?" rows={3} value={f.note} onChange={(e) => set({ note: e.target.value })} error={errors.note} />
      {/* Bot trap: invisible to people. */}
      <div aria-hidden="true" className="absolute -left-24 top-0 h-0 w-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set({ website: e.target.value })} />
        </label>
      </div>
      {errors.items ? <Banner tone="danger">{errors.items}</Banner> : null}
      {formError ? <Banner tone="danger">{formError}</Banner> : null}
      <Button type="submit" size="lg" loading={sending} fullWidth>Send request</Button>
    </form>
  );
}
