"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Menu } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Drawer } from "@/components/ui/Modal";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cx } from "@/lib/cx";
import { nav } from "../content";
import { useEnquiry } from "../enquiryStore";
import { CallButton } from "./CallButton";

/* Navbar (DESIGN.md §7): 72 desktop / 64 phone on the chrome colour, sticky. */

function NavLinks({ onNavigate, stacked }: { onNavigate?: () => void; stacked?: boolean }) {
  const pathname = usePathname();
  return <LinkList active={pathname} onNavigate={onNavigate} stacked={stacked} />;
}

function LinkList({ active, onNavigate, stacked }: { active: string | null; onNavigate?: () => void; stacked?: boolean }) {
  return (
    <ul className={cx("flex", stacked ? "flex-col gap-1" : "items-center gap-2")}>
      {nav.map((item) => {
        const current = active !== null && (item.href === "/" ? active === "/" : active.startsWith(item.href));
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={current ? "page" : undefined}
              className={cx(
                "inline-flex h-control items-center rounded-md px-3 type-small font-bold focus-ring",
                stacked && "w-full type-body",
                current ? "text-gold-on-chrome" : "text-chrome-fg hover:bg-chrome-line",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function EnquiryLink() {
  const count = useEnquiry().length;
  return (
    <Link href="/enquiry" aria-label={count ? `Enquiry list, ${count} ${count === 1 ? "article" : "articles"}` : "Enquiry list, empty"} className="relative inline-flex size-control shrink-0 items-center justify-center rounded-full text-chrome-fg hover:bg-chrome-line focus-ring">
      <ClipboardList aria-hidden="true" className="size-icon" />
      {count > 0 ? (
        <span aria-hidden="true" className="absolute -right-1 -top-1 inline-flex min-w-6 items-center justify-center rounded-full bg-gold px-1 type-caption text-on-gold tabular">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

export function SiteHeader({ phone }: { phone: string | null }) {
  const [menu, setMenu] = useState(false);
  return (
    <header className="sticky top-0 z-20 border-b border-chrome-line bg-chrome text-chrome-fg">
      <div className="mx-auto flex h-nav w-full max-w-page items-center justify-between gap-4 px-4 md:px-6 lg:h-nav-lg lg:px-8">
        <Link href="/" aria-label="Leaf Star home" className="rounded-md focus-ring">
          <Logo kind="lockup" surface="chrome" priority />
        </Link>
        <nav aria-label="Main" className="hidden lg:block">
          <Suspense fallback={<LinkList active={null} />}>
            <NavLinks />
          </Suspense>
        </nav>
        <div className="flex items-center gap-1 md:gap-2">
          <div className="hidden lg:block">
            <CallButton phone={phone} variant="header" />
          </div>
          <div className="lg:hidden">
            <CallButton phone={phone} variant="icon" />
          </div>
          <EnquiryLink />
          <div className="hidden lg:block">
            <ThemeToggle onChrome />
          </div>
          <button type="button" aria-label="Open menu" onClick={() => setMenu(true)} className="inline-flex size-control shrink-0 items-center justify-center rounded-full text-chrome-fg hover:bg-chrome-line focus-ring lg:hidden">
            <Menu aria-hidden="true" className="size-icon-lg" />
          </button>
        </div>
      </div>
      <Drawer open={menu} onClose={() => setMenu(false)} title="Menu">
        <div className="flex flex-col gap-6">
          <nav aria-label="Menu">
            <Suspense fallback={<LinkList active={null} stacked />}>
              <NavLinks stacked onNavigate={() => setMenu(false)} />
            </Suspense>
          </nav>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="type-small font-semibold">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </Drawer>
    </header>
  );
}
