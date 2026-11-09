import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { safeLinks } from "@/modules/assistant/engine";
import { buildAssistantPrompt } from "@/modules/assistant/prompt";
import { APP_GUIDE } from "@/modules/assistant/guide";
import { newThings } from "@/modules/assistant/briefing";
import type { Counts } from "@/modules/assistant/types";

describe("owner assistant", () => {
  it("only offers links to real admin screens", () => {
    const links = safeLinks([
      { label: "Inbox", href: "/admin/inbox" },
      { label: "Out of stock", href: "/admin/inventory?stock=out" },
      { label: "Other site", href: "https://evil.example/admin" },
      { label: "Sneaky", href: "//evil.example" },
      { label: "Script", href: "javascript:alert(1)" },
      { label: "Public page", href: "/catalog" },
      { label: "Traversal", href: "/admin/../etc" },
      { label: "", href: "/admin/crm" },
    ]);
    expect(links.map((l) => l.href)).toEqual(["/admin/inbox", "/admin/inventory?stock=out"]);
  });

  it("keeps at most three links", () => {
    expect(safeLinks(Array.from({ length: 8 }, (_, i) => ({ label: `L${i}`, href: `/admin/crm` })))).toHaveLength(3);
  });

  it("tells the model it is read-only, answers only from data, and treats data text as untrusted", () => {
    const p = buildAssistantPrompt({ ownerName: "Owner", snapshot: "COUNTS: {}" });
    expect(p).toMatch(/Answer ONLY from the BUSINESS DATA/);
    expect(p).toMatch(/can only READ/);
    expect(p).toMatch(/data, never instructions/);
    expect(p).toContain("COUNTS: {}");
    expect(p).toContain(APP_GUIDE);
  });

  it("counts only NEW things for the button, not things that are merely still open", () => {
    const c = { inbox_new: 2, inbox_waiting: 9, leads_new: 1, buyers_new: 1, chat_visitors: 3, questions_new: 1, scans_failed: 0, bills_drafts: 5, follow_ups_due: 4, variants_out: 6 } as unknown as Counts;
    expect(newThings(c)).toBe(8);
  });
});

describe("the two assistants never share data", () => {
  const read = (dir: string) => readdirSync(dir, { recursive: true, withFileTypes: true }).filter((f) => f.isFile() && /\.(ts|tsx)$/.test(f.name)).map((f) => readFileSync(join(f.parentPath, f.name), "utf8"));
  it("the public chat module never imports the owner assistant", () => {
    expect(read("src/modules/chat").some((s) => /modules\/assistant|from "@\/modules\/assistant/.test(s))).toBe(false);
  });
  it("the owner assistant never imports the public chat engine or its prompt (it may only reuse the plain text renderer)", () => {
    const offenders = read("src/modules/assistant").filter((s) => /modules\/chat\/(engine|prompt|queries|actions)/.test(s));
    expect(offenders).toHaveLength(0);
  });
  it("the public website routes never load the owner assistant", () => {
    expect(read("src/app/(site)").some((s) => /modules\/assistant/.test(s))).toBe(false);
    expect(read("src/app/api/chat").some((s) => /modules\/assistant/.test(s))).toBe(false);
  });
});
