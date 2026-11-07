"use client";

import { useId, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Feedback";
import { TextInput, Textarea } from "@/components/ui/Field";
import { submitJson } from "../api-client";
import { contactSchema, fieldErrors } from "../schemas";

export function ContactForm() {
  const formId = useId();
  const [f, setF] = useState({ name: "", phone: "", email: "", message: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (c: Partial<typeof f>) => setF((cur) => ({ ...cur, ...c }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const checked = contactSchema.safeParse(f);
    if (!checked.success) return setErrors(fieldErrors(checked.error));
    setErrors({});
    setSending(true);
    const result = await submitJson("/api/contact", f);
    setSending(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      return setFormError(result.error);
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 aria-hidden="true" className="size-icon-lg text-success" />
        <h3 className="type-h3">Thank you, we have your message</h3>
        <p className="type-body text-fg-muted">Our team will call you on the number you gave.</p>
      </div>
    );
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <TextInput label="Your name" required autoComplete="name" value={f.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} />
      <TextInput label="Phone number" required type="tel" inputMode="tel" autoComplete="tel" prefix="+91" value={f.phone} onChange={(e) => set({ phone: e.target.value })} error={errors.phone} />
      <TextInput label="Email" type="email" autoComplete="email" value={f.email} onChange={(e) => set({ email: e.target.value })} error={errors.email} helper="Optional" />
      <Textarea label="How can we help?" required rows={5} value={f.message} onChange={(e) => set({ message: e.target.value })} error={errors.message} />
      <div aria-hidden="true" className="absolute -left-24 top-0 h-0 w-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set({ website: e.target.value })} />
        </label>
      </div>
      {formError ? <Banner tone="danger">{formError}</Banner> : null}
      <Button type="submit" size="lg" loading={sending} fullWidth>Send message</Button>
    </form>
  );
}
