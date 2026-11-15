"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cx } from "@/lib/cx";

/** Initial + name button; opens a small menu with Settings and Sign out. Esc and outside clicks close it. */
export function UserMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (name.trim()[0] ?? "L").toUpperCase();
  const item = "flex h-control w-full items-center gap-3 rounded-md px-3 type-small font-semibold text-fg transition-colors duration-150 hover:bg-surface-2 focus-ring";

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-control items-center gap-2 rounded-full pl-1 pr-3 transition-colors duration-150 hover:bg-surface-2 focus-ring"
      >
        <span aria-hidden="true" className="inline-flex size-control-sm items-center justify-center rounded-full border border-border-strong bg-surface-2 type-small font-bold text-fg">
          {initial}
        </span>
        <span className="hidden max-w-sidebar truncate type-small font-semibold md:inline">{name}</span>
        <ChevronDown aria-hidden="true" className={cx("size-icon-sm text-fg-muted transition-transform duration-150", open && "rotate-180")} />
        <span className="sr-only">Account menu</span>
      </button>
      {open ? (
        <div id={menuId} className="absolute right-0 top-full z-20 mt-2 w-sidebar rounded-lg border border-border bg-surface p-2 shadow-2 animate-fade-in">
          <div className="border-b border-border px-3 pb-3 pt-2">
            <p className="truncate type-small font-semibold">{name}</p>
            <p className="truncate type-small text-fg-muted">{email}</p>
          </div>
          <div className="flex flex-col gap-1 pt-2">
            <Link href="/admin/settings" onClick={() => setOpen(false)} className={item}>
              <Settings aria-hidden="true" className="size-icon" />
              Settings
            </Link>
            <button
              type="button"
              onClick={async () => {
                setOpen(false);
                try {
                  // Invalidate local client state
                  await supabaseBrowser().auth.signOut({ scope: "local" });
                } catch {
                  // Proceed to authoritative server signout regardless
                }
                // Submit POST to dedicated signout route for server and cookie destruction
                const form = document.createElement("form");
                form.method = "POST";
                form.action = "/auth/signout";
                document.body.appendChild(form);
                form.submit();
              }}
              className={item}
            >
              <LogOut aria-hidden="true" className="size-icon" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
