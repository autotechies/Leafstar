"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Feedback";
import { Select, Textarea, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { cx } from "@/lib/cx";
import { formatDay, formatPhone } from "@/lib/formats";
import { formatRupees } from "@/lib/numbers";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { createLeadAction, moveLeadAction } from "../actions";
import { sourceLabel, STAGES, stageLabel, type LeadCard, type LeadDetail, type Stage } from "../types";
import { LeadDrawer } from "./LeadDrawer";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/*
  Leads board (AGENTS.md §13): New, Contacted, Quoted, Negotiation, Won, Lost. Drag a card on a computer; on a phone every card
  has a Stage dropdown. Lost asks for a reason. Won creates (or links) the buyer.
*/
export function LeadBoard({ leads }: { leads: LeadCard[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const openId = params.get("lead");
  // "Add a lead" lives in the page header (a link to ?add=1), so the header shows at once and the form opens from the address.
  const adding = params.get("add") === "1";
  const [phoneTab, setPhoneTab] = useState<Stage>("new");
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [lostFor, setLostFor] = useState<{ id: string; updatedAt: string } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", businessName: "", city: "", instagram: "", message: "", nextFollowUp: "" });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    const channel = supabase.channel("crm-leads").on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => router.refresh()).subscribe();
    return () => void supabase.removeChannel(channel);
  }, [router]);

  const byStage = useMemo(() => {
    const m = new Map<Stage, LeadCard[]>(STAGES.map((s) => [s, []]));
    for (const l of leads) m.get(l.stage)?.push(l);
    return m;
  }, [leads]);

  const changeParams = (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    change(next);
    router.replace(next.size ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
  };
  const openLead = (id: string | null) => changeParams((next) => (id ? next.set("lead", id) : next.delete("lead")));
  const closeAdd = () => changeParams((next) => next.delete("add"));

  async function move(id: string, updatedAt: string, stage: Stage, why?: string) {
    setBusy(true);
    const r = await moveLeadAction({ id, stage, reason: why, expected: updatedAt });
    setBusy(false);
    if (!r.ok) {
      toast.show({ kind: "error", title: r.error });
      router.refresh();
      return false;
    }
    toast.show({ kind: "success", title: stage === "won" ? "Won. They are now in your Buyers." : `Moved to ${stageLabel[stage]}.` });
    router.refresh();
    return true;
  }

  function requestMove(id: string, updatedAt: string, from: Stage, to: Stage) {
    if (from === to) return;
    if (to === "lost") {
      setReason("");
      setLostFor({ id, updatedAt });
      return;
    }
    void move(id, updatedAt, to);
  }

  async function confirmLost() {
    if (!lostFor) return;
    if (!reason.trim()) return;
    if (await move(lostFor.id, lostFor.updatedAt, "lost", reason.trim())) setLostFor(null);
  }

  async function createLead() {
    setBusy(true);
    setFormError(null);
    const r = await createLeadAction(form);
    setBusy(false);
    if (!r.ok) return setFormError(r.error);
    setForm({ name: "", phone: "", businessName: "", city: "", instagram: "", message: "", nextFollowUp: "" });
    toast.show({ kind: "success", title: r.existing ? "This buyer already has an open lead. Opened it." : "Lead added." });
    router.refresh();
    changeParams((next) => { next.delete("add"); next.set("lead", r.leadId); });
  }

  const card = (l: LeadCard, stage: Stage) => {
    const overdue = l.nextFollowUp !== null && l.nextFollowUp < today() && stage !== "won" && stage !== "lost";
    return (
      <li
        key={l.id}
        draggable
        onDragStart={(e) => { setDragging(l.id); e.dataTransfer.setData("text/plain", l.id); e.dataTransfer.effectAllowed = "move"; }}
        onDragEnd={() => { setDragging(null); setOver(null); }}
        className={cx("flex min-w-0 flex-col gap-3 rounded-lg border bg-surface p-4 shadow-1", overdue ? "border-danger" : "border-border", dragging === l.id && "opacity-50")}
      >
        <button type="button" onClick={() => openLead(l.id)} className="flex min-w-0 flex-col gap-1 rounded-sm text-left focus-ring">
          <span className="truncate type-body font-semibold">{l.name}</span>
          {[l.businessName, l.city].filter(Boolean).length > 0 ? <span className="truncate type-small text-fg-muted">{[l.businessName, l.city].filter(Boolean).join(" · ")}</span> : null}
          <span className="truncate type-small tabular text-fg-muted">{formatPhone(l.phone)}</span>
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{sourceLabel[l.source] ?? l.source}</Badge>
          {l.itemCount > 0 ? <span className="type-caption text-fg-muted">{l.itemCount} {l.itemCount === 1 ? "article" : "articles"}</span> : null}
          {overdue ? <Badge tone="danger">Follow-up overdue</Badge> : null}
        </div>
        {l.quotedAmount !== null || l.nextFollowUp ? (
          <dl className="flex flex-col gap-1 border-t border-border pt-3 type-small">
            {l.quotedAmount !== null ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-fg-muted">Quoted</dt>
                <dd className="tabular font-semibold">{formatRupees(l.quotedAmount)}</dd>
              </div>
            ) : null}
            {l.nextFollowUp ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-fg-muted">Follow up</dt>
                <dd className={cx("tabular font-semibold", overdue && "text-danger")}>{formatDay(l.nextFollowUp)}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        <div>
          <Select label={`Stage for ${l.name}`} hideLabel value={l.stage} options={STAGES.map((s) => ({ value: s, label: stageLabel[s] }))} onChange={(e) => requestMove(l.id, l.updatedAt, l.stage, e.target.value as Stage)} />
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        className="md:hidden"
        label="Stages"
        value={phoneTab}
        onChange={(id) => setPhoneTab(id as Stage)}
        items={STAGES.map((s) => ({ id: s, label: stageLabel[s], count: byStage.get(s)?.length ?? 0 }))}
      />

      <div
        role="region"
        aria-label="Lead board. Scroll sideways to see every stage."
        tabIndex={0}
        // "relative" keeps the hidden screen-reader labels inside the scrolling board instead of widening the page.
        className="relative flex flex-col gap-4 rounded-lg focus-ring md:flex-row md:items-stretch md:overflow-x-auto md:pb-4"
      >
        {STAGES.map((stage) => {
          const list = byStage.get(stage) ?? [];
          return (
            <section
              key={stage}
              aria-label={`${stageLabel[stage]} leads`}
              onDragOver={(e) => { e.preventDefault(); setOver(stage); }}
              onDragLeave={() => setOver((o) => (o === stage ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                const lead = leads.find((l) => l.id === id);
                setOver(null);
                if (lead) requestMove(lead.id, lead.updatedAt, lead.stage, stage);
              }}
              className={cx("min-w-0 flex-col gap-3 rounded-lg p-3 md:flex md:w-board md:shrink-0", phoneTab === stage ? "flex" : "hidden", over === stage ? "bg-surface-2 outline outline-2 outline-gold" : "md:bg-surface-2")}
            >
              <h2 className="hidden items-center justify-between gap-3 px-1 type-h4 md:flex">
                <span className="truncate">{stageLabel[stage]}</span>
                <span className="inline-flex h-chip min-w-chip shrink-0 items-center justify-center rounded-full bg-surface px-2 type-caption tabular text-fg-muted">{list.length}</span>
              </h2>
              <ul className="flex flex-col gap-3">{list.map((l) => card(l, stage))}</ul>
              {list.length === 0 ? <p className="rounded-md border border-dashed border-border-strong px-4 py-6 text-center type-small text-fg-muted">No leads here</p> : null}
            </section>
          );
        })}
      </div>

      <LeadDrawer
        leadId={openId}
        onClose={() => openLead(null)}
        onChanged={() => router.refresh()}
        onStageChange={(lead: LeadDetail, stage) => requestMove(lead.id, lead.updatedAt, lead.stage, stage)}
      />

      <Modal
        open={Boolean(lostFor)}
        onClose={() => setLostFor(null)}
        title="Why was this lead lost?"
        description="A short reason helps you see patterns later."
        footer={
          <>
            <Button variant="secondary" onClick={() => setLostFor(null)}>Cancel</Button>
            <Button variant="danger" loading={busy} disabled={!reason.trim()} onClick={() => void confirmLost()}>Mark as lost</Button>
          </>
        }
      >
        <Textarea label="Reason" rows={3} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
      </Modal>

      <Modal
        open={adding}
        onClose={closeAdd}
        title="Add a lead"
        description="For someone who contacted you by phone, in person or on Instagram."
        footer={
          <>
            <Button variant="secondary" onClick={closeAdd}>Cancel</Button>
            <Button loading={busy} onClick={() => void createLead()}>Add lead</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {formError ? <Banner tone="danger">{formError}</Banner> : null}
          <TextInput label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <TextInput label="Phone" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          <TextInput label="Business name (optional)" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="City (optional)" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <TextInput label="Instagram (optional)" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
          </div>
          <TextInput label="Follow up on (optional)" type="date" value={form.nextFollowUp} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })} />
          <Textarea label="What do they want? (optional)" rows={2} value={form.message} maxLength={500} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
