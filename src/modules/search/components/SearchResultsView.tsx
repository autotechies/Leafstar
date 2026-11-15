"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Banner, EmptyState } from "@/components/ui/Feedback";
import { formatPhone } from "@/lib/formats";
import { formatNumber, formatRupees } from "@/lib/numbers";
import { stageLabel, tierLabel, tierTone, type Stage } from "@/modules/crm/types";
import type { SearchResults } from "../queries";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
const row =
  "flex flex-wrap items-center justify-between gap-2 rounded-md px-1 py-2 type-body hover:bg-surface-2 focus-ring";

export function SearchResultsView({ r }: { r: SearchResults }) {
  const total =
    r.articles.length +
    r.variants.length +
    r.leads.length +
    r.buyers.length +
    r.bills.length +
    (r.exactArticle ? 1 : 0);

  if (r.q.length < 2)
    return (
      <EmptyState
        icon={Search}
        title="Search everything"
        description="Type at least 2 letters: an article code like LS-SH-0001, a customer name or phone, a SKU, or a bill number."
      />
    );

  if (total === 0)
    return (
      <EmptyState
        icon={Search}
        title={`Nothing found for "${r.q}"`}
        description="Check the spelling, or try fewer letters. Phone numbers need at least 4 digits."
      />
    );

  return (
    <div className="flex flex-col gap-6">
      {/* Product 360° Hit */}
      {r.exactArticle ? (
        <Card className="flex flex-col gap-4 border border-gold/30">
          <CardHeader
            title={`${r.exactArticle.code} — ${r.exactArticle.name}`}
            description={`${r.exactArticle.garment}${r.exactArticle.fabric ? ` · ${r.exactArticle.fabric}` : ""}`}
            action={
              <Link
                href={`/admin/inventory/${encodeURIComponent(r.exactArticle.code)}`}
                className="inline-flex min-h-control items-center rounded-sm type-small font-bold text-gold-text underline focus-ring"
              >
                Open full article
              </Link>
            }
          />

          {r.exactArticle.stats.deadStockAlert ? (
            <Banner tone={r.exactArticle.stats.isDeadStock ? "warning" : "info"}>
              {r.exactArticle.stats.deadStockAlert}
            </Banner>
          ) : null}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-surface-2 p-3">
              <dt className="type-caption text-fg-muted">Produced</dt>
              <dd className="type-h3 tabular mt-0.5">{formatNumber(r.exactArticle.stats.producedPieces)}</dd>
              <span className="type-caption text-fg-muted">total factory pcs</span>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <dt className="type-caption text-fg-muted">Sold</dt>
              <dd className="type-h3 tabular mt-0.5 text-gold-text">{formatNumber(r.exactArticle.stats.soldPieces)}</dd>
              <span className="type-caption text-fg-muted">verified bills</span>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <dt className="type-caption text-fg-muted">In Stock</dt>
              <dd className="type-h3 tabular mt-0.5">{formatNumber(r.exactArticle.stats.currentStock)}</dd>
              <span className="type-caption text-fg-muted">live warehouse</span>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <dt className="type-caption text-fg-muted">Returned</dt>
              <dd className="type-h3 tabular mt-0.5">{formatNumber(r.exactArticle.stats.returnedPieces)}</dd>
              <span className="type-caption text-fg-muted">
                {r.exactArticle.stats.adjustments !== 0
                  ? `${r.exactArticle.stats.adjustments > 0 ? "+" : ""}${r.exactArticle.stats.adjustments} adj`
                  : "0 returned"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <h4 className="type-small font-semibold text-fg">
              Customers who have purchased this article ({r.exactArticle.stats.buyers.length})
            </h4>
            {r.exactArticle.stats.buyers.length === 0 ? (
              <p className="type-caption text-fg-muted italic">No buyers recorded on applied bills yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle">
                {r.exactArticle.stats.buyers.slice(0, 5).map((b, i) => (
                  <li key={b.contactId ?? `${b.name}-${i}`} className="flex flex-wrap items-center justify-between p-2.5 type-small">
                    <div>
                      {b.contactId ? (
                        <Link href={`/admin/crm/buyers/${b.contactId}`} className="font-semibold text-fg hover:underline">
                          {b.name}
                        </Link>
                      ) : (
                        <span className="font-semibold">{b.name}</span>
                      )}
                      {b.businessName ? <span className="type-caption text-fg-muted"> · {b.businessName}</span> : null}
                      {b.city ? <span className="type-caption text-fg-muted"> ({b.city})</span> : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium tabular">{formatNumber(b.totalPieces)} pcs</span>
                      {b.totalValue !== null ? <span className="text-fg-muted tabular">{formatRupees(b.totalValue)}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      ) : null}

      {/* Variant Exact Hit */}
      {r.exact ? (
        <Card className="flex flex-col gap-4">
          <CardHeader
            title={r.exact.variant.sku}
            description={`${r.exact.variant.articleName} · ${r.exact.variant.colour} · size ${r.exact.variant.size}`}
            action={
              <Link
                href={`/admin/inventory/${r.exact.variant.articleCode}`}
                className="inline-flex min-h-control items-center rounded-sm type-small font-bold text-gold-text underline focus-ring"
              >
                Open article
              </Link>
            }
          />
          <p className="type-h2 tabular">
            {formatNumber(r.exact.variant.stock)} <span className="type-small text-fg-muted">pieces in stock</span>
          </p>
          <section aria-label="Latest movements" className="flex flex-col gap-2">
            <h3 className="type-h4">Latest movements</h3>
            {r.exact.movements.length === 0 ? (
              <p className="type-small text-fg-muted">No movements yet.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {r.exact.movements.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 type-small">
                    <span>
                      <span className="tabular font-semibold">{m.qty > 0 ? `+${m.qty}` : m.qty}</span> · {m.reason}
                      {m.note ? ` · ${m.note}` : ""}
                    </span>
                    <span className="text-fg-muted">{when(m.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-label="Bills" className="flex flex-col gap-2">
            <h3 className="type-h4">Bills with this SKU</h3>
            {r.exact.bills.length === 0 ? (
              <p className="type-small text-fg-muted">No bills yet.</p>
            ) : (
              <ul>
                {r.exact.bills.map((b) => (
                  <li key={b.id}>
                    <Link href={`/admin/bills/review/${b.id}`} className={row}>
                      {b.billNumber ? `Bill ${b.billNumber}` : "Bill without a number"}
                      <span className="type-small text-fg-muted">
                        {b.billDate ?? ""} · {b.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-label="Leads" className="flex flex-col gap-2">
            <h3 className="type-h4">Leads who asked for this article</h3>
            {r.exact.leads.length === 0 ? (
              <p className="type-small text-fg-muted">Nobody yet.</p>
            ) : (
              <ul>
                {r.exact.leads.map((l, i) => (
                  <li key={`${l.id}-${i}`}>
                    <Link href={`/admin/crm/${l.id}`} className={row}>
                      {l.name}
                      <span className="type-small text-fg-muted">
                        {stageLabel[l.stage as Stage] ?? l.stage}
                        {l.quantity ? ` · ${l.quantity} pieces` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Card>
      ) : null}

      {/* Wholesale Customer Hits */}
      {r.buyers.length ? (
        <Card>
          <CardHeader title="Wholesale Customers" />
          <ul className="divide-y divide-border-subtle">
            {r.buyers.map((b) => {
              const tone = (tierTone[b.customerTier] as BadgeTone) || "neutral";
              return (
                <li key={b.id}>
                  <Link href={`/admin/crm/buyers/${b.id}`} className={row}>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-fg">{b.name}</span>
                        {b.businessName ? <span className="type-caption text-fg-muted">({b.businessName})</span> : null}
                        <Badge tone={tone}>{tierLabel[b.customerTier]}</Badge>
                      </div>
                      <span className="type-caption text-fg-muted">
                        {b.city ? `${b.city} · ` : ""}
                        {b.phone ? formatPhone(b.phone) : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      {b.totalPieces > 0 ? (
                        <div>
                          <span className="font-semibold tabular text-fg">{formatNumber(b.totalPieces)} pcs</span>
                          {b.totalValue !== null ? (
                            <span className="block type-caption text-fg-muted tabular">{formatRupees(b.totalValue)}</span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="type-caption text-fg-muted">View Dossier</span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {r.articles.length && !r.exactArticle ? (
        <Card>
          <CardHeader title="Articles" />
          <ul>
            {r.articles.map((a) => (
              <li key={a.code}>
                <Link href={`/admin/inventory/${a.code}`} className={row}>
                  <span className="font-semibold">{a.name}</span>
                  <span className="type-small text-fg-muted">
                    {a.code} · {a.garment}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {r.variants.length && !r.exact ? (
        <Card>
          <CardHeader title="SKUs" />
          <ul>
            {r.variants.map((v) => (
              <li key={v.id}>
                <Link href={`/admin/search?q=${encodeURIComponent(v.sku)}`} className={row}>
                  <span className="font-semibold">{v.sku}</span>
                  <span className="type-small text-fg-muted">
                    {v.articleName} · {v.colour} · {v.size} · <span className="tabular">{formatNumber(v.stock)}</span> pcs
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {r.leads.length ? (
        <Card>
          <CardHeader title="Leads" />
          <ul>
            {r.leads.map((l) => (
              <li key={l.id}>
                <Link href={`/admin/crm/${l.id}`} className={row}>
                  <span className="font-semibold">
                    {l.name}
                    {l.businessName ? ` · ${l.businessName}` : ""}
                  </span>
                  <span className="flex items-center gap-2 type-small text-fg-muted">
                    {formatPhone(l.phone)} <Badge tone="neutral">{stageLabel[l.stage as Stage] ?? l.stage}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {r.bills.length && !r.exact ? (
        <Card>
          <CardHeader title="Bills" />
          <ul>
            {r.bills.map((b) => (
              <li key={b.id}>
                <Link href={`/admin/bills/review/${b.id}`} className={row}>
                  <span className="font-semibold">{b.billNumber ? `Bill ${b.billNumber}` : "No number"}</span>
                  <span className="type-small text-fg-muted">
                    {b.billDate ?? ""} · {b.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
