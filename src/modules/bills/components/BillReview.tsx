"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Banner } from "@/components/ui/Feedback";
import { Select, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cx } from "@/lib/cx";
import { formatNumber } from "@/lib/numbers";
import { ImageViewer } from "@/modules/images/components/LazyImageViewer";
import { discardScanJobAction, saveBillAction, undoBillAction } from "../actions";
import { CONFIDENT, type BillDraft, type DraftItem, type VariantOption } from "../types";

/*
  Review (AGENTS.md §10): the original bill beside its lines. Unmatched and unsure lines are marked and must be settled
  before stock is deducted. Applying is one step, followed by a 15-second Undo.
*/

const methodLabel: Record<string, string> = { sku: "Code on the bill", alias: "Learned from you", fuzzy: "Name match", manual: "Chosen by you" };

function Original({ bill }: { bill: BillDraft }) {
  const [open, setOpen] = useState(false);
  const isImage = bill.mime?.startsWith("image/") && !bill.mime.includes("heic");
  const isPdf = bill.mime === "application/pdf";
  const photo = bill.fileUrl ? { id: bill.fileUrl, thumbUrl: bill.fileUrl, mediumUrl: bill.fileUrl, url: bill.fileUrl, width: 1000, height: 1400, alt: "The scanned bill" } : null;
  return (
    <Card className="flex flex-col gap-3 lg:sticky lg:top-6">
      <CardHeader title="Original bill" description={bill.fileName ?? undefined} />
      {!bill.fileUrl ? (
        <p className="type-small text-fg-muted">The original file is not available.</p>
      ) : isImage && photo ? (
        <>
          <button type="button" onClick={() => setOpen(true)} aria-label="Open the bill large" className="block overflow-hidden rounded-md border border-border focus-ring">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bill.fileUrl} alt="The scanned bill" className="w-full" />
          </button>
          {open ? <ImageViewer photos={[photo]} open index={0} onIndexChange={() => undefined} onClose={() => setOpen(false)} /> : null}
        </>
      ) : isPdf ? (
        <iframe title="The scanned bill" src={bill.fileUrl} className="aspect-4/5 w-full rounded-md border border-border" />
      ) : bill.rawText ? (
        <pre className="max-h-sheet overflow-auto whitespace-pre-wrap rounded-md bg-surface-2 p-3 type-small">{bill.rawText}</pre>
      ) : null}
      {bill.fileUrl ? (
        <a href={bill.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-control items-center gap-2 rounded-sm type-small font-bold text-gold-text underline focus-ring">
          Open the file <ExternalLink aria-hidden="true" className="size-icon-sm" />
        </a>
      ) : null}
    </Card>
  );
}

export function BillReview({ bill, options, nextDraftId }: { bill: BillDraft; options: VariantOption[]; nextDraftId: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const readOnly = bill.status !== "draft";
  const [number, setNumber] = useState(bill.billNumber);
  const [date, setDate] = useState(bill.billDate);
  const [buyer, setBuyer] = useState(bill.buyerName);
  const [items, setItems] = useState<DraftItem[]>(bill.items);
  const [busy, setBusy] = useState<null | "save" | "apply">(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const demand = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) if (i.variantId) m.set(i.variantId, (m.get(i.variantId) ?? 0) + i.qty);
    return m;
  }, [items]);

  const unmatched = items.filter((i) => !i.variantId).length;
  const over = [...demand].filter(([id, qty]) => (byId.get(id)?.stock ?? 0) - qty < 0).length;
  const set = (key: string, change: Partial<DraftItem>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...change } : i)));
  const pieces = items.reduce((s, i) => s + (Number.isFinite(i.qty) ? i.qty : 0), 0);

  const payload = (apply: boolean) => ({
    billId: bill.id, billNumber: number, billDate: date, buyerName: buyer, apply,
    items: items.map((i) => ({ variantId: i.variantId, rawText: i.rawText, name: i.name, colour: i.colour, size: i.size, qty: i.qty, rate: i.rate, amount: i.amount, method: i.method, confidence: i.confidence, learn: i.learn })),
  });

  async function save(apply: boolean) {
    setError(null);
    setBusy(apply ? "apply" : "save");
    const result = await saveBillAction(payload(apply));
    setBusy(null);
    if (!result.ok) return setError(result.error);
    if (!apply) {
      toast.show({ kind: "success", title: "Draft saved." });
      return router.refresh();
    }
    toast.undo({
      title: `Bill ${number || ""} applied`.replace("  ", " "),
      description: `${formatNumber(pieces)} pieces deducted. Undo within 15 seconds if this was a mistake.`,
      onUndo: async () => {
        const undone = await undoBillAction(bill.id);
        toast.show(undone.ok ? { kind: "success", title: "Undone. Stock was put back." } : { kind: "error", title: undone.error });
        router.refresh();
      },
    });
    router.push(nextDraftId ? `/admin/bills/review/${nextDraftId}` : "/admin/bills/scan");
  }

  async function discard() {
    setConfirmDiscard(false);
    const { loadQueueAction } = await import("../actions");
    const job = (await loadQueueAction()).find((j) => j.billId === bill.id);
    if (!job) return setError("This bill is not in the queue any more. Reload the page.");
    const r = await discardScanJobAction(job.id);
    if (!r.ok) return setError(r.error);
    router.push("/admin/bills/scan");
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/bills/scan" className="inline-flex items-center gap-2 type-small font-semibold text-fg-muted hover:text-fg focus-ring rounded-sm">
        <ArrowLeft aria-hidden="true" className="size-icon-sm" /> Back to the queue
      </Link>
      {readOnly ? <Banner tone="info">This bill is {bill.status === "applied" ? "applied" : "undone"}. It can no longer be edited here. Use Bills to undo an applied bill.</Banner> : null}
      {bill.duplicate && !readOnly ? <Banner tone="warning">{bill.duplicate} Check that this is not the same bill twice.</Banner> : null}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Original bill={bill} />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-7">
          <Card>
            <CardHeader title="Bill details" />
            <div className="grid gap-4 md:grid-cols-3">
              <TextInput label="Bill number" value={number} disabled={readOnly} onChange={(e) => setNumber(e.target.value)} />
              <TextInput label="Bill date" type="date" value={date} disabled={readOnly} onChange={(e) => setDate(e.target.value)} />
              <TextInput label="Buyer" value={buyer} disabled={readOnly} onChange={(e) => setBuyer(e.target.value)} />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Lines"
              description={`${items.length} line${items.length === 1 ? "" : "s"}, ${formatNumber(pieces)} pieces`}
              action={
                readOnly ? null : (
                  <Button size="sm" variant="secondary" icon={<Plus aria-hidden="true" className="size-icon-sm" />} onClick={() => setItems((cur) => [...cur, { key: crypto.randomUUID(), variantId: null, rawText: "", name: "", colour: "", size: "", qty: 1, rate: null, amount: null, method: null, confidence: null, learn: false }])}>
                    Add line
                  </Button>
                )
              }
            />
            {items.length === 0 ? <p className="type-small text-fg-muted">No lines were read. Add them by hand.</p> : null}
            <ul className="flex flex-col gap-4">
              {items.map((i) => {
                const opt = i.variantId ? byId.get(i.variantId) : undefined;
                const total = i.variantId ? demand.get(i.variantId) ?? 0 : 0;
                const after = opt ? opt.stock - total : 0;
                const sure = i.variantId && (i.confidence ?? 0) >= CONFIDENT;
                // A line that names one of our articles but no single colour and size (for example "Sizes S-XXL, assorted colours").
                const nameCode = `${i.rawText} ${i.name}`.toUpperCase().match(/LS-[A-Z]{2}-\d{4}/)?.[0] ?? null;
                const articleOptions = nameCode ? options.filter((o) => o.articleCode.toUpperCase() === nameCode) : [];
                const splitLine = !readOnly && !i.size && articleOptions.length > 0 && (!i.variantId || articleOptions.some((o) => o.id === i.variantId));
                const choices = splitLine ? articleOptions : options;
                return (
                  <li key={i.key} className={cx("flex flex-col gap-3 rounded-lg border p-3", !i.variantId ? "border-danger" : sure ? "border-border" : "border-warning")}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 type-small text-fg-muted">{i.rawText || "Added by hand"}</p>
                      {!i.variantId ? <Badge tone="danger">Not matched</Badge> : sure ? <Badge tone="success">{methodLabel[i.method ?? ""] ?? "Matched"}</Badge> : <Badge tone="warning">Please check</Badge>}
                    </div>
                    <div className="grid gap-3 md:grid-cols-12">
                      <div className="md:col-span-9">
                        <Select
                          label="Article"
                          placeholder="Choose an article, colour and size"
                          disabled={readOnly}
                          value={i.variantId ?? ""}
                          options={choices.map((o) => ({ value: o.id, label: o.label }))}
                          onChange={(e) => set(i.key, { variantId: e.target.value || null, method: e.target.value ? "manual" : null, confidence: e.target.value ? 1 : null, learn: !splitLine && Boolean(e.target.value) && Boolean(i.name || i.rawText) })}
                        />
                      </div>
                      <div className="md:col-span-3">
                        <TextInput label="Pieces" inputMode="numeric" disabled={readOnly} value={String(i.qty)} onChange={(e) => set(i.key, { qty: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                      </div>
                    </div>
                    {splitLine ? (
                      <div className="flex flex-col gap-2 rounded-md bg-surface-2 p-3">
                        <p className="type-small">
                          This line is for article <strong>{nameCode}</strong> but does not name one colour and size, so the bill cannot say which pieces to deduct. Choose a colour and size for part of the pieces, then use <strong>Split</strong> for the rest. The list below shows only this article.
                        </p>
                        <div>
                          <Button size="sm" variant="secondary" icon={<Plus aria-hidden="true" className="size-icon-sm" />} onClick={() => setItems((cur) => { const at = cur.findIndex((x) => x.key === i.key); const copy: DraftItem = { ...i, key: crypto.randomUUID(), variantId: null, qty: 0, method: null, confidence: null, learn: false }; return [...cur.slice(0, at + 1), copy, ...cur.slice(at + 1)]; })}>
                            Split: add another line for this article
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {opt ? (
                        <p className={cx("type-small tabular", after < 0 ? "font-semibold text-danger" : "text-fg-muted")}>
                          Stock {formatNumber(opt.stock)} → {formatNumber(after)}{after < 0 ? ". This is more than we have." : ""}
                        </p>
                      ) : (
                        <span />
                      )}
                      {readOnly ? null : (
                        <Button size="sm" variant="ghost" icon={<Trash2 aria-hidden="true" className="size-icon-sm" />} onClick={() => setItems((cur) => cur.filter((x) => x.key !== i.key))}>Remove</Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {error ? <Banner tone="danger">{error}</Banner> : null}
          {readOnly ? null : (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <Button variant="ghost" onClick={() => setConfirmDiscard(true)}>Discard this bill</Button>
              <div className="flex flex-col gap-3 md:flex-row">
                <Button variant="secondary" loading={busy === "save"} onClick={() => void save(false)}>Save draft</Button>
                <Button loading={busy === "apply"} disabled={items.length === 0 || unmatched > 0 || items.some((i) => i.qty < 1) || over > 0} onClick={() => void save(true)}>Deduct stock</Button>
              </div>
            </div>
          )}
          {!readOnly && (unmatched > 0 || over > 0) ? (
            <p className="type-small text-fg-muted">
              {unmatched > 0 ? `${unmatched} line${unmatched === 1 ? " is" : "s are"} not matched yet. ` : ""}
              {over > 0 ? "Some lines are more than the stock we have. Fix the quantity or the article." : ""}
            </p>
          ) : null}
        </div>
      </div>

      <Modal
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard this bill?"
        description="The draft and its uploaded file are removed. No stock changes."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDiscard(false)}>Keep it</Button>
            <Button variant="danger" onClick={() => void discard()}>Discard bill</Button>
          </>
        }
      >
        <p className="type-body text-fg-muted">You can always upload the bill again.</p>
      </Modal>
    </div>
  );
}
