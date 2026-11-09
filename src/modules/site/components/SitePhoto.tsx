import Image from "next/image";
import { cx } from "@/lib/cx";
import { photos, type SitePhotoSlot } from "../photos";

/* One of the public-page photos. The size is fixed by the file, so the page never jumps while it loads. */

export function SitePhoto({ slot, className, sizes, priority, position = "center" }: { slot: SitePhotoSlot; className?: string; sizes: string; priority?: boolean; position?: "center" | "top" }) {
  const p = photos[slot];
  return (
    <Image
      src={p.src}
      width={p.width}
      height={p.height}
      alt={p.alt}
      sizes={sizes}
      priority={priority}
      className={cx("size-full object-cover", position === "top" ? "object-top" : "object-center", className)}
    />
  );
}
