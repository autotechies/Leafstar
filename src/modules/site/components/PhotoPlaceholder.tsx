import { Camera } from "lucide-react";
import { cx } from "@/lib/cx";

/* A clearly labelled stand-in for a photo the owner has not supplied yet. Never imitates real photography. */

export function PhotoPlaceholder({ label, ratio = "portrait", className, rounded = true }: { label: string; ratio?: "portrait" | "landscape" | "square"; className?: string; rounded?: boolean }) {
  return (
    <div
      role="img"
      aria-label={`${label} (photo to be added)`}
      className={cx(
        "flex w-full flex-col items-center justify-center gap-2 border border-dashed border-border-strong bg-surface-2 p-4 text-center text-fg-muted",
        ratio === "portrait" ? "aspect-4/5" : ratio === "square" ? "aspect-square" : "aspect-video",
        rounded && "rounded-xl",
        className,
      )}
    >
      <Camera aria-hidden="true" className="size-icon-lg" />
      <span className="type-small font-semibold">{label}</span>
      <span className="type-caption">Photo to be added</span>
    </div>
  );
}
