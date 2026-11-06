"use client";

import { useState, type CSSProperties } from "react";
import { ImageOff } from "lucide-react";
import { cx } from "@/lib/cx";
import type { Photo } from "../types";

/*
  How every photo is shown (AGENTS.md §4): space is reserved from the stored width and height (nothing jumps),
  a tiny blurred copy appears instantly, and the real photo fades in when it has loaded.
  The browser picks thumb / medium / large from `sizes`, so a list never downloads the large master.
*/

export interface SmartImageProps {
  photo: Photo;
  /** CSS `sizes` hint, e.g. "(min-width: 1024px) 25vw, 50vw". */
  sizes: string;
  /** Above-the-fold photos load at once; the rest load as they near the screen. */
  priority?: boolean;
  /** "cover" fills a fixed frame (cards); "natural" keeps the photo's own shape. */
  fit?: "cover" | "natural";
  /** Fixed frame shape for fit="cover"; the 4:5 portrait is the catalog standard. */
  frame?: "portrait" | "square";
  className?: string;
}

export function SmartImage({ photo, sizes, priority = false, fit = "cover", frame = "portrait", className }: SmartImageProps) {
  // Remember WHICH address loaded or failed, so changing the photo starts fresh without any effect.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const loaded = loadedUrl === photo.mediumUrl;
  const failed = failedUrl === photo.mediumUrl;

  const frameClass = fit === "cover" ? (frame === "square" ? "aspect-square" : "aspect-4/5") : undefined;
  // The photo's own proportions are data from the database, not a design value.
  const naturalStyle: CSSProperties | undefined = fit === "natural" ? { aspectRatio: `${photo.width} / ${photo.height}` } : undefined;
  // The blurred placeholder is the photo's own data.
  const blurStyle: CSSProperties | undefined = photo.blurDataUrl ? { backgroundImage: `url(${photo.blurDataUrl})` } : undefined;

  return (
    <div
      className={cx("relative w-full overflow-hidden bg-surface-2 bg-cover bg-center", frameClass, className)}
      // Photo shape and placeholder are the stored photo's own data, not design values.
      style={{ ...naturalStyle, ...blurStyle }}
    >
      {failed ? (
        <div role="img" aria-label={photo.alt} className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-fg-muted">
          <ImageOff aria-hidden="true" className="size-icon-lg" />
          <span className="type-small">Photo unavailable</span>
        </div>
      ) : (
        // A plain <img>: the files are already resized WebP, so Next's optimizer would only add a round trip.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={(el) => {
            // A cached photo can finish loading before React attaches onLoad.
            if (el?.complete && el.naturalWidth > 0) setLoadedUrl(photo.mediumUrl);
          }}
          src={photo.mediumUrl}
          srcSet={`${photo.thumbUrl} 320w, ${photo.mediumUrl} 800w, ${photo.url} 2000w`}
          sizes={sizes}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          draggable={false}
          onLoad={() => setLoadedUrl(photo.mediumUrl)}
          onError={() => setFailedUrl(photo.mediumUrl)}
          className={cx(
            "size-full transition-opacity duration-300 ease-out",
            fit === "cover" ? "object-cover" : "object-contain",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );
}
