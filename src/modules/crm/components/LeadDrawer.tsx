"use client";

import { useEffect, useState } from "react";
import { AtSign, MessageCircle, Phone } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Feedback";
import { Select, Textarea, TextInput } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatPhone } from "@/lib/formats";
import { formatRupees } from "@/lib/numbers";
import { ImageViewer } from "@/modules/images/components/LazyImageViewer";
import { whatsappLink } from "@/modules/site/links";
import { addActivityAction, loadLeadAction, saveLeadDetailsAction } from "../actions";
import { sourceLabel, STAGES, stageLabel, type LeadDetail, type Stage } from "../types";
import type { Photo } from "@/modules/images/types";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const kindLabel: Record<string, string> = { note: "Note", call: "Call", whatsapp: "WhatsApp", stage_change: "Stage", enquiry: "Enquiry", quote: "Quote", follow_up: "Follow-up" };

/* Lead drawer (AGENTS.md §13): contact, articles asked about, timeline, follow-up date, quoted amount. */
export function LeadDrawer({ leadId, onClose, onChanged, onStageChange }: { leadId: string | null; onClose: () => void; onChanged: () => void; onStageChange: (lead: LeadDetail, stage: Stage) => void }) {
  const toast = useToast();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quoted, setQuoted] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [note, setNote] = useState("");
  const [noteKind, setNoteKind] = useState<"note" | "call" | "whatsapp">("note");
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<{ photos: Photo[]; index: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!leadId) return;
      const r = await loadLeadAction(leadId);
      if (cancelled) return;
      if (!r.ok) return setError(r.error);
      setError(null);
      setLead(r.lead);
      setQuoted(r.lead.quotedAmount === null ? "" : String(r.lead.quotedAmount));
      setFollowUp(r.lead.nextFollowUp ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  async function reload() {
    if (!leadId) return;
    const r = await loadLeadAction(leadId);
    if (r.ok) {
      setLead(r.lead);
      setQuoted(r.lead.quotedAmount === null ? "" : String(r.lead.quotedAmount));
      setFollowUp(r.lead.nextFollowUp ?? "");
    }
  }

  async function saveDetails() {
    if (!lead) return;
    const amount = quoted.trim() === "" ? null : Number(quoted.replace(/[^\d.]/g, ""));
    if (amount !== null && !Number.isFinite(amount)) return setError("Enter the amount as a number.");
    setBusy(true);
    setError(null);
    const r = await saveLeadDetailsAction({ id: lead.id, expected: lead.updatedAt, quotedAmount: amount, nextFollowUp: followUp || null });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast.show({ kind: "success", title: "Saved." });
    await reload();
    onChanged();
  }

  async function addNote() {
    if (!lead) return;
    setBusy(true);
    const r = await addActivityAction({ id: lead.id, kind: noteKind, body: note });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setNote("");
    setError(null);
    await reload();
  }

  const wa = lead ? whatsappLink(lead.phone, "Hello, this is Leaf Star.") : null;
  const overdue = lead?.nextFollowUp && lead.nextFollowUp < new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) && lead.stage !== "won" && lead.stage !== "lost";

  return (
    <Drawer open={Boolean(leadId)} onClose={onClose} title={lead?.name ?? "Lead"} description={lead ? [lead.businessName, lead.city].filter(Boolean).join(" · ") || undefined : undefined}>
      {!lead ? (
        <p className="type-small text-fg-muted">{error ?? "Loading…"}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <div className="flex flex-wrap gap-2">
            <a href={`tel:+${lead.phone}`} className="inline-flex min-h-control items-center gap-2 rounded-md bg-gold px-4 type-small font-bold text-on-gold focus-ring"><Phone aria-hidden="true" className="size-icon-sm" /> {formatPhone(lead.phone)}</a>
            {wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-control items-center gap-2 rounded-md border border-border px-4 type-small font-bold focus-ring"><MessageCircle aria-hidden="true" className="size-icon-sm" /> WhatsApp</a> : null}
            {lead.instagram ? <a href={`https://instagram.com/${lead.instagram}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-control items-center gap-2 rounded-md border border-border px-4 type-small font-bold focus-ring"><AtSign aria-hidden="true" className="size-icon-sm" /> {lead.instagram}</a> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{sourceLabel[lead.source] ?? lead.source}</Badge>
            {overdue ? <Badge tone="danger">Follow-up overdue</Badge> : null}
          </div>
          {lead.message ? <p className="rounded-md bg-surface-2 p-3 type-small">{lead.message}</p> : null}
          {lead.stage === "lost" && lead.lostReason ? <Banner tone="warning">Lost: {lead.lostReason}</Banner> : null}

          <Select label="Stage" value={lead.stage} options={STAGES.map((s) => ({ value: s, label: stageLabel[s] }))} onChange={(e) => onStageChange(lead, e.target.value as Stage)} />

          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Quoted amount (₹)" inputMode="decimal" value={quoted} onChange={(e) => setQuoted(e.target.value)} helper={lead.quotedAmount !== null ? `Currently ${formatRupees(lead.quotedAmount)}` : "Only you see this."} />
            <TextInput label="Follow up on" type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} error={overdue ? "This date has passed" : undefined} />
          </div>
          <div><Button variant="secondary" loading={busy} onClick={() => void saveDetails()}>Save amount and date</Button></div>

          <section aria-label="Articles asked about" className="flex flex-col gap-3">
            <h3 className="type-h4">Articles asked about</h3>
            {lead.items.length === 0 ? <p className="type-small text-fg-muted">No articles were chosen.</p> : (
              <ul className="flex flex-col gap-3">
                {lead.items.map((i) => (
                  <li key={i.id} className="flex items-center gap-3">
                    {i.photos[0] ? (
                      <button type="button" aria-label={`Open photos of ${i.articleName}`} onClick={() => setViewer({ photos: i.photos, index: 0 })} className="shrink-0 overflow-hidden rounded-md focus-ring">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={i.photos[0].thumbUrl} alt="" className="aspect-4/5 w-12 object-cover" />
                      </button>
                    ) : <div aria-hidden="true" className="aspect-4/5 w-12 shrink-0 rounded-md bg-surface-2" />}
                    <div className="min-w-0">
                      <p className="type-small font-semibold">{i.articleName}</p>
                      <p className="type-caption text-fg-muted">{i.articleCode}{i.colour ? ` · ${i.colour}` : ""}{i.quantity ? ` · ${i.quantity} pieces` : ""}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Timeline" className="flex flex-col gap-3">
            <h3 className="type-h4">Timeline</h3>
            <div className="flex flex-col gap-2">
              <Select label="Add" value={noteKind} onChange={(e) => setNoteKind(e.target.value as typeof noteKind)} options={[{ value: "note", label: "A note" }, { value: "call", label: "I called" }, { value: "whatsapp", label: "I messaged on WhatsApp" }]} />
              <Textarea label="What happened" rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
              <div><Button size="sm" loading={busy} disabled={!note.trim()} onClick={() => void addNote()}>Add to timeline</Button></div>
            </div>
            <ul className="flex flex-col gap-3 border-l border-border pl-4">
              {lead.activities.map((a) => (
                <li key={a.id} className="type-small">
                  <span className="font-semibold">{kindLabel[a.kind] ?? a.kind}</span>
                  <span className="ml-2 text-fg-muted">{when(a.createdAt)}</span>
                  {a.body ? <p className="mt-1 text-fg-muted">{a.body}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
      {viewer ? <ImageViewer photos={viewer.photos} open index={viewer.index} onIndexChange={(index) => setViewer((v) => (v ? { ...v, index } : v))} onClose={() => setViewer(null)} /> : null}
    </Drawer>
  );
}
