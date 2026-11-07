"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inbox as InboxIcon, MessageCircle, Phone } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Feedback";
import { Banner } from "@/components/ui/Feedback";
import { Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { cx } from "@/lib/cx";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { formatPhone } from "@/lib/formats";
import { whatsappLink } from "@/modules/site/links";
import { dismissInboxAction, handleInboxAction } from "../actions";
import { kindLabel, type InboxContact, type InboxData } from "../types";
import { AlertsToggle } from "./AlertsToggle";

/*
  Owner Inbox (AGENTS.md §8): "someone tried to reach us. Has anyone replied?" One card per person, longest waiting first.
  The website cannot tell whether a call connected, so "Tapped Call" only says they tapped.
*/

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
function waited(iso: string): { text: string; late: boolean } {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000));
  if (hours < 1) return { text: "waiting less than an hour", late: false };
  if (hours < 24) return { text: `waiting ${hours} h`, late: false };
  return { text: `waiting ${Math.floor(hours / 24)} d ${hours % 24} h`, late: true };
}
type Via = "call" | "whatsapp" | "sms" | "other";
const viaLabel: Record<string, string> = { call: "Called", whatsapp: "WhatsApp", sms: "SMS", other: "Other" };

export function InboxView({ data }: { data: InboxData }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState("open");
  const [handling, setHandling] = useState<InboxContact | null>(null);
  const [via, setVia] = useState<Via>("call");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live: a new enquiry appears without reloading. A slow refresh covers a missed event.
  useEffect(() => {
    const supabase = supabaseBrowser();
    const channel = supabase.channel("inbox-items").on("postgres_changes", { event: "*", schema: "public", table: "inbox_items" }, () => router.refresh()).subscribe();
    const timer = window.setInterval(() => router.refresh(), 60_000);
    return () => {
      void supabase.removeChannel(channel);
      window.clearInterval(timer);
    };
  }, [router]);

  function startHandle(c: InboxContact, preset: Via) {
    setHandling(c);
    setVia(preset);
    setNote("");
    setError(null);
  }

  async function confirm() {
    if (!handling) return;
    setBusy(true);
    setError(null);
    const r = await handleInboxAction({ ids: handling.items.map((i) => i.id), via, note });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.show({ kind: "success", title: `Marked as handled${handling.name ? ` for ${handling.name}` : ""}.` });
    setHandling(null);
    router.refresh();
  }

  async function dismiss(c: InboxContact) {
    const r = await dismissInboxAction(c.items.map((i) => i.id));
    toast.show(r.ok ? { kind: "success", title: "Removed from waiting." } : { kind: "error", title: r.error });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <AlertsToggle publicKey={data.vapidPublicKey} />
      <Tabs label="Inbox sections" value={tab} onChange={setTab} items={[{ id: "open", label: "Waiting", count: data.open.length }, { id: "handled", label: "Handled", count: data.handled.length }]} />

      {tab === "open" ? (
        <TabPanel>
          {data.open.length === 0 ? (
            <EmptyState icon={InboxIcon} title="Nobody is waiting" description="When a buyer asks for a price, a call back or taps Call on your website, they appear here." />
          ) : (
            <ul className="flex flex-col gap-4">
              {data.open.map((c) => {
                const wa = c.phone ? whatsappLink(c.phone, "Hello, this is Leaf Star. You contacted us on our website.") : null;
                return (
                  <li key={c.key}>
                    <Card className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <h2 className="type-h4">{c.leadId ? <Link href={`/admin/crm/${c.leadId}`} className="rounded-sm hover:underline focus-ring">{c.name ?? "Unnamed"}</Link> : c.name ?? "Someone on the website"}</h2>
                          <p className="type-small text-fg-muted">{c.phone ? formatPhone(c.phone) : "Left no phone number"}</p>
                          <p className={cx("type-caption", waited(c.oldestAt).late ? "font-semibold text-danger" : "text-fg-muted")} suppressHydrationWarning>
                            Since {when(c.oldestAt)} · {waited(c.oldestAt).text}
                          </p>
                        </div>
                        <Badge tone="warning">{c.items.length} {c.items.length === 1 ? "request" : "requests"}</Badge>
                      </div>
                      <ul className="flex flex-col gap-2 border-t border-border pt-3">
                        {c.items.map((i) => (
                          <li key={i.id} className="flex flex-col gap-1 type-small">
                            <span className="font-semibold">{kindLabel[i.kind]}{i.articleCode ? ` · ${i.articleCode}` : ""}<span className="ml-2 font-normal text-fg-muted">{when(i.createdAt)}</span></span>
                            {i.preview ? <span className="text-fg-muted">{i.preview}</span> : null}
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
                        {c.phone ? (
                          <a href={`tel:+${c.phone}`} onClick={() => undefined} className="inline-flex min-h-control items-center justify-center gap-2 rounded-md bg-gold px-4 type-small font-bold text-on-gold focus-ring">
                            <Phone aria-hidden="true" className="size-icon-sm" /> Call
                          </a>
                        ) : null}
                        {wa ? (
                          <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-control items-center justify-center gap-2 rounded-md border border-border px-4 type-small font-bold focus-ring">
                            <MessageCircle aria-hidden="true" className="size-icon-sm" /> WhatsApp
                          </a>
                        ) : null}
                        <Button variant="secondary" onClick={() => startHandle(c, c.phone ? "call" : "other")}>Mark as handled</Button>
                        <Button variant="ghost" onClick={() => void dismiss(c)}>Not needed</Button>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </TabPanel>
      ) : (
        <TabPanel>
          {data.handled.length === 0 ? (
            <EmptyState icon={InboxIcon} title="Nothing handled yet" description="Items you mark as handled are kept here." />
          ) : (
            <ul className="flex flex-col gap-3">
              {data.handled.map((h) => (
                <li key={h.id}>
                  <Card className="flex flex-col gap-1">
                    <p className="type-body font-semibold">{h.name ?? "Someone on the website"}{h.phone ? ` · ${formatPhone(h.phone)}` : ""}</p>
                    <p className="type-small text-fg-muted">{kindLabel[h.kind]}{h.preview ? `: ${h.preview}` : ""}</p>
                    <p className="type-caption text-fg-muted">Handled {when(h.handledAt)}{h.via ? ` · ${viaLabel[h.via] ?? h.via}` : ""}{h.note ? ` · ${h.note}` : ""}</p>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabPanel>
      )}

      <Modal
        open={Boolean(handling)}
        onClose={() => setHandling(null)}
        title="Mark as handled"
        description={handling ? `${handling.name ?? "This person"}: ${handling.items.length} ${handling.items.length === 1 ? "request" : "requests"} will leave the waiting list.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setHandling(null)}>Cancel</Button>
            <Button loading={busy} onClick={() => void confirm()}>Mark as handled</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <fieldset className="flex flex-col gap-2">
            <legend className="type-small font-semibold">How did you reply?</legend>
            <div className="flex flex-wrap gap-2">
              {(["call", "whatsapp", "sms", "other"] as const).map((v) => (
                <Button key={v} size="sm" variant={via === v ? "primary" : "secondary"} aria-pressed={via === v} onClick={() => setVia(v)}>{viaLabel[v]}</Button>
              ))}
            </div>
          </fieldset>
          <Textarea label="Note (optional)" rows={2} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
