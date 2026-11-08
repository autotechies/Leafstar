import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type BadgeTone = "success" | "warning" | "danger" | "neutral";

const tones: Record<BadgeTone, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  neutral: "bg-surface-2 text-fg-muted",
};

/** Status chip: always text + a dot, never colour alone (DESIGN.md §5). */
export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-chip shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 type-caption",
        tones[tone],
        className,
      )}
    >
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}

/** Ready-made stock/visibility badges so wording stays identical everywhere. */
export const statusBadges = {
  inStock: { tone: "success", label: "In stock" },
  lowStock: { tone: "warning", label: "Low stock" },
  outOfStock: { tone: "danger", label: "Out of stock" },
  live: { tone: "success", label: "Live" },
  hidden: { tone: "neutral", label: "Hidden" },
  overdue: { tone: "danger", label: "Overdue" },
  new: { tone: "neutral", label: "New" },
} as const satisfies Record<string, { tone: BadgeTone; label: string }>;

export function StatusBadge({ status, className }: { status: keyof typeof statusBadges; className?: string }) {
  const s = statusBadges[status];
  return (
    <Badge tone={s.tone} className={className}>
      {s.label}
    </Badge>
  );
}

/** Gold count bubble for nav items and the enquiry list (a key number, so gold is allowed). */
export function CountBadge({ count, label, className }: { count: number; label: string; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} ${label}`}
      className={cx(
        "inline-flex h-chip min-w-chip items-center justify-center rounded-full bg-gold px-2 type-caption text-on-gold tabular",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
