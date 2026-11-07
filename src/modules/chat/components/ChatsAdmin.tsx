"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Flag, HelpCircle, MessageSquare, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Banner, EmptyState } from "@/components/ui/Feedback";
import { Checkbox, Textarea, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { cx } from "@/lib/cx";
import { deleteFaqAction, flagSessionAction, loadTranscriptAction, resolveUnansweredAction, saveFaqAction } from "../actions";
import type { ChatsData, FaqRow, SessionRow, TranscriptMessage, UnansweredRow } from "../types";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export function ChatsAdmin({ data }: { data: ChatsData }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState("chats");
  const openQuestions = data.unanswered.filter((u) => u.status === "open");

  // Transcript
  const [viewing, setViewing] = useState<SessionRow | null>(null);
  const [messages, setMessages] = useState<TranscriptMessage[] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // FAQ editor
  const [editing, setEditing] = useState<{ id: string | null; topic: string; question: string; answer: string; isActive: boolean; fromUnanswered?: string } | null>(null);
  const [faqError, setFaqError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<FaqRow | null>(null);

  async function openChat(s: SessionRow) {
    setViewing(s);
    setNote(s.ownerNote ?? "");
    setMessages(null);
    const r = await loadTranscriptAction(s.id);
    setMessages(r.ok ? r.messages : []);
    if (!r.ok) toast.show({ kind: "error", title: r.error });
  }

  async function flag(flagged: boolean) {
    if (!viewing) return;
    setBusy(true);
    const r = await flagSessionAction(viewing.id, flagged, note);
    setBusy(false);
    toast.show(r.ok ? { kind: "success", title: flagged ? "Marked for fixing." : "Mark removed." } : { kind: "error", title: r.error });
    if (r.ok) {
      setViewing(null);
      router.refresh();
    }
  }

  async function saveFaq() {
    if (!editing) return;
    setBusy(true);
    setFaqError(null);
    const r = await saveFaqAction({ id: editing.id, topic: editing.topic, question: editing.question, answer: editing.answer, isActive: editing.isActive }, editing.fromUnanswered);
    setBusy(false);
    if (!r.ok) return setFaqError(r.error);
    toast.show({ kind: "success", title: "Saved. The assistant uses it from the next message." });
    setEditing(null);
    router.refresh();
  }

  async function removeFaq() {
    if (!deleting) return;
    setBusy(true);
    const r = await deleteFaqAction(deleting.id);
    setBusy(false);
    setDeleting(null);
    toast.show(r.ok ? { kind: "success", title: "Answer removed." } : { kind: "error", title: r.error });
    router.refresh();
  }

  async function dismiss(u: UnansweredRow) {
    const r = await resolveUnansweredAction(u.id);
    toast.show(r.ok ? { kind: "success", title: "Marked as done." } : { kind: "error", title: r.error });
    router.refresh();
  }

  const chatColumns: Column<SessionRow>[] = [
    { key: "who", header: "Visitor", primary: true, render: (s) => (<button type="button" onClick={() => void openChat(s)} className="rounded-sm text-left font-semibold hover:underline focus-ring">{s.visitorName ?? "Anonymous visitor"}</button>) },
    { key: "first", header: "First question", render: (s) => <span className="line-clamp-2">{s.preview || "No messages"}</span> },
    { key: "article", header: "Article", hideOnPhone: true, render: (s) => s.articleCode ?? "" },
    { key: "count", header: "Messages", align: "right", render: (s) => s.messageCount },
    { key: "flag", header: "", render: (s) => (s.flagged ? <Badge tone="warning">To fix</Badge> : null) },
    { key: "when", header: "Started", hideOnPhone: true, render: (s) => when(s.startedAt) },
  ];
  const faqColumns: Column<FaqRow>[] = [
    { key: "q", header: "Question", primary: true, render: (f) => <span className="font-semibold">{f.question}</span> },
    { key: "a", header: "Answer", render: (f) => <span className="line-clamp-2">{f.answer}</span> },
    { key: "on", header: "Used", render: (f) => <Badge tone={f.isActive ? "success" : "neutral"}>{f.isActive ? "Yes" : "Off"}</Badge> },
    { key: "act", header: "", align: "right", render: (f) => (<div className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setEditing({ id: f.id, topic: f.topic ?? "", question: f.question, answer: f.answer, isActive: f.isActive })}>Edit</Button><Button size="sm" variant="ghost" onClick={() => setDeleting(f)}>Delete</Button></div>) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        label="Chat sections"
        value={tab}
        onChange={setTab}
        items={[
          { id: "chats", label: "Conversations", count: data.sessions.length },
          { id: "unanswered", label: "Could not answer", count: openQuestions.length },
          { id: "faq", label: "Your answers", count: data.faqs.length },
        ]}
      />

      {tab === "chats" ? (
        <TabPanel>
          <Card padding="none">
            <DataTable columns={chatColumns} rows={data.sessions} rowKey={(s) => s.id} caption="Conversations" empty={<EmptyState icon={MessageSquare} title="No conversations yet" description="When a visitor talks to the website assistant, the conversation appears here." />} />
          </Card>
        </TabPanel>
      ) : null}

      {tab === "unanswered" ? (
        <TabPanel className="flex flex-col gap-4">
          {openQuestions.length === 0 ? (
            <EmptyState icon={HelpCircle} title="Nothing waiting" description="Questions the assistant could not answer appear here. Write an answer once and it will know next time." />
          ) : (
            <ul className="flex flex-col gap-3">
              {openQuestions.map((u) => (
                <li key={u.id}>
                  <Card className="flex flex-col gap-3">
                    <p className="type-body">{u.question}</p>
                    <p className="type-caption text-fg-muted">{when(u.createdAt)}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => setEditing({ id: null, topic: "", question: u.question, answer: "", isActive: true, fromUnanswered: u.id })}>Write an answer</Button>
                      <Button size="sm" variant="ghost" onClick={() => void dismiss(u)}>Not needed</Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabPanel>
      ) : null}

      {tab === "faq" ? (
        <TabPanel className="flex flex-col gap-4">
          <Banner tone="info">The assistant answers only from your articles and the answers below. Add your payment terms, delivery, returns and anything buyers ask often. Never put prices here.</Banner>
          <div><Button icon={<Plus aria-hidden="true" className="size-icon" />} onClick={() => setEditing({ id: null, topic: "", question: "", answer: "", isActive: true })}>Add an answer</Button></div>
          <Card padding="none">
            <DataTable columns={faqColumns} rows={data.faqs} rowKey={(f) => f.id} caption="Your answers" empty={<EmptyState icon={Bot} title="No answers yet" description="Add the questions buyers ask most, such as minimum order, delivery and payment terms." />} />
          </Card>
        </TabPanel>
      ) : null}

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.visitorName ?? "Anonymous visitor"}
        description={viewing ? `${when(viewing.startedAt)}${viewing.visitorPhone ? ` · ${viewing.visitorPhone}` : ""}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setViewing(null)}>Close</Button>
            {viewing?.flagged ? <Button variant="secondary" loading={busy} onClick={() => void flag(false)}>Remove mark</Button> : null}
            <Button loading={busy} icon={<Flag aria-hidden="true" className="size-icon" />} onClick={() => void flag(true)}>Mark as a bad answer</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {messages === null ? <p className="type-small text-fg-muted">Loading…</p> : (
            <ul className="flex flex-col gap-2">
              {messages.map((m) => (
                <li key={m.id} className={cx("rounded-lg px-3 py-2 type-small", m.role === "user" ? "ml-6 bg-surface-2" : "mr-6 border border-border")}>
                  <span className="mb-1 block type-caption text-fg-muted">{m.role === "user" ? "Visitor" : "Assistant"}</span>
                  {m.content}
                </li>
              ))}
            </ul>
          )}
          <Textarea label="Note for yourself" rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} helper="For example: should have said we make it in 3 colours." />
        </div>
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit answer" : "Add an answer"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button loading={busy} onClick={() => void saveFaq()}>Save</Button>
          </>
        }
      >
        {editing ? (
          <div className="flex flex-col gap-4">
            {faqError ? <Banner tone="danger">{faqError}</Banner> : null}
            <TextInput label="Topic (optional)" value={editing.topic} maxLength={60} onChange={(e) => setEditing({ ...editing, topic: e.target.value })} />
            <TextInput label="Question buyers ask" value={editing.question} maxLength={300} onChange={(e) => setEditing({ ...editing, question: e.target.value })} />
            <Textarea label="Your answer" rows={5} value={editing.answer} maxLength={1500} onChange={(e) => setEditing({ ...editing, answer: e.target.value })} helper="Do not include prices. The assistant will not repeat them." />
            <Checkbox label="The assistant may use this answer" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this answer?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Keep it</Button>
            <Button variant="danger" loading={busy} onClick={() => void removeFaq()}>Delete</Button>
          </>
        }
      >
        <p className="type-body text-fg-muted">{deleting?.question}</p>
      </Modal>
    </div>
  );
}
