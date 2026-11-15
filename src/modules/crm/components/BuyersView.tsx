"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit2, Upload, Users } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Banner, EmptyState } from "@/components/ui/Feedback";
import { Textarea, TextInput } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatPhone, normalizeGstin } from "@/lib/formats";
import { formatNumber, formatRupees } from "@/lib/numbers";
import { saveBuyerAction } from "../actions";
import { BuyerImportModal } from "./BuyerImportModal";
import {
  CUSTOMER_TIERS,
  tierLabel,
  tierTone,
  type BuyerRow,
} from "../types";

export function BuyersView({ buyers }: { buyers: BuyerRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [open, setOpen] = useState<BuyerRow | null>(null);
  const [form, setForm] = useState({ name: "", businessName: "", email: "", city: "", gstin: "", creditLimit: "", terms: "", notes: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => {
    let list = buyers;
    if (selectedTier !== "all") {
      list = list.filter((b) => b.customerTier === selectedTier);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((b) => [b.name, b.businessName, b.phone, b.city].some((v) => v?.toLowerCase().includes(q)));
    }
    return list;
  }, [buyers, query, selectedTier]);

  function updateField(key: string, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  }

  function validateBuyerForm(): boolean {
    const errs: Record<string, string> = {};
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      errs.name = "Buyer name is required.";
    } else if (trimmedName.length > 100) {
      errs.name = "Name must be 100 characters or fewer.";
    }

    if (form.businessName.trim().length > 120) {
      errs.businessName = "Business name must be 120 characters or fewer.";
    }

    if (form.email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        errs.email = "Enter a valid email address (e.g. buyer@example.com).";
      }
    }

    if (form.city.trim().length > 80) {
      errs.city = "City must be 80 characters or fewer.";
    }

    if (form.gstin.trim()) {
      if (!normalizeGstin(form.gstin.trim())) {
        errs.gstin = "Enter a valid 15-character GSTIN (e.g. 24ABCDE1234F1Z5).";
      }
    }

    if (form.creditLimit.trim()) {
      const credit = Number(form.creditLimit.replace(/[^\d.]/g, ""));
      if (!Number.isFinite(credit) || credit < 0) {
        errs.creditLimit = "Credit limit must be a positive number.";
      } else if (credit > 1_000_000_000) {
        errs.creditLimit = "Credit limit cannot exceed ₹1,000,000,000.";
      }
    }

    if (form.terms.trim()) {
      const terms = Number(form.terms.replace(/\D/g, ""));
      if (!Number.isFinite(terms) || terms < 0 || terms > 365) {
        errs.terms = "Payment terms must be between 0 and 365 days.";
      }
    }

    if (form.notes.trim().length > 1000) {
      errs.notes = "Notes must be 1000 characters or fewer.";
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function edit(b: BuyerRow) {
    setOpen(b);
    setError(null);
    setFieldErrors({});
    setForm({ name: b.name, businessName: b.businessName ?? "", email: b.email ?? "", city: b.city ?? "", gstin: b.gstin ?? "", creditLimit: b.creditLimit === null ? "" : String(b.creditLimit), terms: b.paymentTermsDays === null ? "" : String(b.paymentTermsDays), notes: b.notes ?? "" });
  }

  async function save() {
    if (!open) return;
    setError(null);
    if (!validateBuyerForm()) {
      setError("Please fix the highlighted fields below.");
      return;
    }
    const credit = form.creditLimit.trim() === "" ? null : Number(form.creditLimit.replace(/[^\d.]/g, ""));
    const terms = form.terms.trim() === "" ? null : Number(form.terms.replace(/\D/g, ""));
    setBusy(true);
    const r = await saveBuyerAction({ id: open.id, name: form.name.trim(), businessName: form.businessName.trim() || undefined, email: form.email.trim() || undefined, city: form.city.trim() || undefined, gstin: form.gstin.trim() || undefined, creditLimit: credit, paymentTermsDays: terms, notes: form.notes.trim() || undefined });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.show({ kind: "success", title: "Buyer saved." });
    setOpen(null);
    router.refresh();
  }

  const showValue = buyers.some((b) => b.totalValue !== null);

  const columns: Column<BuyerRow>[] = [
    {
      key: "name",
      header: "Buyer / Business",
      primary: true,
      render: (b) => {
        const tone = (tierTone[b.customerTier] as BadgeTone) || "neutral";
        return (
          <div className="flex flex-col gap-1 items-start">
            <Link
              href={`/admin/crm/buyers/${b.id}`}
              className="rounded-sm text-left font-semibold hover:underline focus-ring text-fg"
            >
              {b.name}
            </Link>
            {b.businessName ? <span className="type-caption text-fg-muted">{b.businessName}</span> : null}
            <div className="pt-0.5">
              <Badge tone={tone}>{tierLabel[b.customerTier]}</Badge>
            </div>
          </div>
        );
      },
    },
    { key: "phone", header: "Phone", hideOnPhone: true, render: (b) => (b.phone ? formatPhone(b.phone) : "") },
    { key: "city", header: "City", hideOnPhone: true, render: (b) => b.city ?? "—" },
    { key: "pieces", header: "Pieces bought", align: "right", render: (b) => formatNumber(b.totalPieces) },
    ...(showValue ? [{ key: "value", header: "Value", align: "right" as const, render: (b: BuyerRow) => (b.totalValue === null ? "—" : formatRupees(b.totalValue)) }] : []),
    { key: "last", header: "Last purchase", render: (b) => b.lastPurchase?.slice(0, 10) ?? "No bills yet" },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (b) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/admin/crm/buyers/${b.id}`}
            className={buttonClasses({ variant: "ghost", size: "sm" })}
          >
            Dossier
          </Link>
          <Button
            variant="ghost"
            size="sm"
            icon={<Edit2 aria-hidden="true" className="size-3.5" />}
            onClick={() => edit(b)}
            aria-label={`Edit ${b.name}`}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full md:max-w-sm">
          <TextInput
            label="Search buyers"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, shop, phone or city"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            icon={<Upload aria-hidden="true" className="size-icon-sm" />}
            onClick={() => setImportOpen(true)}
          >
            Import Customers
          </Button>
          <Link href="/admin/crm" className={buttonClasses({ variant: "secondary" })}>
            Back to leads
          </Link>
        </div>
      </div>

      {/* Tier Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-border-subtle pb-3">
        <button
          type="button"
          onClick={() => setSelectedTier("all")}
          className={`rounded-full px-3 py-1 type-caption font-medium transition-colors ${
            selectedTier === "all"
              ? "bg-chrome text-chrome-text"
              : "bg-surface-2 text-fg-muted hover:text-fg"
          }`}
        >
          All ({buyers.length})
        </button>
        {CUSTOMER_TIERS.map((tier) => {
          const count = buyers.filter((b) => b.customerTier === tier).length;
          return (
            <button
              key={tier}
              type="button"
              onClick={() => setSelectedTier(tier)}
              className={`rounded-full px-3 py-1 type-caption font-medium transition-colors ${
                selectedTier === tier
                  ? "bg-chrome text-chrome-text"
                  : "bg-surface-2 text-fg-muted hover:text-fg"
              }`}
            >
              {tierLabel[tier]} ({count})
            </button>
          );
        })}
      </div>

      <Card padding="none">
        <DataTable
          columns={columns}
          rows={shown}
          rowKey={(b) => b.id}
          caption="Buyers"
          empty={
            <EmptyState
              icon={Users}
              title={query || selectedTier !== "all" ? "No buyer matches" : "No buyers yet"}
              description={
                query || selectedTier !== "all"
                  ? "Try a different search or filter tab."
                  : "When you mark a lead as Won, or apply a bill for a new name, the buyer appears here."
              }
            />
          }
        />
      </Card>

      <BuyerImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => router.refresh()}
      />

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.name ?? "Buyer"}
        description={open?.phone ? formatPhone(open.phone) : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Close
            </Button>
            <Button loading={busy} onClick={() => void save()}>
              Save buyer
            </Button>
          </>
        }
      >
        {open ? (
          <div className="flex flex-col gap-6">
            {error ? <Banner tone="danger">{error}</Banner> : null}
            <dl className="grid grid-cols-2 gap-4 rounded-lg bg-surface-2 p-4">
              <div>
                <dt className="type-caption text-fg-muted">Pieces bought</dt>
                <dd className="type-h4 tabular">{formatNumber(open.totalPieces)}</dd>
              </div>
              <div>
                <dt className="type-caption text-fg-muted">Bills</dt>
                <dd className="type-h4 tabular">{open.billCount}</dd>
              </div>
              {open.totalValue !== null ? (
                <div>
                  <dt className="type-caption text-fg-muted">Value</dt>
                  <dd className="type-h4 tabular">{formatRupees(open.totalValue)}</dd>
                </div>
              ) : null}
              <div>
                <dt className="type-caption text-fg-muted">Last purchase</dt>
                <dd className="type-small">{open.lastPurchase?.slice(0, 10) ?? "None yet"}</dd>
              </div>
            </dl>
            <div className="flex flex-col gap-4">
              <TextInput
                label="Name"
                required
                value={form.name}
                error={fieldErrors.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
              <TextInput
                label="Business name"
                value={form.businessName}
                error={fieldErrors.businessName}
                onChange={(e) => updateField("businessName", e.target.value)}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Email"
                  type="email"
                  value={form.email}
                  error={fieldErrors.email}
                  onChange={(e) => updateField("email", e.target.value)}
                />
                <TextInput
                  label="City"
                  value={form.city}
                  error={fieldErrors.city}
                  onChange={(e) => updateField("city", e.target.value)}
                />
              </div>
              <TextInput
                label="GSTIN"
                value={form.gstin}
                maxLength={20}
                error={fieldErrors.gstin}
                onChange={(e) => updateField("gstin", e.target.value.toUpperCase())}
                helper="15 characters, like 24ABCDE1234F1Z5"
              />
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Credit limit (₹)"
                  inputMode="decimal"
                  value={form.creditLimit}
                  error={fieldErrors.creditLimit}
                  onChange={(e) => updateField("creditLimit", e.target.value)}
                />
                <TextInput
                  label="Payment terms (days)"
                  inputMode="numeric"
                  value={form.terms}
                  error={fieldErrors.terms}
                  onChange={(e) => updateField("terms", e.target.value)}
                />
              </div>
              <Textarea
                label="Notes"
                rows={3}
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
