"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Shirt } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/Feedback";
import { Select, TextInput } from "@/components/ui/Field";
import { formatNumber } from "@/lib/numbers";
import { ImageViewer } from "@/modules/images/components/LazyImageViewer";
import { SmartImage } from "@/modules/images/components/SmartImage";
import type { Photo } from "@/modules/images/types";
import { buttonClasses } from "@/components/ui/Button";
import type { InvArticle } from "../queries";
import { applyFilters, visibilityLabel, visibilityOf, type InventoryFilters } from "../status";

/* Inventory list: filters, table on desktop and cards on phones. Thumbnails open the shared photo viewer. */

export function InventoryList({ articles, brands, initial }: { articles: InvArticle[]; brands: Array<{ id: string; name: string }>; initial: InventoryFilters }) {
  const [f, setF] = useState(initial);
  const [viewer, setViewer] = useState<{ photos: Photo[]; index: number } | null>(null);
  const shown = useMemo(() => applyFilters(articles, f), [articles, f]);
  const set = (change: Partial<InventoryFilters>) => setF((cur) => ({ ...cur, ...change }));
  const filtered = Object.values(f).some(Boolean);

  const columns: Column<InvArticle>[] = [
    {
      key: "photo",
      header: "Photo",
      hideOnPhone: true,
      render: (a) =>
        a.cover ? (
          <button type="button" aria-label={`Open photo of ${a.name}`} onClick={() => setViewer({ photos: a.colours.flatMap((c) => c.photos), index: 0 })} className="block w-12 overflow-hidden rounded-sm focus-ring">
            <SmartImage photo={a.cover} sizes="48px" />
          </button>
        ) : (
          <span className="flex aspect-4/5 w-12 items-center justify-center rounded-sm bg-surface-2 text-fg-muted">
            <Shirt aria-hidden="true" className="size-icon" />
          </span>
        ),
    },
    {
      key: "article",
      header: "Article",
      primary: true,
      render: (a) => (
        <Link href={`/admin/inventory/${a.code}`} className="flex flex-col focus-ring rounded-sm">
          <span className="type-caption text-gold-text">{a.code}</span>
          <span className="type-body font-semibold">{a.name}</span>
        </Link>
      ),
    },
    { key: "brand", header: "Brand", render: (a) => a.brandName },
    { key: "colours", header: "Colours", align: "right", render: (a) => <span className="tabular">{a.colours.length}</span> },
    { key: "pieces", header: "Pieces", align: "right", render: (a) => <span className="tabular font-semibold">{formatNumber(a.totalPieces)}</span> },
    {
      key: "flags",
      header: "Stock",
      render: (a) => (
        <span className="flex flex-wrap gap-1">
          {a.totalPieces === 0 ? <StatusBadge status="outOfStock" /> : a.lowCount > 0 ? <Badge tone="warning">{a.lowCount} low</Badge> : <StatusBadge status="inStock" />}
          {a.totalPieces > 0 && a.outCount > 0 ? <Badge tone="danger">{a.outCount} sold out</Badge> : null}
        </span>
      ),
    },
    {
      key: "visibility",
      header: "Website",
      render: (a) => {
        const v = visibilityOf(a);
        return <Badge tone={v === "live" ? "success" : "neutral"}>{visibilityLabel[v]}</Badge>;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <TextInput label="Search" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Code, name, brand…" />
        <Select label="Type" value={f.garment} onChange={(e) => set({ garment: e.target.value })} options={[{ value: "", label: "All types" }, { value: "Shirt", label: "Shirts" }, { value: "Pant", label: "Pants" }]} />
        <Select label="Brand" value={f.brand} onChange={(e) => set({ brand: e.target.value })} options={[{ value: "", label: "All brands" }, ...brands.map((b) => ({ value: b.id, label: b.name }))]} />
        <Select
          label="Website"
          value={f.visibility}
          onChange={(e) => set({ visibility: e.target.value })}
          options={[{ value: "", label: "All active" }, { value: "live", label: "Live on website" }, { value: "hidden", label: "Hidden" }, { value: "archived", label: "Archived" }]}
        />
        <Select
          label="Stock"
          value={f.stock}
          onChange={(e) => set({ stock: e.target.value })}
          options={[{ value: "", label: "Any" }, { value: "in", label: "In stock" }, { value: "low", label: "Has low sizes" }, { value: "some-out", label: "Has sold-out sizes" }, { value: "out", label: "Out of stock" }]}
        />
      </Card>
      <p className="type-small text-fg-muted" role="status">
        Showing {shown.length} of {articles.length} article{articles.length === 1 ? "" : "s"}
      </p>
      <DataTable
        caption="Articles"
        columns={columns}
        rows={shown}
        rowKey={(a) => a.id}
        empty={
          <EmptyState
            icon={Shirt}
            title={articles.length === 0 ? "No articles yet" : "Nothing matches these filters"}
            description={articles.length === 0 ? "Add your first article, or import your Excel stock file." : "Try clearing a filter."}
            action={articles.length === 0 ? <Link href="/admin/stock/add" className={buttonClasses()}>Add stock</Link> : filtered ? <button type="button" className={buttonClasses({ variant: "secondary" })} onClick={() => setF({ q: "", garment: "", brand: "", visibility: "", stock: "" })}>Clear filters</button> : undefined}
          />
        }
      />
      {viewer ? <ImageViewer photos={viewer.photos} open index={viewer.index} onIndexChange={(index) => setViewer((v) => (v ? { ...v, index } : v))} onClose={() => setViewer(null)} /> : null}
    </div>
  );
}
