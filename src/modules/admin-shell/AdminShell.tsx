"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useNativeDialog } from "@/components/ui/Modal";
import { cx } from "@/lib/cx";
import { adminNav, isActive } from "./nav";

/*
  Admin shell (DESIGN.md §8): sidebar 248px on the chrome colour from 1024px up; below that the same
  navigation opens from a menu button as a full-height panel. Top bar 64px with the theme toggle and
  the user menu. Global search arrives with Step 11.
*/

function NavList({ inboxBadge, onNavigate }: { inboxBadge?: ReactNode; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {adminNav.map((item) => {
        const active = isActive(item, pathname);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cx(
                "relative flex h-control items-center gap-3 rounded-md px-4 type-small font-semibold transition-colors duration-150 focus-ring",
                active ? "text-gold-on-chrome" : "text-chrome-fg hover:bg-chrome-line",
              )}
            >
              {active ? <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-full bg-gold-on-chrome" /> : null}
              <Icon aria-hidden="true" className="size-icon shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.href === "/admin/inbox" ? inboxBadge : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SidebarBody({ inboxBadge, onNavigate }: { inboxBadge?: ReactNode; onNavigate?: () => void }) {
  return (
    <nav aria-label="Admin" className="flex flex-1 flex-col gap-8 overflow-y-auto px-4 py-6">
      <Link href="/admin" onClick={onNavigate} className="flex flex-col items-start gap-1 rounded-md px-2 focus-ring">
        <Logo kind="lockup" surface="chrome" />
        <span className="pl-1 type-caption text-chrome-fg">OWNER ADMIN</span>
      </Link>
      {/* The active item depends on the address, which dynamic routes only know at request time. */}
      <Suspense fallback={null}>
        <NavList inboxBadge={inboxBadge} onNavigate={onNavigate} />
      </Suspense>
    </nav>
  );
}

export function AdminShell({ children, userMenu, inboxBadge }: { children: ReactNode; userMenu: ReactNode; inboxBadge?: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { ref, onBackdropClick } = useNativeDialog(menuOpen, () => setMenuOpen(false));

  return (
    <div className="min-h-dvh bg-bg lg:flex">
      {/* Desktop sidebar */}
      {/* The chrome column runs the full page height; the navigation inside stays in view while scrolling. */}
      <aside className="hidden w-sidebar shrink-0 bg-chrome text-chrome-fg lg:block dark:border-r dark:border-chrome-line">
        <div className="sticky top-0 flex h-dvh flex-col">
          <SidebarBody inboxBadge={inboxBadge} />
        </div>
      </aside>

      {/* Phone and tablet: the same navigation in a panel */}
      <dialog
        ref={ref}
        aria-label="Admin menu"
        onClick={onBackdropClick}
        className="m-0 h-full max-h-none w-sidebar max-w-none border-0 bg-chrome p-0 text-chrome-fg animate-nav-in lg:hidden"
      >
        {menuOpen ? (
          <div className="flex h-full flex-col">
            <div className="flex justify-end px-2 pt-2">
              <button
                type="button"
                onClick={() => ref.current?.close()}
                aria-label="Close menu"
                className="inline-flex size-control items-center justify-center rounded-md text-chrome-fg transition-colors duration-150 hover:bg-chrome-line focus-ring"
              >
                <X aria-hidden="true" className="size-icon" />
              </button>
            </div>
            <SidebarBody inboxBadge={inboxBadge} onNavigate={() => ref.current?.close()} />
          </div>
        ) : null}
      </dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-topbar items-center gap-3 border-b border-border bg-bg px-4 md:px-8">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="-ml-2 inline-flex size-control items-center justify-center rounded-md text-fg transition-colors duration-150 hover:bg-surface-2 focus-ring lg:hidden"
          >
            <Menu aria-hidden="true" className="size-icon" />
          </button>
          <Link href="/admin" aria-label="Dashboard" className="rounded-md focus-ring lg:hidden">
            <Logo kind="mark" surface="auto" />
          </Link>
          <div className="flex-1" />
          <ThemeToggle />
          {userMenu}
        </header>
        <main id="main" className="mx-auto w-full max-w-admin flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
