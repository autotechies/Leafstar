import { formatNumber } from "@/lib/numbers";

/* Horizontal bars with the number written beside each (readable without hover). */
export function BarList({ items, tone = "series-1", empty = "Not enough data yet." }: { items: Array<{ label: string; value: number }>; tone?: "series-1" | "series-2"; empty?: string }) {
  if (items.length === 0) return <p className="type-small text-fg-muted">{empty}</p>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-3">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-12 items-center gap-3 type-small">
          <span className="col-span-4 truncate font-semibold" title={i.label}>{i.label}</span>
          <span className="col-span-6 h-3 overflow-hidden rounded-full bg-surface-2">
            {/* The bar's width is data (its share of the largest value). */}
            <span className={tone === "series-1" ? "block h-full rounded-full bg-series-1" : "block h-full rounded-full bg-series-2"} style={{ width: `${Math.max(2, Math.round((i.value / max) * 100))}%` }} />
          </span>
          <span className="col-span-2 text-right tabular">{formatNumber(i.value)}</span>
        </li>
      ))}
    </ul>
  );
}
