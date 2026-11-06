"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Banner } from "@/components/ui/Feedback";
import { Select, Switch, TextInput, Textarea } from "@/components/ui/Field";
import { SizeChip, SwatchRow } from "@/components/ui/Product";
import { useToast } from "@/components/ui/Toast";
import { cx } from "@/lib/cx";
import { formatNumber } from "@/lib/numbers";
import { PhotoUploader, toPhoto } from "@/modules/images/components/PhotoUploader";
import { SmartImage } from "@/modules/images/components/SmartImage";
import { createArticleAction, nextArticleCodeAction, undoStockEntryAction } from "../actions";
import { COLOUR_PRESETS, DEFAULT_COLOUR_HEX, FABRICS, GARMENTS, PANT_STYLES, PATTERNS, SHIRT_STYLES, SIZE_OPTIONS, type SizeName, garmentInfo } from "../constants";
import {
  STEPS, clearDraft, emptyDraft, isDirty, loadDraft, saveDraft, stepProblems, toInput, totalPieces, wholeDraftProblems,
  type ColourDraft, type Draft,
} from "../draft";
import type { AddStockData } from "../queries";

/*
  New article: five steps, a live preview, and a draft that is saved in this browser as you type
  (it comes back if you close the tab). Saving is one database call, so a failure leaves nothing behind.
  After saving, a 15-second Undo reverses the whole entry.
*/

const today = () => new Date().toISOString().slice(0, 10);

export default function NewArticleForm({ brands }: { brands: AddStockData["brands"] }) {
  const router = useRouter();
  const toast = useToast();
  // Safe to read the browser here: this component is only ever rendered in the browser (see NewArticleFormLoader).
  const [restored] = useState(() => loadDraft());
  const [draft, setDraft] = useState<Draft>(() => restored ?? emptyDraft(today()));
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showRestored, setShowRestored] = useState(Boolean(restored));
  const [preview, setPreview] = useState(0);

  const patch = (change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change }));
  const dirty = isDirty(draft, today());

  // Save the draft shortly after each change; warn before leaving with unsaved work.
  useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => saveDraft(draft), 400);
    return () => window.clearTimeout(t);
  }, [draft, dirty]);
  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  const err = (key: string) => problems[key];
  const info = garmentInfo(draft.garment);

  async function autoCode() {
    const result = await nextArticleCodeAction(draft.garment);
    if (result.ok) {
      patch({ code: result.code });
      setProblems((p) => ({ ...p, "article.code": "" }));
    } else setProblems((p) => ({ ...p, "article.code": result.error }));
  }

  function goTo(step: number) {
    setProblems({});
    patch({ step });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function next() {
    const found = stepProblems(draft, draft.step);
    setProblems(found);
    if (Object.keys(found).length === 0) goTo(Math.min(draft.step + 1, STEPS.length - 1));
  }

  function addColour(base?: { name: string; code: string; hex: string }) {
    const colour: ColourDraft = { key: crypto.randomUUID(), name: base?.name ?? "", code: base?.code ?? "", hex: base?.hex ?? DEFAULT_COLOUR_HEX, photos: [], stock: {} };
    patch({ colours: [...draft.colours, colour] });
  }
  const updateColour = (key: string, change: Partial<ColourDraft> | ((c: ColourDraft) => Partial<ColourDraft>)) =>
    setDraft((d) => ({ ...d, colours: d.colours.map((c) => (c.key === key ? { ...c, ...(typeof change === "function" ? change(c) : change) } : c)) }));

  async function save() {
    const found = wholeDraftProblems(draft);
    setProblems(found);
    if (Object.keys(found).length > 0) {
      setSaveError(`Check the form: ${Object.values(found)[0]}`);
      return;
    }
    setSaving(true);
    setSaveError(null);
    const result = await createArticleAction(toInput(draft));
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error);
      if (result.fieldErrors) setProblems(result.fieldErrors);
      return;
    }
    clearDraft();
    toast.undo({
      title: `${draft.code.toUpperCase()} saved`,
      description: `${formatNumber(result.pieces)} pieces added. Undo within 15 seconds if this was a mistake.`,
      onUndo: async () => {
        const undone = await undoStockEntryAction({ batchId: result.batchId, archiveArticleId: result.articleId });
        toast.show(undone.ok ? { kind: "success", title: "Undone. The article was archived and its stock removed." } : { kind: "error", title: undone.error });
        router.refresh();
      },
    });
    setDraft(emptyDraft(today()));
    setShowRestored(false);
    router.refresh();
  }

  const livePhotos = useMemo(
    () => draft.colours.map((c) => (c.photos[0] ? toPhoto(c.photos[0], `${draft.name || "Article"} in ${c.name || "colour"}`, 0) : null)),
    [draft.colours, draft.name],
  );
  const previewIndex = Math.min(preview, Math.max(0, draft.colours.length - 1));
  const previewPhoto = livePhotos[previewIndex];
  const styles = draft.garment === "Pant" ? PANT_STYLES : SHIRT_STYLES;
  const allHavePhotos = draft.colours.length > 0 && draft.colours.every((c) => c.photos.some((p) => p.status === "done"));

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        {showRestored ? (
          <Banner
            tone="info"
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  clearDraft();
                  setDraft(emptyDraft(today()));
                  setShowRestored(false);
                }}
              >
                Discard draft
              </Button>
            }
          >
            Your unfinished article was restored.
          </Banner>
        ) : null}

        <ol className="flex flex-wrap gap-2" aria-label="Steps">
          {STEPS.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                disabled={i > draft.step}
                onClick={() => goTo(i)}
                aria-current={i === draft.step ? "step" : undefined}
                className={cx(
                  "inline-flex h-control items-center gap-2 rounded-full border px-4 type-small font-semibold focus-ring disabled:opacity-50",
                  i === draft.step ? "border-gold bg-surface-2 text-fg" : "border-border text-fg-muted",
                )}
              >
                <span className="tabular">{i < draft.step ? <Check aria-hidden="true" className="size-icon-sm" /> : i + 1}</span>
                {label}
              </button>
            </li>
          ))}
        </ol>

        <Card>
          {draft.step === 0 ? (
            <div className="flex flex-col gap-4">
              <h2 className="type-h3">Article</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  label="Type"
                  required
                  value={draft.garment}
                  placeholder="Choose…"
                  options={GARMENTS.map((g) => ({ value: g.value, label: g.label }))}
                  error={err("article.garment")}
                  onChange={(e) => patch({ garment: e.target.value, style: "", code: draft.code && !draft.code.startsWith(`LS-${garmentInfo(e.target.value)?.typeCode}-`) ? "" : draft.code })}
                />
                <div className="flex items-start gap-2">
                  <TextInput
                    label="Article code"
                    required
                    value={draft.code}
                    placeholder={info ? `LS-${info.typeCode}-0101` : "LS-SH-0101"}
                    onChange={(e) => patch({ code: e.target.value.toUpperCase() })}
                    error={err("article.code")}
                    helper="Printed on stock and bills"
                    className="flex-1"
                  />
                  <Button variant="secondary" className="mt-6" disabled={!info} onClick={() => void autoCode()} icon={<Sparkles aria-hidden="true" className="size-icon-sm" />}>
                    Auto
                  </Button>
                </div>
              </div>
              <TextInput label="Article name" required value={draft.name} onChange={(e) => patch({ name: e.target.value })} error={err("article.name")} placeholder="Check Shirt" />
              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  label="Brand"
                  required
                  value={draft.brandId}
                  placeholder="Choose…"
                  options={brands.map((b) => ({ value: b.id, label: b.name }))}
                  error={err("article.brandId")}
                  helper={brands.length === 0 ? "Add a brand in Settings first" : undefined}
                  onChange={(e) => patch({ brandId: e.target.value })}
                />
                <Select label="Style" value={draft.style} placeholder="Optional" options={styles.map((s) => ({ value: s, label: s }))} onChange={(e) => patch({ style: e.target.value })} />
                <Select label="Fabric" value={draft.fabric} placeholder="Optional" options={FABRICS.map((s) => ({ value: s, label: s }))} onChange={(e) => patch({ fabric: e.target.value })} />
                <Select label="Pattern" value={draft.pattern} placeholder="Optional" options={PATTERNS.map((s) => ({ value: s, label: s }))} onChange={(e) => patch({ pattern: e.target.value })} />
                <TextInput label="Minimum order (pieces)" required inputMode="numeric" value={draft.moq} onChange={(e) => patch({ moq: e.target.value })} error={err("article.moq")} />
                <TextInput
                  label="Fixed lot size (pieces)"
                  inputMode="numeric"
                  value={draft.lotSize}
                  onChange={(e) => patch({ lotSize: e.target.value })}
                  error={err("article.lotSize")}
                  helper="Leave empty if buyers may order any quantity at or above the minimum"
                />
              </div>
              <Textarea label="Description" rows={3} value={draft.description} onChange={(e) => patch({ description: e.target.value })} helper="Shown on the website. Only facts about the garment." />
              <Switch label="Feature on the home page" checked={draft.featured} onChange={(v) => patch({ featured: v })} />
            </div>
          ) : null}

          {draft.step === 1 ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <h2 className="type-h3">Sizes</h2>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Sizes made">
                  {SIZE_OPTIONS.map((s) => {
                    const on = draft.sizes.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={on}
                        onClick={() => patch({ sizes: SIZE_OPTIONS.filter((x) => (x === s ? !on : draft.sizes.includes(x))) as SizeName[] })}
                        className={cx("inline-flex h-control min-w-control items-center justify-center rounded-md border-2 px-4 type-small font-bold focus-ring", on ? "border-gold bg-surface-2 text-fg" : "border-border text-fg-muted")}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
                {err("sizes") ? <p role="alert" className="type-small text-danger">{err("sizes")}</p> : null}
              </div>

              <div className="flex flex-col gap-3">
                <h2 className="type-h3">Colours</h2>
                <p className="type-small text-fg-muted">Tap a common colour to add it, or add your own. The 3-letter code goes into stock codes (for example LS-SH-0101-NVY-M).</p>
                <div className="flex flex-wrap gap-2">
                  {COLOUR_PRESETS.filter((p) => !draft.colours.some((c) => c.code.toUpperCase() === p.code)).map((p) => (
                    <button key={p.code} type="button" onClick={() => addColour(p)} className="inline-flex h-control-sm items-center gap-2 rounded-full border border-border px-3 type-small hover:bg-surface-2 focus-ring">
                      {/* Product colour is data, not a design token. */}
                      <span aria-hidden="true" className="size-swatch-sm rounded-full border border-border-strong" style={{ backgroundColor: p.hex }} />
                      {p.name}
                    </button>
                  ))}
                  <Button size="sm" variant="secondary" icon={<Plus aria-hidden="true" className="size-icon-sm" />} onClick={() => addColour()}>
                    Other colour
                  </Button>
                </div>
                {err("colours") ? <p role="alert" className="type-small text-danger">{err("colours")}</p> : null}
                <div className="flex flex-col gap-3">
                  {draft.colours.map((c, i) => (
                    <div key={c.key} className="grid items-start gap-3 rounded-md border border-border p-3 md:grid-cols-2 lg:grid-cols-4">
                      <TextInput label="Colour name" value={c.name} onChange={(e) => updateColour(c.key, { name: e.target.value })} error={err(`colours.${i}.name`)} />
                      <TextInput label="Code" value={c.code} maxLength={3} onChange={(e) => updateColour(c.key, { code: e.target.value.toUpperCase() })} error={err(`colours.${i}.code`)} />
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`hex-${c.key}`} className="type-small font-semibold">Shade</label>
                        <div className="flex items-center gap-2">
                          <input id={`hex-${c.key}`} type="color" value={c.hex} onChange={(e) => updateColour(c.key, { hex: e.target.value.toUpperCase() })} className="h-control w-control cursor-pointer rounded-md border border-border-strong bg-surface p-1 focus-ring" />
                          <span className="type-caption text-fg-muted">{c.hex}</span>
                        </div>
                      </div>
                      <Button variant="ghost" iconOnly aria-label={`Remove ${c.name || "colour"}`} className="md:mt-6" onClick={() => patch({ colours: draft.colours.filter((x) => x.key !== c.key) })}>
                        <Trash2 aria-hidden="true" className="size-icon" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {draft.step === 2 ? (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="type-h3">Photos</h2>
                <p className="type-small text-fg-muted">One or more photos for each colour. The first is the main photo. A colour without a photo keeps the article hidden from the website.</p>
              </div>
              {err("photos") ? <p role="alert" className="type-small text-danger">{err("photos")}</p> : null}
              {draft.colours.map((c) => (
                <div key={c.key} className="flex flex-col gap-2">
                  <h3 className="type-h4 flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-swatch-sm rounded-full border border-border-strong"
                      // Product colour is data, not a design token.
                      style={{ backgroundColor: c.hex }}
                    />
                    {c.name}
                  </h3>
                  <PhotoUploader
                    label={`${draft.name || draft.code} in ${c.name}`}
                    value={c.photos}
                    onChange={(next) => updateColour(c.key, (current) => ({ photos: typeof next === "function" ? next(current.photos) : next }))}
                  />
                </div>
              ))}
            </div>
          ) : null}

          {draft.step === 3 ? (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="type-h3">Opening stock</h2>
                <p className="type-small text-fg-muted">Pieces made for each colour and size. Leave blank for none. This is recorded as one production batch.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-left type-small text-fg-muted">
                      <th scope="col" className="py-2 pr-3 font-semibold">Colour</th>
                      {draft.sizes.map((s) => (
                        <th key={s} scope="col" className="px-1 py-2 text-center font-semibold">{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {draft.colours.map((c, i) => (
                      <tr key={c.key} className="border-t border-border">
                        <th scope="row" className="py-2 pr-3 text-left type-small font-semibold">{c.name}</th>
                        {draft.sizes.map((s) => (
                          <td key={s} className="px-1 py-2">
                            <TextInput
                              label={`${c.name} ${s} pieces`}
                              hideLabel
                              inputMode="numeric"
                              value={c.stock[s] ?? ""}
                              onChange={(e) => updateColour(c.key, (cur) => ({ stock: { ...cur.stock, [s]: e.target.value } }))}
                              error={err(`colours.${i}.stock.${s}`)}
                              className="min-w-16"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="type-body">Total: <strong className="tabular">{formatNumber(totalPieces(draft))}</strong> pieces</p>
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput label="Produced on" type="date" value={draft.producedOn} onChange={(e) => patch({ producedOn: e.target.value })} error={err("producedOn")} />
                <TextInput label="Batch note" value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Optional" />
              </div>
            </div>
          ) : null}

          {draft.step === 4 ? (
            <div className="flex flex-col gap-4">
              <h2 className="type-h3">Review</h2>
              <dl className="grid gap-x-6 gap-y-2 md:grid-cols-2">
                {[
                  ["Code", draft.code],
                  ["Name", draft.name],
                  ["Type", draft.garment],
                  ["Brand", brands.find((b) => b.id === draft.brandId)?.name ?? ""],
                  ["Minimum order", `${draft.moq} pieces`],
                  ["Lot", draft.lotSize ? `Fixed ${draft.lotSize} pieces` : "Any quantity at or above the minimum"],
                  ["Sizes", draft.sizes.join(", ")],
                  ["Colours", String(draft.colours.length)],
                  ["Opening stock", `${formatNumber(totalPieces(draft))} pieces`],
                ].map(([k, v]) => (
                  <div key={k} className="flex flex-col">
                    <dt className="type-small text-fg-muted">{k}</dt>
                    <dd className="type-body">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
              <Switch
                label="Show on the website now"
                description={allHavePhotos ? "Buyers can see it as soon as it has stock." : "Needs a photo for every colour. You can publish later from Inventory."}
                checked={draft.isPublic && allHavePhotos}
                disabled={!allHavePhotos}
                onChange={(v) => patch({ isPublic: v })}
              />
              {saveError ? <Banner tone="danger">{saveError}</Banner> : null}
            </div>
          ) : null}
        </Card>

        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" disabled={draft.step === 0} icon={<ArrowLeft aria-hidden="true" className="size-icon-sm" />} onClick={() => goTo(draft.step - 1)}>
            Back
          </Button>
          {draft.step < STEPS.length - 1 ? (
            <Button onClick={next} icon={<ArrowRight aria-hidden="true" className="size-icon-sm" />}>
              Next
            </Button>
          ) : (
            <Button loading={saving} onClick={() => void save()}>
              Save article
            </Button>
          )}
        </div>
      </div>

      <aside aria-label="Live preview" className="flex w-full flex-col gap-3 lg:sticky lg:top-24 lg:w-filters lg:self-start">
        <p className="type-small font-semibold text-fg-muted">Preview, as a buyer sees it</p>
        <Card className="flex flex-col gap-3">
          {previewPhoto ? (
            <SmartImage photo={previewPhoto} sizes="320px" className="rounded-md" />
          ) : (
            <div className="flex aspect-4/5 items-center justify-center rounded-md bg-surface-2 type-small text-fg-muted">Photo appears here</div>
          )}
          {draft.colours.length > 0 ? (
            <SwatchRow colours={draft.colours.map((c) => ({ name: c.name || "Colour", hex: c.hex }))} selectedIndex={previewIndex} onSelect={setPreview} />
          ) : null}
          <p className="type-caption text-gold-text">{draft.code || "LS-SH-0000"}</p>
          <p className="type-h4">{draft.name || "Article name"}</p>
          <div className="flex flex-wrap gap-1">
            {draft.sizes.map((s) => (
              <SizeChip key={s} size={s} />
            ))}
          </div>
          <p className="type-small text-fg-muted">Min. {draft.moq || "—"} pcs · price on request</p>
        </Card>
      </aside>
    </div>
  );
}
