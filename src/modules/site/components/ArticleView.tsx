"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Plus, Shirt, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { SizeChip, SwatchRow } from "@/components/ui/Product";
import { cx } from "@/lib/cx";
import { ImageViewer } from "@/modules/images/components/LazyImageViewer";
import { SmartImage } from "@/modules/images/components/SmartImage";
import { openChat } from "../api-client";
import { photosFor, type PublicArticle } from "../data";
import { ProductCard, useEnquiryToggle, type ContactInfo } from "./ProductCard";
import { RequestPriceModal } from "./RequestPriceModal";

/* Article page (DESIGN.md §7): gallery, details, spec table, actions, related articles. */

export function ArticleView({ article, related, contact }: { article: PublicArticle; related: PublicArticle[]; contact: ContactInfo }) {
  const [ci, setCi] = useState(0);
  const [pi, setPi] = useState(0);
  const [viewer, setViewer] = useState(false);
  const [request, setRequest] = useState(false);
  const { inList, toggle } = useEnquiryToggle(article, ci);
  const photos = photosFor(article, ci);
  const colour = article.colours[ci];
  const photo = photos[Math.min(pi, Math.max(photos.length - 1, 0))];

  const specs: Array<[string, string]> = [
    ["Type", article.garment],
    ["Brand", article.brand],
    ...(article.style ? ([["Style", article.style]] as Array<[string, string]>) : []),
    ...(article.fabric ? ([["Fabric", article.fabric]] as Array<[string, string]>) : []),
    ...(article.pattern ? ([["Pattern", article.pattern]] as Array<[string, string]>) : []),
    ["Sizes available", article.sizes.join(", ") || "Ask us"],
    ["Minimum order", `${article.moq} pieces`],
    ["Lot rule", article.lotSize ? `Sold in lots of ${article.lotSize} pieces` : `Any quantity from ${article.moq} pieces`],
  ];

  const actions = (
    <>
      <Button size="lg" fullWidth onClick={() => setRequest(true)}>Request price</Button>
      <Button size="lg" fullWidth variant="secondary" icon={<Sparkles aria-hidden="true" className="size-icon" />} onClick={() => openChat(article.code)}>Inquire with AI</Button>
      <Button size="lg" fullWidth variant="ghost" aria-pressed={inList} icon={inList ? <Check aria-hidden="true" className="size-icon" /> : <Plus aria-hidden="true" className="size-icon" />} onClick={toggle}>
        {inList ? "In your enquiry list" : "Add to enquiry list"}
      </Button>
    </>
  );

  return (
    <div className="flex flex-col gap-12 pb-24 lg:pb-0">
      <nav aria-label="Breadcrumb" className="type-small text-fg-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li><Link href="/catalog" className="rounded-sm hover:underline focus-ring">Catalog</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-fg">{article.code}</li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-3 lg:col-span-7">
          {photo ? (
            <button type="button" aria-label="View photos large" onClick={() => setViewer(true)} className="block overflow-hidden rounded-xl focus-ring">
              <SmartImage photo={photo} sizes="(min-width: 1024px) 58vw, 100vw" priority />
            </button>
          ) : (
            <div role="img" aria-label={`${article.name}: photo to be added`} className="flex aspect-4/5 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-2 text-fg-muted">
              <Shirt aria-hidden="true" className="size-icon-lg" />
              <span className="type-small font-semibold">Photo to be added</span>
            </div>
          )}
          {photos.length > 1 ? (
            <ul className="flex gap-2 overflow-x-auto" aria-label="More photos">
              {photos.map((p, i) => (
                <li key={p.id} className="w-24 shrink-0">
                  <button type="button" aria-label={`Show photo ${i + 1}`} aria-current={i === pi} onClick={() => setPi(i)} className={cx("block w-full overflow-hidden rounded-md border-2 focus-ring", i === pi ? "border-gold" : "border-transparent")}>
                    <SmartImage photo={p} sizes="96px" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5">
          <div className="lg:sticky lg:top-nav-lg lg:flex lg:flex-col lg:gap-6">
            <div className="flex flex-col gap-2">
              <p className="type-caption text-gold-text">{article.code}</p>
              <h1 className="type-h1">{article.name}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={article.availability === "low_stock" ? "lowStock" : "inStock"} />
                <span className="type-small text-fg-muted">Min. {article.moq} pcs</span>
              </div>
            </div>
            {article.description ? <p className="type-body text-fg-muted">{article.description}</p> : null}
            {article.colours.length > 0 ? (
              <div className="flex flex-col gap-1">
                <p className="type-small font-semibold">Colour: <span className="font-normal text-fg-muted">{colour?.name}</span></p>
                <SwatchRow colours={article.colours} selectedIndex={ci} onSelect={(i) => { setCi(i); setPi(0); }} max={12} />
              </div>
            ) : null}
            {article.sizes.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="type-small font-semibold">Sizes</p>
                <div className="flex flex-wrap gap-2">{article.sizes.map((s) => <SizeChip key={s} size={s} />)}</div>
              </div>
            ) : null}
            <dl className="divide-y divide-border rounded-lg border border-border">
              {specs.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-3 type-small">
                  <dt className="text-fg-muted">{k}</dt>
                  <dd className="text-right font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="hidden flex-col gap-3 lg:flex">{actions}</div>
          </div>
        </div>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="related" className="flex flex-col gap-6">
          <h2 id="related" className="type-h2">You may also like</h2>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {related.map((a) => (
              <li key={a.id}><ProductCard article={a} contact={contact} /></li>
            ))}
          </ul>
        </section>
      ) : null}

      <div id="article-bar" className="fixed inset-x-0 bottom-0 z-20 flex gap-3 border-t border-border bg-surface px-4 py-3 lg:hidden">
        <Button fullWidth onClick={() => setRequest(true)}>Request price</Button>
        <Button fullWidth variant="secondary" aria-pressed={inList} onClick={toggle}>{inList ? "In your list" : "Add to list"}</Button>
      </div>

      {viewer ? <ImageViewer photos={photos} open index={pi} onIndexChange={setPi} onClose={() => setViewer(false)} /> : null}
      <RequestPriceModal article={article} colourId={colour?.id ?? null} whatsapp={contact.whatsapp} open={request} onClose={() => setRequest(false)} />
    </div>
  );
}
