"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  FileText,
  MessageCircle,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  Shirt,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Banner } from "@/components/ui/Feedback";
import { Select, Textarea, TextInput } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatPhone, normalizeGstin } from "@/lib/formats";
import { formatNumber, formatRupees } from "@/lib/numbers";
import { ImageViewer } from "@/modules/images/components/LazyImageViewer";
import { SmartImage } from "@/modules/images/components/SmartImage";
import type { Photo } from "@/modules/images/types";
import { evaluateCustomerAiAction, saveBuyerAction } from "../actions";
import {
  CUSTOMER_TIERS,
  tierLabel,
  tierTone,
  type BuyerDossier,
} from "../types";

export function BuyerDossierView({ initialDossier }: { initialDossier: BuyerDossier }) {
  const router = useRouter();
  const toast = useToast();
  const [dossier, setDossier] = useState<BuyerDossier>(initialDossier);
  const [evaluating, setEvaluating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [viewer, setViewer] = useState<{ photos: Photo[]; index: number } | null>(null);

  const [form, setForm] = useState({
    name: dossier.name,
    businessName: dossier.businessName ?? "",
    email: dossier.email ?? "",
    city: dossier.city ?? "",
    gstin: dossier.gstin ?? "",
    creditLimit: dossier.creditLimit === null ? "" : String(dossier.creditLimit),
    terms: dossier.paymentTermsDays === null ? "" : String(dossier.paymentTermsDays),
    notes: dossier.notes ?? "",
    customerTier: dossier.customerTier,
    tagsText: dossier.tags.join(", "),
  });

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

  async function handleAiEvaluate() {
    setEvaluating(true);
    const r = await evaluateCustomerAiAction(dossier.id);
    setEvaluating(false);
    if (!r.ok) {
      toast.show({ kind: "error", title: r.error });
      return;
    }
    toast.show({ kind: "success", title: "AI Evaluation complete." });
    setDossier((prev) => ({
      ...prev,
      customerTier: r.tier,
      aiProfile: r.profile,
      tags: r.tags,
      lastEvaluatedAt: r.profile.analyzedAt,
    }));
    router.refresh();
  }

  async function handleSave() {
    setError(null);
    if (!validateBuyerForm()) {
      setError("Please fix the highlighted fields below.");
      return;
    }

    const credit = form.creditLimit.trim() === "" ? null : Number(form.creditLimit.replace(/[^\d.]/g, ""));
    const terms = form.terms.trim() === "" ? null : Number(form.terms.replace(/\D/g, ""));
    setBusy(true);
    const tags = form.tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const r = await saveBuyerAction({
      id: dossier.id,
      name: form.name.trim(),
      businessName: form.businessName.trim() || undefined,
      email: form.email.trim() || undefined,
      city: form.city.trim() || undefined,
      gstin: form.gstin.trim() || undefined,
      creditLimit: credit,
      paymentTermsDays: terms,
      notes: form.notes.trim() || undefined,
      customerTier: form.customerTier,
      tags,
    });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.show({ kind: "success", title: "Customer details saved." });
    setDossier((prev) => ({
      ...prev,
      name: form.name.trim(),
      businessName: form.businessName.trim() || null,
      email: form.email.trim() || null,
      city: form.city.trim() || null,
      gstin: form.gstin.trim() || null,
      creditLimit: credit,
      paymentTermsDays: terms,
      notes: form.notes.trim() || null,
      customerTier: form.customerTier,
      tags,
    }));
    setEditing(false);
    router.refresh();
  }

  const phoneDigits = dossier.phone ? dossier.phone.replace(/\D/g, "") : "";
  const waUrl = phoneDigits ? `https://wa.me/${phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits}` : null;
  const currentTier = dossier.customerTier;
  const currentTone = (tierTone[currentTier] as BadgeTone) || "neutral";

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/crm/buyers"
        className="inline-flex items-center gap-2 type-small font-semibold text-fg-muted hover:text-fg focus-ring rounded-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-icon-sm" /> All Wholesale Buyers
      </Link>

      {/* Header Profile Card */}
      <Card className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="type-h2">{dossier.name}</h1>
              <Badge tone={currentTone}>{tierLabel[currentTier]}</Badge>
              {dossier.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 type-caption text-fg-muted"
                >
                  <Tag aria-hidden="true" className="size-3" />
                  {tag}
                </span>
              ))}
            </div>
            {dossier.businessName ? (
              <p className="type-body font-medium text-fg-muted">{dossier.businessName}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-4 type-small text-fg-muted pt-1">
              {dossier.city ? <span>City: <strong className="text-fg">{dossier.city}</strong></span> : null}
              {dossier.phone ? <span>Phone: <strong className="text-fg">{formatPhone(dossier.phone)}</strong></span> : null}
              {dossier.gstin ? <span>GSTIN: <strong className="text-fg">{dossier.gstin}</strong></span> : null}
              {dossier.email ? <span>Email: <strong className="text-fg">{dossier.email}</strong></span> : null}
              {dossier.instagram ? <span>IG: <strong className="text-fg">@{dossier.instagram}</strong></span> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {waUrl ? (
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                <MessageCircle aria-hidden="true" className="size-icon-sm text-success" />
                WhatsApp
              </a>
            ) : null}
            {dossier.phone ? (
              <a
                href={`tel:${dossier.phone}`}
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                <PhoneCall aria-hidden="true" className="size-icon-sm" />
                Call
              </a>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              loading={evaluating}
              icon={<Sparkles aria-hidden="true" className="size-icon-sm text-gold-text" />}
              onClick={() => void handleAiEvaluate()}
            >
              AI Evaluate
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditing(true)}
            >
              Edit Profile
            </Button>
          </div>
        </div>
      </Card>

      {/* Snapshot KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="flex flex-col gap-1 bg-surface-2">
          <dt className="type-caption text-fg-muted">Lifetime Pieces</dt>
          <dd className="type-h3 tabular mt-1 text-gold-text">{formatNumber(dossier.totalPieces)}</dd>
          <span className="type-caption text-fg-muted">across {dossier.billCount} bills</span>
        </Card>
        <Card className="flex flex-col gap-1 bg-surface-2">
          <dt className="type-caption text-fg-muted">Total Billing Value</dt>
          <dd className="type-h3 tabular mt-1">
            {dossier.totalValue !== null ? formatRupees(dossier.totalValue) : "—"}
          </dd>
          <span className="type-caption text-fg-muted">
            {dossier.averageOrderValue ? `Avg ₹${dossier.averageOrderValue.toLocaleString("en-IN")}/bill` : "invoices applied"}
          </span>
        </Card>
        <Card className="flex flex-col gap-1 bg-surface-2">
          <dt className="type-caption text-fg-muted">Average Lot Size</dt>
          <dd className="type-h3 tabular mt-1">
            {dossier.averageLotSize ? `${formatNumber(dossier.averageLotSize)} pcs` : "—"}
          </dd>
          <span className="type-caption text-fg-muted">typical batch per order</span>
        </Card>
        <Card className="flex flex-col gap-1 bg-surface-2">
          <dt className="type-caption text-fg-muted">Credit & Terms</dt>
          <dd className="type-h3 tabular mt-1">
            {dossier.creditLimit !== null ? formatRupees(dossier.creditLimit) : "None"}
          </dd>
          <span className="type-caption text-fg-muted">
            {dossier.paymentTermsDays ? `${dossier.paymentTermsDays} days credit terms` : "Payment on delivery"}
          </span>
        </Card>
      </div>

      {/* AI Garment Intelligence Dossier */}
      <Card className="flex flex-col gap-4 border border-gold/30">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
          <div>
            <h2 className="type-h3 flex items-center gap-2">
              <Sparkles aria-hidden="true" className="size-icon-sm text-gold-text" />
              AI Customer Evaluation & Wholesale Positioning
            </h2>
            <p className="type-small text-fg-muted">
              Intelligent analysis of buyer history, cadence, preferred fabrics, and account health.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            loading={evaluating}
            icon={<RefreshCw aria-hidden="true" className="size-icon-sm" />}
            onClick={() => void handleAiEvaluate()}
          >
            Re-evaluate
          </Button>
        </div>

        {dossier.aiProfile ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-surface-2 p-4">
              <h3 className="type-caption font-semibold uppercase tracking-wider text-fg-muted">Executive Summary</h3>
              <p className="type-body text-fg mt-1.5 leading-relaxed">{dossier.aiProfile.summary}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Garment Buying DNA */}
              <div className="rounded-lg bg-surface-2 p-4 flex flex-col gap-2">
                <h3 className="type-caption font-semibold uppercase tracking-wider text-fg-muted">Garment Buying DNA</h3>
                <div className="flex flex-col gap-1.5 pt-1 type-small">
                  <div>
                    <span className="text-fg-muted">Garments: </span>
                    <strong className="text-fg">
                      {dossier.aiProfile.buyingDna.preferredGarments.length > 0
                        ? dossier.aiProfile.buyingDna.preferredGarments.join(", ")
                        : "Any"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-fg-muted">Fabrics: </span>
                    <strong className="text-fg">
                      {dossier.aiProfile.buyingDna.preferredFabrics.length > 0
                        ? dossier.aiProfile.buyingDna.preferredFabrics.join(", ")
                        : "Varied"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-fg-muted">Colors: </span>
                    <strong className="text-fg">
                      {dossier.aiProfile.buyingDna.preferredColors.length > 0
                        ? dossier.aiProfile.buyingDna.preferredColors.join(", ")
                        : "All"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-fg-muted">Sizes: </span>
                    <strong className="text-fg">
                      {dossier.aiProfile.buyingDna.preferredSizes.length > 0
                        ? dossier.aiProfile.buyingDna.preferredSizes.join(", ")
                        : "Standard full lot (S-XXL)"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Strategic Recommendation & Risk */}
              <div className="rounded-lg bg-surface-2 p-4 flex flex-col gap-2">
                <h3 className="type-caption font-semibold uppercase tracking-wider text-fg-muted">Actionable Recommendation</h3>
                <p className="type-small text-fg leading-relaxed">{dossier.aiProfile.recommendedAction}</p>

                <h4 className="type-caption font-semibold uppercase tracking-wider text-fg-muted pt-2">Risk Assessment</h4>
                <p className="type-small text-fg-muted leading-relaxed">{dossier.aiProfile.riskAssessment}</p>
              </div>
            </div>

            <p className="type-caption text-fg-muted">
              Last analyzed {new Date(dossier.aiProfile.analyzedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-surface-2 p-8 text-center">
            <Sparkles aria-hidden="true" className="size-8 text-gold-text" />
            <div>
              <h3 className="type-h4">No AI Profile Generated Yet</h3>
              <p className="type-small text-fg-muted max-w-md mx-auto mt-1">
                Run the AI evaluation to automatically analyze this customer&apos;s orders, buying cadence, and recommend the best sales approach.
              </p>
            </div>
            <Button
              loading={evaluating}
              icon={<Sparkles aria-hidden="true" className="size-icon-sm" />}
              onClick={() => void handleAiEvaluate()}
            >
              Analyze Customer Now
            </Button>
          </div>
        )}
      </Card>

      {/* Itemized Purchased Articles */}
      <Card className="flex flex-col gap-4">
        <CardHeader
          title={`Purchased Garments & Articles (${dossier.purchasedArticles.length})`}
          description="Every article code and variant this customer has bought from the factory."
        />
        {dossier.purchasedArticles.length === 0 ? (
          <p className="type-caption text-fg-muted italic rounded-md bg-surface-2 p-4">
            No confirmed bill items found for this buyer yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-subtle">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-2 type-caption text-fg-muted">
                  <th scope="col" className="py-2.5 px-3 text-left font-semibold">Photo</th>
                  <th scope="col" className="py-2.5 px-3 text-left font-semibold">Article</th>
                  <th scope="col" className="py-2.5 px-3 text-left font-semibold">Category / Fabric</th>
                  <th scope="col" className="py-2.5 px-3 text-left font-semibold">Variants Bought</th>
                  <th scope="col" className="py-2.5 px-3 text-right font-semibold">Total Pieces</th>
                  <th scope="col" className="py-2.5 px-3 text-right font-semibold">Total Value</th>
                  <th scope="col" className="py-2.5 px-3 text-right font-semibold">Last Ordered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle type-small">
                {dossier.purchasedArticles.map((a) => (
                  <tr key={a.articleId} className="hover:bg-surface-2/50">
                    <td className="py-2 px-3">
                      {a.photos && a.photos.length > 0 ? (
                        <button
                          type="button"
                          aria-label={`View photo of ${a.articleName}`}
                          onClick={() => setViewer({ photos: a.photos!, index: 0 })}
                          className="block w-12 overflow-hidden rounded-md focus-ring"
                        >
                          <SmartImage photo={a.photos[0]} sizes="48px" />
                        </button>
                      ) : (
                        <span className="flex aspect-4/5 w-12 items-center justify-center rounded-md bg-surface-2 text-fg-muted">
                          <Shirt aria-hidden="true" className="size-icon-sm" />
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <Link
                        href={`/admin/inventory/${encodeURIComponent(a.articleCode)}`}
                        className="font-semibold text-fg hover:underline focus-ring rounded-sm"
                      >
                        {a.articleCode}
                      </Link>
                      <span className="block type-caption text-fg-muted">{a.articleName}</span>
                    </td>
                    <td className="py-2.5 px-3 text-fg-muted">
                      {a.garment}{a.fabric ? ` · ${a.fabric}` : ""}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {a.variants.map((v) => (
                          <span
                            key={v.sku}
                            className="rounded-sm bg-surface-2 px-1.5 py-0.5 type-caption tabular text-fg-muted"
                          >
                            {v.color} ({v.size}): {v.qty}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular font-semibold">
                      {formatNumber(a.totalPieces)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular text-fg-muted">
                      {a.totalAmount !== null ? formatRupees(a.totalAmount) : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right text-fg-muted">
                      {a.lastBoughtAt?.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Unified Activity Timeline */}
      <Card className="flex flex-col gap-4">
        <CardHeader
          title={`Complete History & Activity Timeline (${dossier.timeline.length})`}
          description="Chronological record of invoices, inquiries, website chats, and owner notes."
        />
        {dossier.timeline.length === 0 ? (
          <p className="type-caption text-fg-muted italic rounded-md bg-surface-2 p-4">
            No activity logged yet.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border-subtle">
            {dossier.timeline.map((item) => {
              const icon =
                item.type === "bill" ? (
                  <FileText aria-hidden="true" className="size-4 text-gold-text" />
                ) : item.type === "lead" ? (
                  <Users aria-hidden="true" className="size-4 text-success" />
                ) : item.type === "chat" ? (
                  <MessageSquare aria-hidden="true" className="size-4 text-fg-muted" />
                ) : (
                  <Calendar aria-hidden="true" className="size-4 text-fg-muted" />
                );

              return (
                <div key={item.id} className="flex items-start gap-3 py-3">
                  <div className="mt-0.5 rounded-full bg-surface-2 p-2 shrink-0">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="type-small font-semibold text-fg">{item.title}</h4>
                      <time className="type-caption text-fg-muted">
                        {new Date(item.timestamp).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </time>
                    </div>
                    {item.description ? (
                      <p className="type-caption text-fg-muted mt-1 leading-relaxed">{item.description}</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Edit Customer Drawer */}
      <Drawer
        open={editing}
        onClose={() => setEditing(false)}
        title={`Edit ${dossier.name}`}
        description="Update profile, credit limits, agreed terms, and wholesale tier."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => void handleSave()}>
              Save Details
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <TextInput
            label="Name"
            required
            value={form.name}
            error={fieldErrors.name}
            onChange={(e) => updateField("name", e.target.value)}
          />
          <TextInput
            label="Business / Shop Name"
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
              placeholder="e.g. 500000"
            />
            <TextInput
              label="Payment terms (days)"
              inputMode="numeric"
              value={form.terms}
              error={fieldErrors.terms}
              onChange={(e) => updateField("terms", e.target.value)}
              placeholder="e.g. 30"
            />
          </div>
          <Select
            label="Customer Tier"
            value={form.customerTier}
            onChange={(e) => updateField("customerTier", e.target.value)}
            options={CUSTOMER_TIERS.map((tier) => ({
              value: tier,
              label: tierLabel[tier],
            }))}
          />
          <TextInput
            label="Tags (comma-separated)"
            value={form.tagsText}
            onChange={(e) => updateField("tagsText", e.target.value)}
            placeholder="festive-buyer, linen-focus, bulk-wholesaler"
          />
          <Textarea
            label="Notes"
            rows={4}
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            helper="Preferences, relationship history, staff reminders"
          />
        </div>
      </Drawer>

      {/* Shared Fullscreen Image Viewer with Smooth Zoom */}
      {viewer ? (
        <ImageViewer
          photos={viewer.photos}
          open
          index={viewer.index}
          onIndexChange={(index) => setViewer((v) => (v ? { ...v, index } : v))}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </div>
  );
}
