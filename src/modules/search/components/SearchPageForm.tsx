"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";

export function SearchPageForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  function submit(e: FormEvent) {
    e.preventDefault();
    router.push(`/admin/search?q=${encodeURIComponent(q.trim())}`);
  }
  return (
    <form role="search" onSubmit={submit} className="flex items-end gap-3">
      <div className="flex-1"><TextInput label="Search" type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="SKU, article, buyer, phone or bill number" /></div>
      <Button type="submit">Search</Button>
    </form>
  );
}
