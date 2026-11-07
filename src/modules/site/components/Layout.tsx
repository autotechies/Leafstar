import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/* Page width and vertical rhythm for the storefront (DESIGN.md §4): 1280 wide; section padding 64 phone / 96 desktop. */

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mx-auto w-full max-w-page px-4 md:px-6 lg:px-8", className)}>{children}</div>;
}

export function Section({ children, className, tone = "plain", id, labelledBy }: { children: ReactNode; className?: string; tone?: "plain" | "soft" | "chrome"; id?: string; labelledBy?: string }) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cx("py-16 lg:py-24", tone === "soft" && "bg-surface-2", tone === "chrome" && "bg-chrome text-chrome-fg", className)}
    >
      <Container>{children}</Container>
    </section>
  );
}

export function SectionTitle({ eyebrow, title, id, children, onChrome }: { eyebrow?: string; title: string; id?: string; children?: ReactNode; onChrome?: boolean }) {
  return (
    <div className="mb-8 flex max-w-prose flex-col gap-2">
      {eyebrow ? <p className={cx("type-caption uppercase", onChrome ? "text-gold-on-chrome" : "text-gold-text")}>{eyebrow}</p> : null}
      <h2 id={id} className="type-h1">{title}</h2>
      {children ? <p className={cx("type-body-lg", onChrome ? "text-chrome-fg" : "text-fg-muted")}>{children}</p> : null}
    </div>
  );
}
