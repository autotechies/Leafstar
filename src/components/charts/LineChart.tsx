import { formatNumber } from "@/lib/numbers";

/*
  A small line chart in plain SVG (DESIGN.md §8): two series, labelled axes, values readable without hover, and a
  table for screen readers. Colours come from the series tokens, so both themes work.
*/

export interface Series { name: string; values: number[]; tone: "series-1" | "series-2" }

const W = 600;
const H = 220;
const PAD = { l: 44, r: 12, t: 12, b: 28 };

export function LineChart({ labels, series, caption }: { labels: string[]; series: Series[]; caption: string }) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const nice = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / nice) * nice;
  const x = (i: number) => PAD.l + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const ticks = [0, top / 2, top];
  const show = (i: number) => i === 0 || i === labels.length - 1 || i === Math.floor((labels.length - 1) / 2);
  return (
    <figure className="relative flex min-w-0 flex-col gap-2 overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={caption} className="w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" className="fill-fg-muted" fontSize={11}>{formatNumber(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => (show(i) ? <text key={l} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"} className="fill-fg-muted" fontSize={11}>{l.slice(5)}</text> : null))}
        {series.map((s) => (
          <polyline key={s.name} fill="none" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" className={s.tone === "series-1" ? "stroke-series-1" : "stroke-series-2"} points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-4 type-caption text-fg-muted">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-2">
            <span aria-hidden="true" className={s.tone === "series-1" ? "h-1 w-4 rounded-full bg-series-1" : "h-1 w-4 rounded-full bg-series-2"} />
            {s.name}: <span className="tabular font-semibold text-fg">{formatNumber(s.values.reduce((a, b) => a + b, 0))}</span>
          </span>
        ))}
      </figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead><tr><th scope="col">Day</th>{series.map((s) => <th key={s.name} scope="col">{s.name}</th>)}</tr></thead>
        <tbody>{labels.map((l, i) => (<tr key={l}><th scope="row">{l}</th>{series.map((s) => <td key={s.name}>{s.values[i]}</td>)}</tr>))}</tbody>
      </table>
    </figure>
  );
}
