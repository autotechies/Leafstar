"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Feedback";
import { formatPhone } from "@/lib/formats";
import { formatNumber } from "@/lib/numbers";
import { stageLabel, type Stage } from "@/modules/crm/types";
import type { SearchResults } from "../queries";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const row = "flex flex-wrap items-center justify-between gap-2 rounded-md px-1 py-2 type-body hover:bg-surface-2 focus-ring";

export function SearchResultsView({ r }: { r: SearchResults }) {
  const total = r.articles.length + r.variants.length + r.leads.length + r.buyers.length + r.bills.length;
  if (r.q.length < 2) return <EmptyState icon={Search} title="Search everything" description="Type at least 2 letters: a SKU such as LS-SH-0101-NVY-M, an article name, a buyer's name or phone, or a bill number." />;
  if (total === 0) return <EmptyState icon={Search} title={`Nothing found for "${r.q}"`} description="Check the spelling, or try fewer letters. Phone numbers need at least 4 digits." />;
  return (
    <div className="flex flex-col gap-6">
      {r.exact ? (
        <Card className="flex flex-col gap-4">
          <CardHeader title={r.exact.variant.sku} description={`${r.exact.variant.articleName} · ${r.exact.variant.colour} · size ${r.exact.variant.size}`} action={<Link href={`/admin/inventory/${r.exact.variant.articleCode}`} className="inline-flex min-h-control items-center rounded-sm type-small font-bold text-gold-text underline focus-ring">Open article</Link>} />
          <p className="type-h2 tabular">{formatNumber(r.exact.variant.stock)} <span className="type-small text-fg-muted">pieces in stock</span></p>
          <section aria-label="Latest movements" className="flex flex-col gap-2">
            <h3 className="type-h4">Latest movements</h3>
            {r.exact.movements.length === 0 ? <p className="type-small text-fg-muted">No movements yet.</p> : (
              <ul className="flex flex-col gap-1">
                {r.exact.movements.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 type-small">
                    <span><span className="tabular font-semibold">{m.qty > 0 ? `+${m.qty}` : m.qty}</span> · {m.reason}{m.note ? ` · ${m.note}` : ""}</span>
                    <span className="text-fg-muted">{when(m.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-label="Bills" className="flex flex-col gap-2">
            <h3 className="type-h4">Bills with this SKU</h3>
            {r.exact.bills.length === 0 ? <p className="type-small text-fg-muted">No bills yet.</p> : (
              <ul>{r.exact.bills.map((b) => (<li key={b.id}><Link href={`/admin/bills/review/${b.id}`} className={row}>{b.billNumber ? `Bill ${b.billNumber}` : "Bill without a number"}<span className="type-small text-fg-muted">{b.billDate ?? ""} · {b.status}</span></Link></li>))}</ul>
            )}
          </section>
          <section aria-label="Leads" className="flex flex-col gap-2">
            <h3 className="type-h4">Leads who asked for this article</h3>
            {r.exact.leads.length === 0 ? <p className="type-small text-fg-muted">Nobody yet.</p> : (
              <ul>{r.exact.leads.map((l, i) => (<li key={`${l.id}-${i}`}><Link href={`/admin/crm/${l.id}`} className={row}>{l.name}<span className="type-small text-fg-muted">{stageLabel[l.stage as Stage] ?? l.stage}{l.quantity ? ` · ${l.quantity} pieces` : ""}</span></Link></li>))}</ul>
            )}
          </section>
        </Card>
      ) : null}

      {r.articles.length ? (
        <Card><CardHeader title="Articles" /><ul>{r.articles.map((a) => (<li key={a.code}><Link href={`/admin/inventory/${a.code}`} className={row}><span className="font-semibold">{a.name}</span><span className="type-small text-fg-muted">{a.code} · {a.garment}</span></Link></li>))}</ul></Card>
      ) : null}
      {r.variants.length && !r.exact ? (
        <Card><CardHeader title="SKUs" /><ul>{r.variants.map((v) => (<li key={v.id}><Link href={`/admin/search?q=${encodeURIComponent(v.sku)}`} className={row}><span className="font-semibold">{v.sku}</span><span className="type-small text-fg-muted">{v.articleName} · {v.colour} · {v.size} · <span className="tabular">{formatNumber(v.stock)}</span> pcs</span></Link></li>))}</ul></Card>
      ) : null}
      {r.leads.length ? (
        <Card><CardHeader title="Leads" /><ul>{r.leads.map((l) => (<li key={l.id}><Link href={`/admin/crm/${l.id}`} className={row}><span className="font-semibold">{l.name}{l.businessName ? ` · ${l.businessName}` : ""}</span><span className="flex items-center gap-2 type-small text-fg-muted">{formatPhone(l.phone)} <Badge tone="neutral">{stageLabel[l.stage as Stage] ?? l.stage}</Badge></span></Link></li>))}</ul></Card>
      ) : null}
      {r.buyers.length ? (
        <Card><CardHeader title="Buyers" /><ul>{r.buyers.map((b) => (<li key={b.id}><Link href="/admin/crm/buyers" className={row}><span className="font-semibold">{b.name}{b.businessName ? ` · ${b.businessName}` : ""}</span><span className="type-small text-fg-muted">{b.phone ? formatPhone(b.phone) : ""}</span></Link></li>))}</ul></Card>
      ) : null}
      {r.bills.length && !r.exact ? (
        <Card><CardHeader title="Bills" /><ul>{r.bills.map((b) => (<li key={b.id}><Link href={`/admin/bills/review/${b.id}`} className={row}><span className="font-semibold">{b.billNumber ? `Bill ${b.billNumber}` : "No number"}</span><span className="type-small text-fg-muted">{b.billDate ?? ""} · {b.status}</span></Link></li>))}</ul></Card>
      ) : null}
    </div>
  );
}
