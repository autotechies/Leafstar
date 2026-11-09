"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Banner, Skeleton } from "@/components/ui/Feedback";
import { TextInput } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Modal";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { cx } from "@/lib/cx";
import { ChatText } from "@/modules/chat/components/ChatText";
import { askAssistantAction, loadBriefingAction, markSeenAction } from "../actions";
import type { AssistantLink, AssistantTurn, Briefing } from "../types";

/*
  The owner's assistant (admin only). Tab 1 "Since last visit": what changed in every section, counted, no AI.
  Tab 2 "Ask": questions answered from the live business data. Nothing typed here is stored. It is a different assistant
  from the website one and never shares its data.
*/

const STARTERS = ["What needs my attention?", "Who haven't I replied to?", "Which articles are low on stock?", "How do I split an assorted bill?"];

interface Msg { id: string; role: "user" | "assistant"; text: string; links?: AssistantLink[]; quick?: string[] }

export function AssistantLauncher({ newCount }: { newCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(newCount > 0 ? "since" : "ask");
  const [cleared, setCleared] = useState(false);
  const count = cleared ? 0 : newCount;
  const [briefing, setBriefing] = useState<{ data: Briefing; sinceText: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, busy]);

  const loadBriefing = useCallback(async () => {
    setLoadError(null);
    const r = await loadBriefingAction();
    if (!r.ok) return setLoadError(r.error);
    setBriefing({ data: r.briefing, sinceText: r.sinceText });
  }, []);

  function openPanel() {
    setOpen(true);
    setBriefing(null);
    void loadBriefing();
  }

  async function markSeen() {
    setMarking(true);
    const r = await markSeenAction();
    setMarking(false);
    if (!r.ok) return setLoadError(r.error);
    setCleared(true);
    setBriefing(null);
    void loadBriefing();
    router.refresh();
  }

  const ask = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      const history: AssistantTurn[] = messages.map((m) => ({ role: m.role, text: m.text }));
      setMessages((cur) => [...cur, { id: crypto.randomUUID(), role: "user", text: q }]);
      setDraft("");
      setBusy(true);
      const r = await askAssistantAction({ message: q, history });
      setBusy(false);
      setMessages((cur) => [
        ...cur,
        r.ok
          ? { id: crypto.randomUUID(), role: "assistant", text: r.answer.reply, links: r.answer.links, quick: r.answer.quickReplies }
          : { id: crypto.randomUUID(), role: "assistant", text: r.error },
      ]);
    },
    [busy, messages],
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    void ask(draft);
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-label={count > 0 ? `Open the assistant, ${count} new` : "Open the assistant"}
        className="fixed bottom-4 right-4 z-20 inline-flex size-fab items-center justify-center rounded-full bg-gold text-on-gold shadow-2 focus-ring lg:bottom-6 lg:right-6"
      >
        <Sparkles aria-hidden="true" className="size-icon" />
        {count > 0 ? (
          <span aria-hidden="true" className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1 type-caption font-bold text-on-danger tabular">{count > 99 ? "99+" : count}</span>
        ) : null}
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Leaf Star assistant"
        description="What changed, and answers about your business"
        footer={
          tab === "ask" ? (
            <form onSubmit={submit} className="flex w-full items-end gap-2">
              <div className="flex-1">
                <TextInput label="Ask about your business" hideLabel placeholder="Ask about leads, stock, bills…" value={draft} maxLength={600} onChange={(e) => setDraft(e.target.value)} />
              </div>
              <Button type="submit" iconOnly aria-label="Send question" loading={busy} disabled={!draft.trim()} icon={<Send aria-hidden="true" className="size-icon" />} />
            </form>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-4">
          <Tabs label="Assistant" value={tab} onChange={setTab} items={[{ id: "since", label: "Since last visit", count: count || undefined }, { id: "ask", label: "Ask" }]} />

          {tab === "since" ? (
            <TabPanel className="flex flex-col gap-4">
              {loadError ? <Banner tone="danger">{loadError}</Banner> : null}
              {!briefing && !loadError ? (
                <div className="flex flex-col gap-3" role="status" aria-label="Loading"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-24 w-full" rounded="lg" /><Skeleton className="h-24 w-full" rounded="lg" /></div>
              ) : null}
              {briefing ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="type-small text-fg-muted">{briefing.data.firstTime ? "First time here: showing the last 7 days." : <>Since <strong className="text-fg">{briefing.sinceText}</strong></>}</p>
                    <Button size="sm" variant="secondary" loading={marking} icon={<CheckCheck aria-hidden="true" className="size-icon-sm" />} onClick={() => void markSeen()}>Mark as seen</Button>
                  </div>
                  {briefing.data.sections.length === 0 ? <p className="rounded-lg border border-border p-4 type-body">Nothing new. Everything is quiet.</p> : null}
                  {briefing.data.newCount === 0 && briefing.data.sections.length > 0 ? <p className="type-body font-semibold">Nothing new since then. These are still open:</p> : null}
                  <ul className="flex flex-col gap-3">
                    {briefing.data.sections.map((s) => (
                      <li key={s.id}>
                        <section aria-label={s.title} className={cx("flex flex-col gap-2 rounded-lg border p-3", s.attention ? "border-warning" : "border-border")}>
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="type-h4">{s.title}</h3>
                            <Link href={s.href} onClick={() => setOpen(false)} className="inline-flex min-h-control items-center rounded-sm type-small font-bold text-gold-text underline focus-ring">Open</Link>
                          </div>
                          <ul className="flex list-disc flex-col gap-1 pl-4 type-small">{s.lines.map((l) => <li key={l}>{l}</li>)}</ul>
                          {s.items.length > 0 ? (
                            <ul className="flex flex-col gap-1 border-t border-border pt-2 type-caption text-fg-muted">
                              {s.items.map((i, n) => (
                                <li key={`${n}-${i.text}`} className="truncate">{i.href ? <Link href={i.href} onClick={() => setOpen(false)} className="rounded-sm hover:underline focus-ring">{i.text}</Link> : i.text}</li>
                              ))}
                            </ul>
                          ) : null}
                        </section>
                      </li>
                    ))}
                  </ul>
                  {briefing.data.quiet.length > 0 && briefing.data.sections.length > 0 ? <p className="type-caption text-fg-muted">Nothing new in: {briefing.data.quiet.join(", ")}.</p> : null}
                  <div><Button size="sm" variant="ghost" onClick={() => setTab("ask")}>Ask a question</Button></div>
                </>
              ) : null}
            </TabPanel>
          ) : (
            <TabPanel className="flex flex-col gap-4">
              {messages.length === 0 ? (
                <div className="flex flex-col gap-3">
                  <p className="type-body">Ask me about your leads, inbox, stock or bills, or how to do something in the app. I read your live data and never change anything.</p>
                  <ul className="flex flex-wrap gap-2" aria-label="Suggested questions">
                    {STARTERS.map((q) => (
                      <li key={q}><button type="button" onClick={() => void ask(q)} className="inline-flex min-h-control items-center rounded-full border border-border-strong bg-surface px-4 type-small font-semibold hover:bg-surface-2 focus-ring">{q}</button></li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <ul className="flex flex-col gap-3" aria-live="polite" aria-label="Conversation">
                {messages.map((m, index) => (
                  <li key={m.id} className={cx("flex flex-col gap-2", m.role === "user" ? "ml-8 items-end" : "mr-8 items-start")}>
                    <div className={cx("max-w-prose rounded-lg px-4 py-3 type-body", m.role === "user" ? "bg-gold text-on-gold" : "bg-surface-2 text-fg")}>
                      {m.role === "assistant" ? <ChatText text={m.text} /> : m.text}
                    </div>
                    {m.links && m.links.length > 0 ? (
                      <ul className="flex flex-wrap gap-2" aria-label="Go to">
                        {m.links.map((l) => (
                          <li key={l.href}><Link href={l.href} onClick={() => setOpen(false)} className="inline-flex min-h-control items-center rounded-md border border-border px-3 type-small font-bold text-gold-text focus-ring">{l.label}</Link></li>
                        ))}
                      </ul>
                    ) : null}
                    {m.quick && m.quick.length > 0 && index === messages.length - 1 && !busy ? (
                      <ul className="flex flex-wrap gap-2" aria-label="Suggested follow-ups">
                        {m.quick.map((q) => (
                          <li key={q}><button type="button" onClick={() => void ask(q)} className="inline-flex min-h-control items-center rounded-full border border-border-strong bg-surface px-4 type-small font-semibold hover:bg-surface-2 focus-ring">{q}</button></li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
                {busy ? <li className="inline-flex items-center gap-2 self-start rounded-lg bg-surface-2 px-4 py-3 type-small text-fg-muted" role="status">Thinking…</li> : null}
              </ul>
              <div ref={endRef} />
            </TabPanel>
          )}
        </div>
      </Drawer>
    </>
  );
}
