import Link from "next/link";
import type { ReactNode } from "react";
import { BarList } from "@/components/charts/BarList";
import { LineChart } from "@/components/charts/LineChart";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cx } from "@/lib/cx";
import { formatNumber } from "@/lib/numbers";
import type { Dashboard, Range } from "../queries";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function Attention({ href, tone, value, label, hint }: { href: string; tone: "danger" | "warning" | "info"; value: number; label: string; hint?: string }) {
  const bar = tone === "danger" ? "border-l-danger" : tone === "warning" ? "border-l-warning" : "border-l-success";
  return (
    <Link href={href} className={cx("flex flex-col gap-1 rounded-lg border border-l-4 border-border bg-surface p-4 shadow-1 transition-colors duration-150 hover:bg-surface-2 focus-ring", bar)}>
      <span className="type-h1 tabular">{formatNumber(value)}</span>
      <span className="type-small font-semibold">{label}</span>
      {hint ? <span className="type-caption text-fg-muted">{hint}</span> : null}
    </Link>
  );
}

function Kpi({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 transition-colors duration-150 hover:bg-surface-2 focus-ring">
      <span className="type-caption text-fg-muted">{label}</span>
      <span className="type-h2 tabular">{formatNumber(value)}</span>
    </Link>
  );
}

function Panel({ title, href, children, note }: { title: string; href?: string; children: ReactNode; note?: string }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="type-h4">{href ? <Link href={href} className="rounded-sm hover:underline focus-ring">{title}</Link> : title}</h2>
        {note ? <span className="type-caption text-fg-muted">{note}</span> : null}
      </div>
      {children}
    </Card>
  );
}

export function DashboardView({ d }: { d: Dashboard }) {
  const a = d.attention;
  const tidy = d.checks.noPhotos + d.checks.draftBills + d.checks.failedScans + d.checks.hiddenNoStock;
  const aiPct = d.ai.budget > 0 ? Math.min(100, Math.round((d.ai.tokensToday / d.ai.budget) * 100)) : 0;
  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Date range" className="flex gap-2">
        {([7, 30, 90] as Range[]).map((r) => (
          <Link key={r} href={r === 30 ? "/admin" : `/admin?range=${r}`} aria-current={d.range === r ? "page" : undefined} className={buttonClasses({ size: "sm", variant: d.range === r ? "primary" : "secondary" })}>{r} days</Link>
        ))}
      </nav>

      <section aria-label="Needs attention" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Attention href="/admin/inbox" tone={a.waiting > 0 ? "danger" : "info"} value={a.waiting} label={a.waiting === 1 ? "Buyer waiting for a reply" : "Buyers waiting for a reply"} hint={a.oldestWaitingHours !== null ? `Longest wait: ${a.oldestWaitingHours} h` : "Nobody is waiting"} />
        <Attention href="/admin/inventory?stock=out" tone={a.outArticles > 0 ? "danger" : "info"} value={a.outArticles} label="Articles out of stock" hint="Hidden from buyers until restocked" />
        <Attention href="/admin/inventory?stock=low" tone={a.lowArticles > 0 ? "warning" : "info"} value={a.lowArticles} label="Articles running low" hint="At least one size is below its limit" />
        <Attention href="/admin/crm" tone={a.followUps > 0 ? "warning" : "info"} value={a.followUps} label="Follow-ups due" hint="Leads you promised to call" />
      </section>

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Pieces in stock" value={d.kpi.piecesInStock} href="/admin/inventory" />
        <Kpi label={`Pieces sold, ${d.range} days`} value={d.kpi.sold} href="/admin/bills" />
        <Kpi label={`Pieces made, ${d.range} days`} value={d.kpi.made} href="/admin/stock/add" />
        <Kpi label="Open leads" value={d.kpi.openLeads} href="/admin/crm" />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Panel title="Stock in and out" href="/admin/inventory" note={`Last ${d.range} days`}>
            {d.flow.every((f) => f.inPieces === 0 && f.outPieces === 0) ? <p className="type-small text-fg-muted">Not enough data yet. Add stock or apply a bill and the lines appear.</p> : (
              <LineChart caption={`Pieces added and taken out of stock each day over ${d.range} days`} labels={d.flow.map((f) => f.day)} series={[{ name: "Added", tone: "series-1", values: d.flow.map((f) => f.inPieces) }, { name: "Taken out", tone: "series-2", values: d.flow.map((f) => f.outPieces) }]} />
            )}
          </Panel>
        </div>
        <Panel title="Restock first" note="Selling and running out">
          {d.restock.length === 0 ? <p className="type-small text-fg-muted">Nothing urgent, or not enough sales yet. This list fills as bills are applied.</p> : (
            <ul className="flex flex-col gap-2">
              {d.restock.slice(0, 6).map((r) => (
                <li key={r.sku}>
                  <Link href={`/admin/search?q=${encodeURIComponent(r.sku)}`} className="flex flex-col gap-1 rounded-md px-1 py-1 type-small hover:bg-surface-2 focus-ring">
                    <span className="font-semibold">{r.sku}</span>
                    <span className="text-fg-muted"><span className="tabular">{formatNumber(r.stock)}</span> left · sold <span className="tabular">{formatNumber(r.sold)}</span>{r.daysLeft !== null ? ` · about ${r.daysLeft} days` : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Demand vs stock" href="/admin/crm" note="Open leads">
          {d.demand.length === 0 ? <p className="type-small text-fg-muted">Not enough data yet. When buyers ask for pieces, you see them next to your stock here.</p> : (
            <ul className="flex flex-col gap-2">
              {d.demand.map((r) => (
                <li key={r.code}>
                  <Link href={`/admin/inventory/${r.code}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md px-1 py-1 type-small hover:bg-surface-2 focus-ring">
                    <span className="font-semibold">{r.name}<span className="ml-2 font-normal text-fg-muted">{r.code}</span></span>
                    <span className={r.asked > r.stock ? "font-semibold text-danger" : "text-fg-muted"}>asked <span className="tabular">{formatNumber(r.asked)}</span> · have <span className="tabular">{formatNumber(r.stock)}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Stock by article" href="/admin/inventory" note="Top 8"><BarList items={d.byArticle} empty="Not enough data yet. Add stock to see your articles here." /></Panel>
      </div>

      {tidy > 0 ? (
        <Card className="flex flex-col gap-3">
          <h2 className="type-h4">To tidy up</h2>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 type-small">
            {d.checks.draftBills > 0 ? <li><Link href="/admin/bills" className="rounded-sm underline focus-ring">{d.checks.draftBills} {d.checks.draftBills === 1 ? "bill is" : "bills are"} waiting for your review</Link></li> : null}
            {d.checks.failedScans > 0 ? <li><Link href="/admin/bills/scan" className="rounded-sm underline focus-ring">{d.checks.failedScans} {d.checks.failedScans === 1 ? "bill" : "bills"} could not be read</Link></li> : null}
            {d.checks.noPhotos > 0 ? <li><Link href="/admin/inventory" className="rounded-sm underline focus-ring">{d.checks.noPhotos} {d.checks.noPhotos === 1 ? "article has" : "articles have"} no photos</Link></li> : null}
            {d.checks.hiddenNoStock > 0 ? <li><Link href="/admin/inventory?visibility=hidden" className="rounded-sm underline focus-ring">{d.checks.hiddenNoStock} published {d.checks.hiddenNoStock === 1 ? "article is" : "articles are"} hidden for no stock</Link></li> : null}
          </ul>
        </Card>
      ) : null}

      <details className="group rounded-lg border border-border bg-surface">
        <summary className="flex min-h-control cursor-pointer items-center justify-between gap-3 rounded-lg px-4 py-3 type-h4 focus-ring">
          More insights
          <span className="type-caption font-normal text-fg-muted">Size and colour spread, slow movers, recent movements, AI use</span>
        </summary>
        <div className="flex flex-col gap-6 border-t border-border p-4 md:p-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Size spread" href="/admin/inventory"><BarList items={d.sizes} empty="Not enough data yet." /></Panel>
            <Panel title="Colour spread" href="/admin/inventory"><BarList items={d.colours} tone="series-2" empty="Not enough data yet." /></Panel>
            <Panel title="Shirts and pants" href="/admin/inventory"><BarList items={d.categories} empty="Not enough data yet." /></Panel>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Slow movers" note={`Nothing sold in ${d.range} days`}>
              {d.slow.length === 0 ? <p className="type-small text-fg-muted">Nothing is sitting still, or no sales are recorded yet.</p> : (
                <ul className="flex flex-col gap-2">
                  {d.slow.map((r) => (
                    <li key={r.code}><Link href={`/admin/inventory/${r.code}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md px-1 py-1 type-small hover:bg-surface-2 focus-ring"><span className="font-semibold">{r.name}<span className="ml-2 font-normal text-fg-muted">{r.code}</span></span><span className="tabular text-fg-muted">{formatNumber(r.stock)} pcs</span></Link></li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Recent stock movements">
              {d.recent.length === 0 ? <p className="type-small text-fg-muted">No movements yet.</p> : (
                <ul className="flex flex-col gap-2">
                  {d.recent.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 type-small">
                      <span><span className="tabular font-semibold">{m.qty > 0 ? `+${m.qty}` : m.qty}</span> · {m.sku} · {m.reason}</span>
                      <span className="text-fg-muted">{when(m.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
          <Panel title="AI use today" href="/admin/settings">
            {d.ai.budget === 0 ? <p className="type-small text-fg-muted">No daily limit set.</p> : (
              <div className="flex flex-col gap-2">
                <p className="type-small"><span className="tabular font-semibold">{formatNumber(d.ai.tokensToday)}</span> of <span className="tabular">{formatNumber(d.ai.budget)}</span> tokens ({aiPct}%){d.ai.paused ? " · AI is paused" : ""}</p>
                <progress className="h-3 w-full overflow-hidden rounded-full" value={d.ai.tokensToday} max={d.ai.budget} aria-label="AI tokens used today" />
              </div>
            )}
          </Panel>
        </div>
      </details>
    </div>
  );
}
