"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { TextInput } from "@/components/ui/Field";

/* Top-bar search: a field on tablet and up, an icon that opens the search page on a phone. */
export function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (q.trim().length >= 2) router.push(`/admin/search?q=${encodeURIComponent(q.trim())}`);
  }
  return (
    <>
      <form role="search" onSubmit={submit} className="hidden w-full md:block md:max-w-modal">
        <TextInput label="Search SKU, article, buyer or bill" hideLabel type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SKU, article, buyer, bill" prefix="" />
      </form>
      <Link href="/admin/search" aria-label="Search" className="inline-flex size-control items-center justify-center rounded-md text-fg transition-colors duration-150 hover:bg-surface-2 focus-ring md:hidden">
        <Search aria-hidden="true" className="size-icon" />
      </Link>
    </>
  );
}
