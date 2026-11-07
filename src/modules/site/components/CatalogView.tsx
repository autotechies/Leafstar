"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, Shirt } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Modal";
import { EmptyState, ErrorState } from "@/components/ui/Feedback";
import { Select, TextInput } from "@/components/ui/Field";
import { formatNumber } from "@/lib/numbers";
import type { PublicArticle } from "../data";
import { ProductCard, type ContactInfo } from "./ProductCard";

/* Catalog (DESIGN.md §7): filters on the left from 1024px, in a drawer below; 2 columns on phones. */

interface Filters {
  q: string;
  garment: string;
  style: string;
  fabric: string;
  pattern: string;
  colour: string;
  size: string;
  brand: string;
  sort: "newest" | "name";
}

const empty: Filters = { q: "", garment: "", style: "", fabric: "", pattern: "", colour: "", size: "", brand: "", sort: "newest" };
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const unique = (values: Array<string | null>) => [...new Set(values.filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b));
const opts = (values: string[]) => values.map((v) => ({ value: v, label: v }));

function apply(articles: PublicArticle[], f: Filters) {
  const q = f.q.trim().toLowerCase();
  const list = articles.filter(
    (a) =>
      (!q || [a.name, a.code, a.brand, a.fabric, a.pattern, a.style].some((v) => v?.toLowerCase().includes(q))) &&
      (!f.garment || a.garment === f.garment) &&
      (!f.style || a.style === f.style) &&
      (!f.fabric || a.fabric === f.fabric) &&
      (!f.pattern || a.pattern === f.pattern) &&
      (!f.brand || a.brand === f.brand) &&
      (!f.colour || a.colours.some((c) => c.name === f.colour)) &&
      (!f.size || a.sizes.includes(f.size)),
  );
  return f.sort === "name" ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function FilterFields({ articles, f, set }: { articles: PublicArticle[]; f: Filters; set: (c: Partial<Filters>) => void }) {
  const sizes = unique(articles.flatMap((a) => a.sizes)).sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
  return (
    <div className="flex flex-col gap-4">
      <Select label="Type" placeholder="All types" value={f.garment} options={opts(unique(articles.map((a) => a.garment)))} onChange={(e) => set({ garment: e.target.value })} />
      <Select label="Style" placeholder="All styles" value={f.style} options={opts(unique(articles.map((a) => a.style)))} onChange={(e) => set({ style: e.target.value })} />
      <Select label="Fabric" placeholder="All fabrics" value={f.fabric} options={opts(unique(articles.map((a) => a.fabric)))} onChange={(e) => set({ fabric: e.target.value })} />
      <Select label="Pattern" placeholder="All patterns" value={f.pattern} options={opts(unique(articles.map((a) => a.pattern)))} onChange={(e) => set({ pattern: e.target.value })} />
      <Select label="Colour" placeholder="All colours" value={f.colour} options={opts(unique(articles.flatMap((a) => a.colours.map((c) => c.name))))} onChange={(e) => set({ colour: e.target.value })} />
      <Select label="Size" placeholder="All sizes" value={f.size} options={opts(sizes)} onChange={(e) => set({ size: e.target.value })} />
      <Select label="Brand" placeholder="All brands" value={f.brand} options={opts(unique(articles.map((a) => a.brand)))} onChange={(e) => set({ brand: e.target.value })} />
    </div>
  );
}

export function CatalogView({ articles, failed, contact, initialGarment }: { articles: PublicArticle[]; failed: boolean; contact: ContactInfo; initialGarment: string }) {
  const router = useRouter();
  const [f, setF] = useState<Filters>({ ...empty, garment: initialGarment });
  const [drawer, setDrawer] = useState(false);
  const set = (c: Partial<Filters>) => setF((cur) => ({ ...cur, ...c }));
  const shown = useMemo(() => apply(articles, f), [articles, f]);
  const active = (["garment", "style", "fabric", "pattern", "colour", "size", "brand"] as const).filter((k) => f[k]).length;

  if (failed) return <ErrorState description="We could not load the catalog just now. Please try again in a moment, or call us." onRetry={() => router.refresh()} />;
  if (articles.length === 0) {
    return <EmptyState icon={Shirt} title="New styles are on their way" description="We are adding our latest shirts and pants. Call or message us to hear what is ready to ship today." />;
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <aside aria-label="Filters" className="hidden lg:block lg:w-filters lg:shrink-0">
        <div className="card-surface sticky top-nav-lg flex flex-col gap-4 p-4">
          <FilterFields articles={articles} f={f} set={set} />
          {active > 0 ? <Button variant="ghost" onClick={() => setF({ ...empty, q: f.q, sort: f.sort })}>Clear filters</Button> : null}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="sticky top-nav z-10 -mx-4 flex flex-col gap-3 bg-bg px-4 py-3 md:-mx-6 md:px-6 lg:static lg:mx-0 lg:p-0">
          <div className="flex gap-3">
            <div className="flex-1">
              <TextInput label="Search articles" hideLabel placeholder="Search by name, code or fabric" type="search" value={f.q} onChange={(e) => set({ q: e.target.value })} />
            </div>
            <Button variant="secondary" className="lg:hidden" icon={<SlidersHorizontal aria-hidden="true" className="size-icon" />} onClick={() => setDrawer(true)}>
              Filters{active ? ` (${active})` : ""}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p role="status" className="type-small text-fg-muted">
              {shown.length === articles.length ? `${formatNumber(shown.length)} ${shown.length === 1 ? "article" : "articles"}` : `${formatNumber(shown.length)} of ${formatNumber(articles.length)} articles`}
            </p>
            <div className="w-40 md:w-48">
              <Select label="Sort by" hideLabel value={f.sort} options={[{ value: "newest", label: "Newest first" }, { value: "name", label: "Name, A to Z" }]} onChange={(e) => set({ sort: e.target.value as Filters["sort"] })} />
            </div>
          </div>
        </div>
        {shown.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No articles match"
            description="Try removing a filter, or ask us. We may have what you need ready to ship."
            action={<Button variant="secondary" onClick={() => setF(empty)}>Clear filters</Button>}
          />
        ) : (
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
            {shown.map((a, i) => (
              <li key={a.id}>
                <ProductCard article={a} contact={contact} priority={i < 4} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title="Filters"
        footer={
          <>
            <Button variant="secondary" onClick={() => setF({ ...empty, q: f.q, sort: f.sort })}>Clear</Button>
            <Button onClick={() => setDrawer(false)}>Show {formatNumber(shown.length)} articles</Button>
          </>
        }
      >
        <FilterFields articles={articles} f={f} set={set} />
      </Drawer>
    </div>
  );
}
