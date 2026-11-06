"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Banner, EmptyState } from "@/components/ui/Feedback";
import { Select, TextInput } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { Boxes } from "lucide-react";
import { formatNumber } from "@/lib/numbers";
import { addStockAction, undoStockEntryAction } from "../actions";
import type { ExistingArticle } from "../queries";

/* Add production to an existing article: one batch, many colour/size quantities, all or nothing. */

const today = () => new Date().toISOString().slice(0, 10);

export function AddToExisting({ articles }: { articles: ExistingArticle[] }) {
  const router = useRouter();
  const toast = useToast();
  const [articleId, setArticleId] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [producedOn, setProducedOn] = useState(today());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const article = articles.find((a) => a.id === articleId);
  const entries = Object.entries(qty)
    .map(([variantId, raw]) => ({ variantId, qty: Number(raw.replace(/,/g, "")) }))
    .filter((e) => !Number.isFinite(e.qty) || e.qty !== 0);
  const invalid = entries.some((e) => !Number.isInteger(e.qty) || e.qty < 0);
  const total = entries.reduce((s, e) => s + (Number.isInteger(e.qty) && e.qty > 0 ? e.qty : 0), 0);

  if (articles.length === 0) {
    return (
      <Card>
        <EmptyState icon={Boxes} title="No articles yet" description="Create your first article in the New article tab, or import your Excel file." />
      </Card>
    );
  }

  async function save() {
    setError(null);
    if (invalid) return setError("Use whole numbers of pieces, 1 or more. Clear the boxes you do not need.");
    if (entries.length === 0) return setError("Enter pieces for at least one colour and size.");
    setSaving(true);
    const result = await addStockAction({ producedOn, notes, rows: entries });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    setQty({});
    setNotes("");
    toast.undo({
      title: `${formatNumber(result.pieces)} pieces added to ${article?.code}`,
      description: "Undo within 15 seconds if this was a mistake.",
      onUndo: async () => {
        const undone = await undoStockEntryAction({ batchId: result.batchId });
        toast.show(undone.ok ? { kind: "success", title: "Undone. The stock was taken off again." } : { kind: "error", title: undone.error });
        router.refresh();
      },
    });
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-4">
      <Select
        label="Article"
        value={articleId}
        placeholder="Choose an article…"
        options={articles.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }))}
        onChange={(e) => {
          setArticleId(e.target.value);
          setQty({});
          setError(null);
        }}
      />
      {article ? (
        <>
          <div className="flex flex-col gap-4">
            {article.colours.map((c) => (
              <div key={c.id} className="flex flex-col gap-2">
                <h3 className="type-h4 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-swatch-sm rounded-full border border-border-strong"
                    // Product colour is data, not a design token.
                    style={{ backgroundColor: c.hex }}
                  />
                  {c.name}
                </h3>
                <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
                  {c.variants.map((v) => (
                    <TextInput
                      key={v.id}
                      label={`${v.size} (now ${formatNumber(v.stock)})`}
                      inputMode="numeric"
                      value={qty[v.id] ?? ""}
                      placeholder="0"
                      onChange={(e) => setQty((q) => ({ ...q, [v.id]: e.target.value }))}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Produced on" type="date" value={producedOn} onChange={(e) => setProducedOn(e.target.value)} />
            <TextInput label="Batch note" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <div className="flex items-center justify-between gap-3">
            <p className="type-body">
              Adding <strong className="tabular">{formatNumber(total)}</strong> pieces
            </p>
            <Button loading={saving} onClick={() => void save()} disabled={entries.length === 0}>
              Add stock
            </Button>
          </div>
        </>
      ) : null}
    </Card>
  );
}
