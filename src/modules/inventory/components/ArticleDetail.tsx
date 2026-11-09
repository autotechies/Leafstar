"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, Plus, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Banner } from "@/components/ui/Feedback";
import { Select, Switch, TextInput, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cx } from "@/lib/cx";
import { formatNumber } from "@/lib/numbers";
import { ImageViewer } from "@/modules/images/components/LazyImageViewer";
import { PhotoUploader, type UploadedPhoto } from "@/modules/images/components/PhotoUploader";
import { SmartImage } from "@/modules/images/components/SmartImage";
import type { Photo } from "@/modules/images/types";
import { COLOUR_PRESETS, DEFAULT_COLOUR_HEX, SIZE_OPTIONS } from "@/modules/stock/constants";
import {
  addColourAction, addSizeAction, adjustStockAction, checkArticleDeleteAction, deleteArticleAction, replacePhotosAction, setArticleStateAction, undoMovementAction, updateArticleAction,
  type DeleteReport,
} from "../actions";
import type { InvArticle, InvColour, InvVariant, Movement } from "../queries";
import { visibilityLabel, visibilityOf } from "../status";

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const istDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Groups newest-first movements under "Today", "Yesterday" or the date, in India time. */
function groupByDay(movements: Movement[]): Array<{ day: string; label: string; items: Movement[] }> {
  const now = Date.now();
  const today = istDay(new Date(now).toISOString());
  const yesterday = istDay(new Date(now - 86_400_000).toISOString());
  const groups: Array<{ day: string; label: string; items: Movement[] }> = [];
  for (const m of movements) {
    const day = istDay(m.at);
    let g = groups[groups.length - 1];
    if (!g || g.day !== day) {
      const label = day === today ? "Today" : day === yesterday ? "Yesterday" : new Date(m.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
      g = { day, label, items: [] };
      groups.push(g);
    }
    g.items.push(m);
  }
  return groups;
}
const reasonLabel: Record<string, string> = { production: "Production", adjustment: "Correction", opening: "Opening stock", return: "Return", sale: "Sold", undo: "Undo", bill: "Bill" };

export function ArticleDetail({ article, movements, brands }: { article: InvArticle; movements: Movement[]; brands: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const toast = useToast();
  const [viewer, setViewer] = useState<{ photos: Photo[]; index: number } | null>(null);
  const [adjust, setAdjust] = useState<{ colour: InvColour; variant: InvVariant } | null>(null);
  const [undoing, setUndoing] = useState<Movement | null>(null);
  const [editing, setEditing] = useState(false);
  const [addingColour, setAddingColour] = useState(false);
  const [photoColour, setPhotoColour] = useState<InvColour | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);

  const vis = visibilityOf(article);
  const sizes = [...new Map(article.colours.flatMap((c) => c.variants).map((v) => [v.size, v.sizeOrder] as const)).entries()].sort((a, b) => a[1] - b[1]).map(([s]) => s);
  const missingSizes = SIZE_OPTIONS.filter((s) => !sizes.includes(s));
  const allPhotos = article.colours.flatMap((c) => c.photos);

  async function change(kind: "publish" | "hide" | "archive" | "restore", done: string) {
    setBusy(true);
    setStateError(null);
    const result = await setArticleStateAction({ code: article.code, articleId: article.id, updatedAt: article.updatedAt, change: kind });
    setBusy(false);
    if (!result.ok) return setStateError(result.error);
    toast.show({ kind: "success", title: done });
    router.refresh();
  }

  async function addSize(size: string) {
    const result = await addSizeAction({ code: article.code, articleId: article.id, size });
    toast.show(result.ok ? { kind: "success", title: `Size ${size} added to every colour.` } : { kind: "error", title: result.error });
    if (result.ok) router.refresh();
  }

  async function undo(m: Movement) {
    const result = await undoMovementAction({ code: article.code, movementId: m.id });
    setUndoing(null);
    toast.show(result.ok ? { kind: "success", title: "Undone. The entry was reversed." } : { kind: "error", title: result.error });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/inventory" className="inline-flex items-center gap-2 type-small font-semibold text-fg-muted hover:text-fg focus-ring rounded-sm">
        <ArrowLeft aria-hidden="true" className="size-icon-sm" /> All articles
      </Link>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-4">
            {article.cover ? (
              <button type="button" onClick={() => setViewer({ photos: allPhotos, index: 0 })} aria-label="Open photos" className="block w-24 shrink-0 overflow-hidden rounded-md focus-ring">
                <SmartImage photo={article.cover} sizes="96px" priority />
              </button>
            ) : null}
            <div className="flex flex-col gap-1">
              <p className="type-caption text-gold-text">{article.code}</p>
              <h1 className="type-h2">{article.name}</h1>
              <p className="type-small text-fg-muted">
                {article.brandName} · {article.garment}
                {article.style ? ` · ${article.style}` : ""}
                {article.fabric ? ` · ${article.fabric}` : ""}
                {article.pattern ? ` · ${article.pattern}` : ""}
              </p>
              <p className="type-small text-fg-muted">
                Minimum {formatNumber(article.moq)} pieces · {article.lotSize ? `fixed lot of ${formatNumber(article.lotSize)}` : "any quantity at or above the minimum"}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge tone={vis === "live" ? "success" : "neutral"}>{visibilityLabel[vis]}</Badge>
                <Badge tone={article.totalPieces === 0 ? "danger" : "success"}>{formatNumber(article.totalPieces)} pieces</Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>Edit details</Button>
            {article.isActive ? (
              article.isPublic ? (
                <Button variant="secondary" loading={busy} icon={<EyeOff aria-hidden="true" className="size-icon-sm" />} onClick={() => void change("hide", "Hidden from the website.")}>Hide from website</Button>
              ) : (
                <Button loading={busy} icon={<Eye aria-hidden="true" className="size-icon-sm" />} onClick={() => void change("publish", "Published. Buyers see it once it has stock.")}>Publish</Button>
              )
            ) : null}
            {article.isActive ? (
              <Button variant="ghost" loading={busy} icon={<Archive aria-hidden="true" className="size-icon-sm" />} onClick={() => void change("archive", "Archived. It is hidden everywhere but its history is kept.")}>Archive</Button>
            ) : (
              <Button loading={busy} icon={<RotateCcw aria-hidden="true" className="size-icon-sm" />} onClick={() => void change("restore", "Restored. It stays hidden until you publish it.")}>Restore</Button>
            )}
            <Button variant="ghost" icon={<Trash2 aria-hidden="true" className="size-icon-sm" />} onClick={() => setDeleting(true)}>Delete</Button>
          </div>
        </div>
        {stateError ? <Banner tone="danger">{stateError}</Banner> : null}
        {article.description ? <p className="type-body text-fg-muted">{article.description}</p> : null}
      </Card>

      <Card>
        <CardHeader
          title="Stock by colour and size"
          description="Tap a number to correct it. Every change is recorded with your reason and can be undone."
          action={
            <Button variant="secondary" size="sm" icon={<Plus aria-hidden="true" className="size-icon-sm" />} onClick={() => setAddingColour(true)}>
              Add colour
            </Button>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="type-small text-fg-muted">
                <th scope="col" className="py-2 pr-3 text-left font-semibold">Colour</th>
                {sizes.map((s) => (
                  <th key={s} scope="col" className="px-1 py-2 text-center font-semibold">{s}</th>
                ))}
                <th scope="col" className="py-2 pl-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {article.colours.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <th scope="row" className="py-2 pr-3 text-left">
                    <span className="flex items-center gap-2 type-small font-semibold">
                      <span
                        aria-hidden="true"
                        className="size-swatch-sm shrink-0 rounded-full border border-border-strong"
                        // Product colour is data, not a design token.
                        style={{ backgroundColor: c.hex }}
                      />
                      {c.name}
                    </span>
                  </th>
                  {sizes.map((s) => {
                    const v = c.variants.find((x) => x.size === s);
                    return (
                      <td key={s} className="px-1 py-1 text-center">
                        {v ? (
                          <button
                            type="button"
                            onClick={() => setAdjust({ colour: c, variant: v })}
                            aria-label={`${c.name} ${s}: ${v.stock} pieces. Correct this number`}
                            className={cx(
                              "inline-flex h-control min-w-control items-center justify-center rounded-md border px-2 tabular type-small font-semibold focus-ring hover:bg-surface-2",
                              v.stock === 0 ? "border-danger text-danger" : v.stock <= v.lowThreshold ? "border-warning text-warning" : "border-border text-fg",
                            )}
                          >
                            {formatNumber(v.stock)}
                          </button>
                        ) : (
                          <span className="text-fg-muted">–</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2 pl-3 text-right tabular type-small font-semibold">{formatNumber(c.variants.reduce((s, v) => s + v.stock, 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {missingSizes.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 pt-4">
            <span className="type-small text-fg-muted">Add a size:</span>
            {missingSizes.map((s) => (
              <Button key={s} size="sm" variant="secondary" onClick={() => void addSize(s)}>{s}</Button>
            ))}
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader title="Photos" description="Tap a photo to view it large. The first photo of each colour is the one buyers see first." />
        <div className="flex flex-col gap-4">
          {article.colours.map((c) => (
            <div key={c.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="type-h4">{c.name}</h3>
                <Button size="sm" variant="secondary" onClick={() => setPhotoColour(c)}>Replace photos</Button>
              </div>
              {c.photos.length === 0 ? (
                <p className="type-small text-danger">No photo yet. This colour keeps the article hidden from the website.</p>
              ) : (
                <div className="grid grid-cols-4 gap-3 md:grid-cols-6 lg:grid-cols-8">
                  {c.photos.map((p, i) => (
                    <button key={p.id} type="button" onClick={() => setViewer({ photos: c.photos, index: i })} aria-label={`Open ${p.alt}`} className="block overflow-hidden rounded-md focus-ring">
                      <SmartImage photo={p} sizes="(min-width: 1024px) 10vw, 25vw" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="History" description="Every change to this article's stock, newest first." />
        {movements.length === 0 ? (
          <p className="type-small text-fg-muted">No stock changes yet.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {groupByDay(movements).map((g) => (
              <section key={g.day} aria-label={g.label} className="flex flex-col gap-3">
                <h3 className="type-small font-semibold text-fg-muted">{g.label}</h3>
                <ol className="flex flex-col">
                  {g.items.map((m, i) => {
                    const up = m.qty > 0;
                    return (
                      <li key={m.id} className={cx("relative flex gap-4", i < g.items.length - 1 && "pb-4")}>
                        {i < g.items.length - 1 ? <span aria-hidden="true" className="absolute bottom-0 left-3 top-6 border-l border-border" /> : null}
                        <span aria-hidden="true" className={cx("relative inline-flex size-icon-lg shrink-0 items-center justify-center rounded-full", m.undone ? "bg-surface-2 text-fg-muted" : up ? "bg-success-bg text-success" : "bg-danger-bg text-danger")}>
                          {up ? <ArrowUp className="size-icon-sm" /> : <ArrowDown className="size-icon-sm" />}
                        </span>
                        <div className={cx("flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-1", m.undone && "text-fg-muted")}>
                          <div className="flex min-w-0 flex-col gap-1">
                            <p className="type-small">
                              <span className={cx("tabular font-bold", m.undone ? "line-through" : up ? "text-success" : "text-danger")}>{up ? `+${formatNumber(m.qty)}` : formatNumber(m.qty)}</span>
                              <span className="ml-2 font-semibold">{m.sku}</span>
                            </p>
                            <p className="type-small text-fg-muted">
                              {reasonLabel[m.reason] ?? m.reason}
                              {m.note ? ` · ${m.note}` : ""}
                              {m.batchCode ? ` · ${m.batchCode}` : ""}
                              {m.billId ? " · from a bill" : ""}
                              {m.undone ? " · undone" : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <time dateTime={m.at} className="type-caption text-fg-muted">{fmtTime(m.at)}</time>
                            {m.undoable ? <Button size="sm" variant="ghost" icon={<Undo2 aria-hidden="true" className="size-icon-sm" />} onClick={() => setUndoing(m)}>Undo</Button> : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
      </Card>

      {adjust ? (
        <AdjustDialog
          code={article.code}
          colour={adjust.colour}
          variant={adjust.variant}
          onClose={() => setAdjust(null)}
          onSaved={(r) => {
            setAdjust(null);
            toast.undo({
              title: `${adjust.variant.sku} is now ${formatNumber(r.now)}`,
              description: `${r.delta > 0 ? "+" : ""}${formatNumber(r.delta)} recorded. Undo within 15 seconds if this was a mistake.`,
              onUndo: async () => {
                const undone = await undoMovementAction({ code: article.code, movementId: r.movementId });
                toast.show(undone.ok ? { kind: "success", title: "Undone." } : { kind: "error", title: undone.error });
                router.refresh();
              },
            });
            router.refresh();
          }}
        />
      ) : null}

      <Modal
        open={Boolean(undoing)}
        onClose={() => setUndoing(null)}
        title="Undo this entry?"
        description={undoing ? `${undoing.sku}: ${undoing.qty > 0 ? "+" : ""}${undoing.qty} pieces will be reversed. An entry can be undone once.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setUndoing(null)}>Keep it</Button>
            <Button variant="danger" onClick={() => undoing && void undo(undoing)}>Undo entry</Button>
          </>
        }
      >
        <p className="type-body text-fg-muted">If this would take stock below zero it will be refused and nothing changes.</p>
      </Modal>

      {deleting ? (
        <DeleteDialog
          article={article}
          onClose={() => setDeleting(false)}
          onArchive={() => { setDeleting(false); void change("archive", "Archived. It is hidden everywhere but its history is kept."); }}
          onDeleted={(code) => {
            toast.show({ kind: "success", title: `${code} was deleted.` });
            router.push("/admin/inventory");
            router.refresh();
          }}
        />
      ) : null}
      {editing ? <EditDialog article={article} brands={brands} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); toast.show({ kind: "success", title: "Details saved." }); router.refresh(); }} /> : null}
      {addingColour ? <AddColourDialog article={article} sizes={sizes} onClose={() => setAddingColour(false)} onSaved={() => { setAddingColour(false); toast.show({ kind: "success", title: "Colour added." }); router.refresh(); }} /> : null}
      {photoColour ? <ReplacePhotosDialog article={article} colour={photoColour} onClose={() => setPhotoColour(null)} onSaved={() => { setPhotoColour(null); toast.show({ kind: "success", title: "Photos replaced." }); router.refresh(); }} /> : null}
      {viewer ? <ImageViewer photos={viewer.photos} open index={viewer.index} onIndexChange={(index) => setViewer((v) => (v ? { ...v, index } : v))} onClose={() => setViewer(null)} /> : null}
    </div>
  );
}

function AdjustDialog({ code, colour, variant, onClose, onSaved }: { code: string; colour: InvColour; variant: InvVariant; onClose: () => void; onSaved: (r: { movementId: string; delta: number; now: number }) => void }) {
  const [mode, setMode] = useState<"change" | "count">("change");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const n = Number(value);
  const preview = value.trim() === "" || !Number.isInteger(n) ? null : mode === "count" ? n : variant.stock + n;

  async function save() {
    setError(null);
    if (value.trim() === "" || !Number.isInteger(n)) return setError("Enter a whole number.");
    setSaving(true);
    const result = await adjustStockAction({ code, variantId: variant.id, mode, value: n, note });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    onSaved(result);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${colour.name} · ${variant.size}`}
      description={`${variant.sku}. Now ${formatNumber(variant.stock)} pieces.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={() => void save()}>Save correction</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div role="group" aria-label="Type of correction" className="grid grid-cols-2 gap-2">
          {(["change", "count"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setValue(""); }} className={cx("h-control rounded-md border-2 type-small font-bold focus-ring", mode === m ? "border-gold bg-surface-2" : "border-border text-fg-muted")}>
              {m === "change" ? "Add or remove" : "Set the count"}
            </button>
          ))}
        </div>
        <TextInput
          label={mode === "change" ? "Pieces to add (negative to remove)" : "Counted pieces"}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          helper={preview !== null ? `Stock will be ${formatNumber(preview)}` : mode === "change" ? "For example 10, or -3" : "What you counted on the shelf"}
          error={preview !== null && preview < 0 ? "That would take stock below zero" : undefined}
        />
        <TextInput label="Reason" required value={note} onChange={(e) => setNote(e.target.value)} placeholder="Recount, damaged, returned…" helper="Required. Shown in the history." />
        {error ? <Banner tone="danger">{error}</Banner> : null}
      </div>
    </Modal>
  );
}

type DeleteCheck = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; report: DeleteReport };

/** Delete is allowed only when nothing real depends on the article. The owner sees exactly what goes, then types the code. */
function DeleteDialog({ article, onClose, onArchive, onDeleted }: { article: InvArticle; onClose: () => void; onArchive: () => void; onDeleted: (code: string) => void }) {
  const [check, setCheck] = useState<DeleteCheck>({ status: "loading" });
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void checkArticleDeleteAction({ code: article.code, articleId: article.id }).then((r) => {
      if (!cancelled) setCheck(r.ok ? { status: "ready", report: r.report } : { status: "error", message: r.error });
    });
    return () => { cancelled = true; };
  }, [article.code, article.id]);

  const report = check.status === "ready" ? check.report : null;
  const blocked = report !== null && !report.canDelete;
  const matches = report !== null && confirm.trim().toUpperCase() === report.code.toUpperCase();

  async function remove() {
    setError(null);
    setWorking(true);
    const result = await deleteArticleAction({ code: article.code, articleId: article.id, updatedAt: article.updatedAt, confirm });
    setWorking(false);
    if (!result.ok) return setError(result.error);
    onDeleted(result.code);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={blocked ? "This article can't be deleted" : "Delete this article?"}
      description={`${article.code} · ${article.name}`}
      footer={
        blocked ? (
          <>
            <Button variant="secondary" onClick={onClose}>Close</Button>
            {article.isActive ? <Button icon={<Archive aria-hidden="true" className="size-icon-sm" />} onClick={onArchive}>Archive instead</Button> : null}
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="danger" loading={working} disabled={!matches} icon={<Trash2 aria-hidden="true" className="size-icon-sm" />} onClick={() => void remove()}>Delete article</Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {check.status === "loading" ? <p className="type-small text-fg-muted">Checking what depends on this article…</p> : null}
        {check.status === "error" ? <Banner tone="danger">{check.message}</Banner> : null}
        {report && blocked ? (
          <>
            <p className="type-body">It has history that must be kept, so it can only be archived:</p>
            <ul className="flex flex-col gap-2 type-small font-semibold">
              {report.blockers.map((b) => (
                <li key={b}>{b}.</li>
              ))}
            </ul>
            <p className="type-small text-fg-muted">Archiving hides it from the website and your lists. Nothing is lost.</p>
          </>
        ) : null}
        {report && !blocked ? (
          <>
            <p className="type-body">This removes the article for good. No bill or buyer lead refers to it.</p>
            <ul className="flex flex-col gap-2 type-small">
              <li>{formatNumber(report.colours)} {report.colours === 1 ? "colour" : "colours"} and all their sizes</li>
              <li>{formatNumber(report.photos)} {report.photos === 1 ? "photo" : "photos"}</li>
              <li>{formatNumber(report.entries)} stock {report.entries === 1 ? "entry" : "entries"} in its history ({formatNumber(report.pieces)} pieces in stock now)</li>
            </ul>
            <p className="type-small text-fg-muted">What was removed is kept in the audit log. This cannot be undone.</p>
            <TextInput label={`Type ${report.code} to confirm`} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" autoCapitalize="characters" />
          </>
        ) : null}
        {error ? <Banner tone="danger">{error}</Banner> : null}
      </div>
    </Modal>
  );
}

function EditDialog({ article, brands, onClose, onSaved }: { article: InvArticle; brands: Array<{ id: string; name: string }>; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: article.name, brandId: article.brandId, style: article.style ?? "", fabric: article.fabric ?? "", pattern: article.pattern ?? "",
    description: article.description ?? "", moq: String(article.moq), lotSize: article.lotSize ? String(article.lotSize) : "", isFeatured: article.isFeatured,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (c: Partial<typeof f>) => setF((cur) => ({ ...cur, ...c }));

  async function save() {
    setError(null);
    setSaving(true);
    const result = await updateArticleAction({
      code: article.code, articleId: article.id, updatedAt: article.updatedAt, name: f.name, brandId: f.brandId, style: f.style, fabric: f.fabric, pattern: f.pattern,
      description: f.description, moq: Number(f.moq), lotSize: f.lotSize.trim() === "" ? null : Number(f.lotSize), isFeatured: f.isFeatured,
    });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    onSaved();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit details"
      description={`${article.code}. The code and sizes cannot be changed.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={() => void save()}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextInput label="Name" value={f.name} onChange={(e) => set({ name: e.target.value })} />
        <Select label="Brand" value={f.brandId} options={brands.map((b) => ({ value: b.id, label: b.name }))} onChange={(e) => set({ brandId: e.target.value })} />
        <div className="grid grid-cols-3 gap-3">
          <TextInput label="Style" value={f.style} onChange={(e) => set({ style: e.target.value })} />
          <TextInput label="Fabric" value={f.fabric} onChange={(e) => set({ fabric: e.target.value })} />
          <TextInput label="Pattern" value={f.pattern} onChange={(e) => set({ pattern: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Minimum order" inputMode="numeric" value={f.moq} onChange={(e) => set({ moq: e.target.value })} />
          <TextInput label="Fixed lot size" inputMode="numeric" value={f.lotSize} onChange={(e) => set({ lotSize: e.target.value })} helper="Empty = any quantity" />
        </div>
        <Textarea label="Description" rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} />
        <Switch label="Feature on the home page" checked={f.isFeatured} onChange={(v) => set({ isFeatured: v })} />
        {error ? <Banner tone="danger">{error}</Banner> : null}
      </div>
    </Modal>
  );
}

function AddColourDialog({ article, sizes, onClose, onSaved }: { article: InvArticle; sizes: string[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [hex, setHex] = useState(DEFAULT_COLOUR_HEX);
  const [stock, setStock] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const usable = COLOUR_PRESETS.filter((p) => !article.colours.some((c) => c.code === p.code));

  async function save() {
    setError(null);
    setSaving(true);
    const result = await addColourAction({
      code: article.code, articleId: article.id,
      colour: {
        name, code, hex,
        photos: photos.filter((p) => p.status === "done" && p.image).map((p) => ({ ...p.image! })),
        stock: Object.fromEntries(sizes.map((s) => [s, stock[s]?.trim() ? Number(stock[s]) : 0])),
      },
    });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    onSaved();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add a colour"
      description={`${article.code}. It gets every size this article has.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={photos.some((p) => p.status === "uploading")} onClick={() => void save()}>Add colour</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {usable.slice(0, 10).map((p) => (
            <button key={p.code} type="button" onClick={() => { setName(p.name); setCode(p.code); setHex(p.hex); }} className="inline-flex h-control-sm items-center gap-2 rounded-full border border-border px-3 type-small hover:bg-surface-2 focus-ring">
              <span
                aria-hidden="true"
                className="size-swatch-sm rounded-full border border-border-strong"
                // Product colour is data, not a design token.
                style={{ backgroundColor: p.hex }}
              />
              {p.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Colour name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextInput label="3-letter code" value={code} maxLength={3} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="add-colour-hex" className="type-small font-semibold">Shade</label>
          <input id="add-colour-hex" type="color" value={hex} onChange={(e) => setHex(e.target.value.toUpperCase())} className="h-control w-control cursor-pointer rounded-md border border-border-strong bg-surface p-1 focus-ring" />
        </div>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
          {sizes.map((s) => (
            <TextInput key={s} label={`${s} pieces`} inputMode="numeric" value={stock[s] ?? ""} placeholder="0" onChange={(e) => setStock((cur) => ({ ...cur, [s]: e.target.value }))} />
          ))}
        </div>
        <PhotoUploader label={`${article.name} in ${name || "new colour"}`} value={photos} onChange={setPhotos} />
        {error ? <Banner tone="danger">{error}</Banner> : null}
      </div>
    </Modal>
  );
}

function ReplacePhotosDialog({ article, colour, onClose, onSaved }: { article: InvArticle; colour: InvColour; onClose: () => void; onSaved: () => void }) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    setSaving(true);
    const result = await replacePhotosAction({ code: article.code, colourId: colour.id, photos: photos.filter((p) => p.status === "done" && p.image).map((p) => ({ ...p.image! })) });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    onSaved();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Replace photos: ${colour.name}`}
      description="The new photos replace all current photos of this colour."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={photos.length === 0 || photos.some((p) => p.status !== "done")} onClick={() => void save()}>Replace photos</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <PhotoUploader label={`${article.name} in ${colour.name}`} value={photos} onChange={setPhotos} />
        {error ? <Banner tone="danger">{error}</Banner> : null}
      </div>
    </Modal>
  );
}
