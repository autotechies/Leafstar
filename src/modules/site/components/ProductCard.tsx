"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Plus, Shirt, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { SizeChip, SwatchRow } from "@/components/ui/Product";
import { useToast } from "@/components/ui/Toast";
import { cx } from "@/lib/cx";
import { ImageViewer } from "@/modules/images/components/LazyImageViewer";
import { SmartImage } from "@/modules/images/components/SmartImage";
import { openChat } from "../api-client";
import { photosFor, type PublicArticle } from "../data";
import { enquiry, useEnquiry } from "../enquiryStore";
import { RequestPriceModal } from "./RequestPriceModal";

export interface ContactInfo {
  phone: string | null;
  whatsapp: string | null;
}

/* One card per article (AGENTS.md §7). The photo follows the selected colour swatch. No price, no exact stock. */

export function useEnquiryToggle(article: PublicArticle, colourIndex: number) {
  const toast = useToast();
  const inList = useEnquiry().some((i) => i.articleId === article.id);
  const colour = article.colours[colourIndex];
  const toggle = () => {
    if (inList) {
      enquiry.removeArticle(article.id);
      toast.show({ kind: "info", title: "Removed from your enquiry list" });
      return;
    }
    enquiry.add({
      articleId: article.id,
      code: article.code,
      name: article.name,
      colourId: colour?.id ?? null,
      colours: article.colours.map((c) => ({ id: c.id, name: c.name, hex: c.hex })),
      moq: article.moq,
      thumb: photosFor(article, colourIndex)[0]?.thumbUrl ?? null,
    });
    toast.show({ kind: "success", title: "Added to your enquiry list" });
  };
  return { inList, toggle };
}

export function ProductCard({ article, contact, priority = false }: { article: PublicArticle; contact: ContactInfo; priority?: boolean }) {
  const [ci, setCi] = useState(0);
  const [viewer, setViewer] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [request, setRequest] = useState(false);
  const { inList, toggle } = useEnquiryToggle(article, ci);
  const photos = photosFor(article, ci);
  const colour = article.colours[ci];

  // The first photo of every colour is fetched ahead, so tapping a swatch changes the picture at once.
  useEffect(() => {
    for (const c of article.colours) {
      const first = c.photos[0];
      if (first) new Image().src = first.mediumUrl;
    }
  }, [article.colours]);

  return (
    <article className="card-surface flex h-full flex-col overflow-hidden">
      <div className="relative">
        {photos.length > 0 ? (
          <button type="button" aria-label={`View photos of ${article.name}${colour ? ` in ${colour.name}` : ""}`} onClick={() => { setViewerIndex(0); setViewer(true); }} className="block w-full focus-ring">
            <SmartImage photo={photos[0]} sizes="(min-width: 1440px) 25vw, (min-width: 768px) 33vw, 50vw" priority={priority} />
          </button>
        ) : (
          <div role="img" aria-label={`${article.name}: photo to be added`} className="flex aspect-4/5 w-full flex-col items-center justify-center gap-2 bg-surface-2 text-fg-muted">
            <Shirt aria-hidden="true" className="size-icon-lg" />
            <span className="type-caption">Photo to be added</span>
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-pressed={inList}
          aria-label={inList ? `Remove ${article.name} from enquiry list` : `Add ${article.name} to enquiry list`}
          className={cx("absolute right-2 top-2 inline-flex size-control items-center justify-center rounded-full shadow-1 focus-ring", inList ? "bg-gold text-on-gold" : "bg-surface text-fg hover:bg-surface-2")}
        >
          {inList ? <Check aria-hidden="true" className="size-icon" /> : <Plus aria-hidden="true" className="size-icon" />}
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3 md:p-4">
        {article.colours.length > 0 ? <SwatchRow colours={article.colours} selectedIndex={ci} onSelect={setCi} max={8} size="sm" /> : null}
        <div className="flex flex-col gap-1">
          <h3 className="type-h4">
            <Link href={`/catalog/${article.code}`} className="rounded-sm hover:underline focus-ring">{article.name}</Link>
          </h3>
          <p className="type-caption text-gold-text">{article.code}</p>
          <p className="type-small text-fg-muted">{article.brand}</p>
        </div>
        {article.fabric || article.pattern ? (
          <ul className="flex flex-wrap gap-1">
            {[article.fabric, article.pattern].filter(Boolean).map((chip) => (
              <li key={chip} className="rounded-sm bg-surface-2 px-2 type-caption text-fg-muted">{chip}</li>
            ))}
          </ul>
        ) : null}
        {article.sizes.length > 0 ? (
          <div className="flex flex-wrap gap-1" aria-label="Sizes available">
            {article.sizes.map((s) => (
              <SizeChip key={s} size={s} />
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={article.availability === "low_stock" ? "lowStock" : "inStock"} />
          <span className="type-small text-fg-muted">Min. {article.moq} pcs</span>
        </div>
        <div className="mt-auto flex flex-col gap-2 pt-1">
          <Button fullWidth onClick={() => setRequest(true)}>Request price</Button>
          <Button fullWidth variant="secondary" icon={<Sparkles aria-hidden="true" className="size-icon-sm" />} onClick={() => openChat(article.code)}>Inquire with AI</Button>
        </div>
      </div>
      {viewer ? <ImageViewer photos={photos} open index={viewerIndex} onIndexChange={setViewerIndex} onClose={() => setViewer(false)} /> : null}
      <RequestPriceModal article={article} colourId={colour?.id ?? null} whatsapp={contact.whatsapp} open={request} onClose={() => setRequest(false)} />
    </article>
  );
}
