"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ClipboardList, Trash2 } from "lucide-react";
import { Banner, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select, TextInput } from "@/components/ui/Field";
import { enquiry, useEnquiry, useHydrated } from "../enquiryStore";
import { RequestForm } from "./RequestForm";
import type { ContactInfo } from "./ProductCard";

/* Enquiry list (AGENTS.md §7): not a cart. Several articles, ONE request. */

export function EnquiryView({ contact }: { contact: ContactInfo }) {
  const items = useEnquiry();
  const hydrated = useHydrated();
  const formId = useId();
  const [done, setDone] = useState(false);

  if (!hydrated) return <Skeleton className="h-96 w-full" rounded="lg" />;
  if (items.length === 0 && !done) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Your enquiry list is empty"
        description="Browse the catalog and tap the plus on any article. You can send everything you picked as one request."
        action={<Link href="/catalog" className={buttonClasses({ size: "lg" })}>Browse catalog</Link>}
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      {done ? null : (
        <ul className="flex flex-col gap-4 lg:col-span-7">
          {items.map((i) => {
            const qty = i.quantity ?? 0;
            return (
              <li key={i.key}>
                <Card className="flex flex-col gap-4">
                  <div className="flex gap-4">
                    {i.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.thumb} alt="" className="aspect-4/5 w-16 shrink-0 rounded-md object-cover" />
                    ) : (
                      <div aria-hidden="true" className="aspect-4/5 w-16 shrink-0 rounded-md bg-surface-2" />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <h2 className="type-h4"><Link href={`/catalog/${i.code}`} className="rounded-sm hover:underline focus-ring">{i.name}</Link></h2>
                      <p className="type-caption text-gold-text">{i.code}</p>
                      <p className="type-small text-fg-muted">Minimum order {i.moq} pieces</p>
                    </div>
                    <Button variant="ghost" iconOnly aria-label={`Remove ${i.name}`} icon={<Trash2 aria-hidden="true" className="size-icon" />} onClick={() => enquiry.remove(i.key)} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {i.colours.length > 0 ? (
                      <Select
                        label="Colour"
                        placeholder="Any colour"
                        value={i.colourId ?? ""}
                        options={i.colours.map((c) => ({ value: c.id, label: c.name }))}
                        onChange={(e) => enquiry.update(i.key, { colourId: e.target.value || null })}
                      />
                    ) : null}
                    <TextInput
                      label="Pieces needed"
                      inputMode="numeric"
                      value={i.quantity ? String(i.quantity) : ""}
                      placeholder={String(i.moq)}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/\D/g, ""));
                        enquiry.update(i.key, { quantity: n > 0 ? Math.min(n, 1_000_000) : null });
                      }}
                    />
                  </div>
                  {qty > 0 && qty < i.moq ? <Banner tone="warning">Our minimum for this article is {i.moq} pieces. You can still send it and we will tell you what is possible.</Banner> : null}
                </Card>
              </li>
            );
          })}
          </ul>
      )}
      <div className={done ? "lg:col-span-12" : "lg:col-span-5"}>
        <Card className="lg:sticky lg:top-nav-lg">
          {done ? null : (
            <div className="mb-4 flex flex-col gap-1">
              <h2 className="type-h3">Send one request</h2>
              <p className="type-small text-fg-muted">We will reply with our price for everything on your list.</p>
            </div>
          )}
          <RequestForm
            formId={formId}
            endpoint="/api/enquiry"
            whatsapp={contact.whatsapp}
            onSent={() => {
              setDone(true);
              enquiry.clear();
            }}
            targets={items.map((i) => ({ articleId: i.articleId, colourId: i.colourId, quantity: i.quantity, code: i.code, name: i.name, moq: i.moq }))}
          />
        </Card>
      </div>
    </div>
  );
}
