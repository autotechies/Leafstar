"use client";

import { useId, useState } from "react";
import { CheckCircle2, Phone } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Feedback";
import { TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { cx } from "@/lib/cx";
import { formatPhone } from "@/lib/formats";
import { submitJson } from "../api-client";
import { telLink } from "../links";
import { callbackSchema, fieldErrors } from "../schemas";

/*
  The Call button opens a sheet with the number (tap to dial) and a "missed us?" callback form.
  Tapping the number logs a call_tap Inbox item. We cannot know whether a call connected, and never claim it.
*/

export function CallButton({ phone, variant = "header", className }: { phone: string | null; variant?: "header" | "icon" | "primary" | "secondary"; className?: string }) {
  const [open, setOpen] = useState(false);
  const label = "Call us";
  return (
    <>
      {variant === "icon" ? (
        <button type="button" aria-label={label} onClick={() => setOpen(true)} className={cx("inline-flex size-control shrink-0 items-center justify-center rounded-full text-chrome-fg hover:bg-chrome-line focus-ring", className)}>
          <Phone aria-hidden="true" className="size-icon" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cx(buttonClasses({ variant: variant === "header" ? "on-chrome" : variant, size: variant === "header" ? "md" : "lg" }), className)}
        >
          <Phone aria-hidden="true" className="size-icon" /> {label}
        </button>
      )}
      <CallSheet phone={phone} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function CallSheet({ phone, open, onClose }: { phone: string | null; open: boolean; onClose: () => void }) {
  const formId = useId();
  const [f, setF] = useState({ name: "", phone: "", instagram: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const dial = telLink(phone);

  function logTap() {
    void fetch("/api/call-tap", { method: "POST", keepalive: true }).catch(() => undefined);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const body = { ...f, kind: "callback" as const };
    const checked = callbackSchema.safeParse(body);
    if (!checked.success) return setErrors(fieldErrors(checked.error));
    setErrors({});
    setSending(true);
    const result = await submitJson("/api/leads", body);
    setSending(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      return setFormError(result.error);
    }
    setSent(true);
  }

  return (
    <Modal open={open} onClose={onClose} title="Call Leaf Star" description="Speak to our team, or leave your number.">
      {open ? (
        <div className="flex flex-col gap-6">
          {dial && phone ? (
            <a href={dial} onClick={logTap} className="flex flex-col items-center gap-2 rounded-lg bg-surface-2 px-4 py-6 text-center focus-ring">
              <Phone aria-hidden="true" className="size-icon-lg text-gold-text" />
              <span className="type-h2 tabular">{formatPhone(phone)}</span>
              <span className="type-small text-fg-muted">Tap to call</span>
            </a>
          ) : null}
          {sent ? (
            <div role="status" className="flex flex-col items-center gap-2 text-center">
              <CheckCircle2 aria-hidden="true" className="size-icon-lg text-success" />
              <p className="type-body font-semibold">Thank you. We will call you back.</p>
            </div>
          ) : (
            <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4 border-t border-border pt-6">
              <div className="flex flex-col gap-1">
                <h3 className="type-h4">Missed us? We will call you back</h3>
                <p className="type-small text-fg-muted">Leave your number and our team will ring you.</p>
              </div>
              <TextInput label="Your name" required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} />
              <TextInput label="Phone number" required type="tel" inputMode="tel" autoComplete="tel" prefix="+91" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} error={errors.phone} />
              <TextInput label="Instagram handle" prefix="@" autoCapitalize="none" value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} error={errors.instagram} helper="Optional" />
              <div aria-hidden="true" className="absolute -left-24 top-0 h-0 w-0 overflow-hidden">
                <label>
                  Website
                  <input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
                </label>
              </div>
              {formError ? <Banner tone="danger">{formError}</Banner> : null}
              <Button type="submit" size="lg" loading={sending} fullWidth>Request a callback</Button>
            </form>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
