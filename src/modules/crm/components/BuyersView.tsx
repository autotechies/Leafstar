"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Banner, EmptyState } from "@/components/ui/Feedback";
import { Textarea, TextInput } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatPhone } from "@/lib/formats";
import { formatNumber, formatRupees } from "@/lib/numbers";
import { saveBuyerAction } from "../actions";
import type { BuyerRow } from "../types";

/* Buyers directory (AGENTS.md §13): who buys, how much, when last, and the terms you agreed. Money columns appear only when bills carry a total. */
export function BuyersView({ buyers }: { buyers: BuyerRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<BuyerRow | null>(null);
  const [form, setForm] = useState({ name: "", businessName: "", email: "", city: "", gstin: "", creditLimit: "", terms: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? buyers.filter((b) => [b.name, b.businessName, b.phone, b.city].some((v) => v?.toLowerCase().includes(q))) : buyers;
  }, [buyers, query]);

  function edit(b: BuyerRow) {
    setOpen(b);
    setError(null);
    setForm({ name: b.name, businessName: b.businessName ?? "", email: b.email ?? "", city: b.city ?? "", gstin: b.gstin ?? "", creditLimit: b.creditLimit === null ? "" : String(b.creditLimit), terms: b.paymentTermsDays === null ? "" : String(b.paymentTermsDays), notes: b.notes ?? "" });
  }

  async function save() {
    if (!open) return;
    const credit = form.creditLimit.trim() === "" ? null : Number(form.creditLimit.replace(/[^\d.]/g, ""));
    const terms = form.terms.trim() === "" ? null : Number(form.terms.replace(/\D/g, ""));
    if ((credit !== null && !Number.isFinite(credit)) || (terms !== null && !Number.isFinite(terms))) return setError("Enter the credit limit and days as numbers.");
    setBusy(true);
    setError(null);
    const r = await saveBuyerAction({ id: open.id, name: form.name, businessName: form.businessName, email: form.email, city: form.city, gstin: form.gstin, creditLimit: credit, paymentTermsDays: terms, notes: form.notes });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.show({ kind: "success", title: "Buyer saved." });
    setOpen(null);
    router.refresh();
  }

  const showValue = buyers.some((b) => b.totalValue !== null);
  const columns: Column<BuyerRow>[] = [
    { key: "name", header: "Buyer", primary: true, render: (b) => (<button type="button" onClick={() => edit(b)} className="rounded-sm text-left font-semibold hover:underline focus-ring">{b.name}{b.businessName ? <span className="block type-caption font-normal text-fg-muted">{b.businessName}</span> : null}</button>) },
    { key: "phone", header: "Phone", hideOnPhone: true, render: (b) => (b.phone ? formatPhone(b.phone) : "") },
    { key: "city", header: "City", hideOnPhone: true, render: (b) => b.city ?? "" },
    { key: "pieces", header: "Pieces bought", align: "right", render: (b) => formatNumber(b.totalPieces) },
    ...(showValue ? [{ key: "value", header: "Value", align: "right" as const, render: (b: BuyerRow) => (b.totalValue === null ? "" : formatRupees(b.totalValue)) }] : []),
    { key: "last", header: "Last purchase", render: (b) => b.lastPurchase?.slice(0, 10) ?? "No bills yet" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full md:max-w-sm"><TextInput label="Search buyers" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, shop, phone or city" /></div>
        <Link href="/admin/crm" className={buttonClasses({ variant: "secondary" })}>Back to leads</Link>
      </div>
      <Card padding="none">
        <DataTable columns={columns} rows={shown} rowKey={(b) => b.id} caption="Buyers" empty={<EmptyState icon={Users} title={query ? "No buyer matches" : "No buyers yet"} description={query ? "Try a different name or phone." : "When you mark a lead as Won, or apply a bill for a new name, the buyer appears here."} />} />
      </Card>

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.name ?? "Buyer"}
        description={open?.phone ? formatPhone(open.phone) : undefined}
        footer={<><Button variant="secondary" onClick={() => setOpen(null)}>Close</Button><Button loading={busy} onClick={() => void save()}>Save buyer</Button></>}
      >
        {open ? (
          <div className="flex flex-col gap-6">
            {error ? <Banner tone="danger">{error}</Banner> : null}
            <dl className="grid grid-cols-2 gap-4 rounded-lg bg-surface-2 p-4">
              <div><dt className="type-caption text-fg-muted">Pieces bought</dt><dd className="type-h4 tabular">{formatNumber(open.totalPieces)}</dd></div>
              <div><dt className="type-caption text-fg-muted">Bills</dt><dd className="type-h4 tabular">{open.billCount}</dd></div>
              {open.totalValue !== null ? <div><dt className="type-caption text-fg-muted">Value</dt><dd className="type-h4 tabular">{formatRupees(open.totalValue)}</dd></div> : null}
              <div><dt className="type-caption text-fg-muted">Last purchase</dt><dd className="type-small">{open.lastPurchase?.slice(0, 10) ?? "None yet"}</dd></div>
            </dl>
            <div className="flex flex-col gap-4">
              <TextInput label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <TextInput label="Business name" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <TextInput label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <TextInput label="GSTIN" value={form.gstin} maxLength={20} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} helper="15 characters, like 24ABCDE1234F1Z5" />
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput label="Credit limit (₹)" inputMode="decimal" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} />
                <TextInput label="Payment terms (days)" inputMode="numeric" value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />
              </div>
              <Textarea label="Notes" rows={3} value={form.notes} maxLength={1000} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <section aria-label="Bill history" className="flex flex-col gap-2">
              <h3 className="type-h4">Bill history</h3>
              {open.bills.length === 0 ? <p className="type-small text-fg-muted">No applied bills for this buyer yet.</p> : (
                <ul className="flex flex-col gap-2">
                  {open.bills.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 type-small">
                      <Link href={`/admin/bills/review/${b.id}`} className="rounded-sm font-semibold hover:underline focus-ring">{b.billNumber ? `No. ${b.billNumber}` : "No number"}</Link>
                      <span className="text-fg-muted">{b.billDate ?? ""}</span>
                      <span className="tabular">{formatNumber(b.pieces)} pcs{b.amount !== null ? ` · ${formatRupees(b.amount)}` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
