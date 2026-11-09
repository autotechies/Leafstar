"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ImagePlus, MessageCircle, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox, TextInput } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Modal";
import { cx } from "@/lib/cx";
import type { ChatProduct } from "../cards";
import { formatReply } from "../format";
import { whatsappLink } from "@/modules/site/links";

/*
  The website assistant (AGENTS.md §11). It answers from the public catalog and the owner's FAQ only. Prices, exact stock and
  hidden brands never reach it. A visitor id lives in this browser; memory is only kept if the visitor ticks the box, and
  "Forget me" deletes everything stored about them.
*/

interface Message { id: string; role: "user" | "assistant"; text: string; image?: string; products?: ChatProduct[]; similar?: boolean; quickReplies?: string[] }

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Shrinks the photo in the browser and saves it as a plain JPEG, which also drops the location and camera details hidden in the file. */
async function shrinkPhoto(file: File): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { ok: false, error: "Please choose a JPG, PNG or WEBP picture." };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "That photo is over 5 MB. Please choose a smaller one." };
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return { ok: true, dataUrl: canvas.toDataURL("image/jpeg", 0.82) };
  } catch {
    return { ok: false, error: "That photo could not be opened. Please try another one." };
  }
}

const VISITOR_KEY = "ls-visitor-v1";
const REMEMBER_KEY = "ls-chat-remember-v1";

function readStore(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writeStore(key: string, value: string | null) {
  try { if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value); } catch { /* storage blocked: the chat still works for this visit */ }
}
function visitorId(): string {
  const existing = readStore(VISITOR_KEY);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const fresh = crypto.randomUUID();
  writeStore(VISITOR_KEY, fresh);
  return fresh;
}

const GREETING = "Hi, I'm Leaf Star. I can show you our shirts and pants, and explain minimum lots and how ordering works. For prices, the owner will call you personally.";
const START_CHIPS = ["Show me shirts", "Show me pants", "Minimum order", "How do I order?"];

/** The assistant's words: short paragraphs and bullet lists, with bold. Built as elements, never as HTML. */
function ChatText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2">
      {formatReply(text).map((b, i) =>
        b.kind === "p" ? (
          <p key={i}>{b.parts.map((x, j) => (x.bold ? <strong key={j}>{x.text}</strong> : <span key={j}>{x.text}</span>))}</p>
        ) : (
          <ul key={i} className="flex list-disc flex-col gap-1 pl-4">
            {b.items.map((item, k) => (
              <li key={k}>{item.map((x, j) => (x.bold ? <strong key={j}>{x.text}</strong> : <span key={j}>{x.text}</span>))}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

/** One article under a reply: photo, name, code, colour dots, sizes, minimum order, and a link to its page. */
function ProductCard({ p, similar, onOpen }: { p: ChatProduct; similar: boolean; onOpen: () => void }) {
  return (
    <Link href={`/catalog/${encodeURIComponent(p.code)}`} onClick={onOpen} className="flex gap-3 rounded-lg border border-border bg-surface p-2 text-fg focus-ring">
      {p.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.thumb} alt="" className="aspect-4/5 w-16 shrink-0 rounded-md object-cover" />
      ) : (
        <span aria-hidden="true" className="aspect-4/5 w-16 shrink-0 rounded-md bg-surface-2" />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="type-small font-semibold">{p.name}</span>
        <span className="type-caption text-gold-text">{p.code}{similar ? " · similar" : ""}</span>
        {p.colours.length ? (
          <span className="flex items-center gap-1" role="img" aria-label={`Colours: ${p.colours.map((c) => c.name).join(", ")}`}>
            {p.colours.map((c) => (
              // The dot's colour is the article's own colour value from the catalog.
              <span key={c.name} aria-hidden="true" className="size-3 rounded-full border border-border" style={{ backgroundColor: c.hex }} />
            ))}
          </span>
        ) : null}
        <span className="type-caption text-fg-muted">
          {p.sizes.length ? `Sizes ${p.sizes.join(", ")} · ` : ""}Min {p.moq} pcs{p.lowStock ? " · limited stock" : ""}
        </span>
      </span>
    </Link>
  );
}

export function ChatWidget({ whatsapp }: { whatsapp: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [articleCode, setArticleCode] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([{ id: "hello", role: "assistant", text: GREETING, quickReplies: START_CHIPS }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(false);
  const [trap, setTrap] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const sessionId = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const [forgotten, setForgotten] = useState(false);

  const openPanel = useCallback((code: string | null) => {
    setArticleCode(code);
    setRemember(readStore(REMEMBER_KEY) === "1");
    setOpen(true);
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => openPanel((e as CustomEvent<{ articleCode?: string | null }>).detail?.articleCode ?? null);
    window.addEventListener("ls:open-chat", onOpen);
    return () => window.removeEventListener("ls:open-chat", onOpen);
  }, [openPanel]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  const send = useCallback(
    async (event?: FormEvent, preset?: string) => {
      event?.preventDefault();
      const text = preset ?? (draft.trim() || (photo ? "Do you have something like this?" : ""));
      if (!text || busy) return;
      const attached = photo;
      setDraft("");
      setPhoto(null);
      setPhotoError(null);
      setForgotten(false);
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text, image: attached ?? undefined }]);
      setBusy(true);
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId: visitorId(), sessionId: sessionId.current, message: text, articleCode, remember, website: trap, image: attached ? attached.replace(/^data:[^,]+,/, "") : undefined }),
        });
        const data = (await response.json().catch(() => null)) as { ok?: boolean; reply?: string; sessionId?: string; error?: string; products?: ChatProduct[]; similar?: boolean; quickReplies?: string[] } | null;
        if (response.ok && data?.ok && data.reply) {
          if (data.sessionId) sessionId.current = data.sessionId;
          setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: data.reply as string, products: data.products?.length ? data.products : undefined, similar: data.similar, quickReplies: data.quickReplies?.length ? data.quickReplies : undefined }]);
        } else {
          const rate = response.status === 429;
          setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: rate ? (data?.error ?? "Please wait a few minutes before sending more.") : "Sorry, I could not answer just now. Please call us or message us on WhatsApp." }]);
        }
      } catch {
        setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: "No connection. Check your internet and try again." }]);
      } finally {
        setBusy(false);
      }
    },
    [articleCode, busy, draft, photo, remember, trap],
  );

  async function forget() {
    const id = readStore(VISITOR_KEY);
    if (id) {
      try {
        await fetch("/api/visitor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitorId: id }) });
      } catch { /* the local copy is still cleared below */ }
    }
    writeStore(VISITOR_KEY, null);
    writeStore(REMEMBER_KEY, null);
    sessionId.current = null;
    setRemember(false);
    setMessages([{ id: "hello", role: "assistant", text: GREETING, quickReplies: START_CHIPS }]);
    setForgotten(true);
  }

  // On an article page the phone has a fixed bar along the bottom; the button sits above it.
  const onArticle = /^\/catalog\/[^/]+/.test(pathname);
  const wa = whatsappLink(whatsapp, "Hello Leaf Star, I have a question.");
  // The static design preview has no server, so the assistant lives on the real site only.
  if (process.env.NEXT_PUBLIC_IS_PREVIEW === "1") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => openPanel(onArticle ? decodeURIComponent(pathname.split("/")[2] ?? "") || null : null)}
        aria-label="Chat with our assistant"
        className={cx(
          "fixed right-4 z-20 inline-flex size-fab items-center justify-center rounded-full bg-gold text-on-gold shadow-2 focus-ring",
          onArticle ? "bottom-24 lg:bottom-6" : "bottom-4 lg:bottom-6",
        )}
      >
        <MessageCircle aria-hidden="true" className="size-icon" />
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Ask Leaf Star"
        description="Questions about our articles, lots and ordering"
        footer={
          <form onSubmit={(e) => void send(e)} className="flex w-full flex-wrap items-end gap-2">
            {photo || photoError ? (
              <div className="flex w-full items-center gap-3">
                {photo ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt="Photo ready to send" className="size-16 rounded-md object-cover" />
                    <Button type="button" size="sm" variant="ghost" icon={<X aria-hidden="true" className="size-icon-sm" />} onClick={() => setPhoto(null)}>Remove photo</Button>
                  </>
                ) : null}
                {photoError ? <p role="alert" className="type-small text-danger">{photoError}</p> : null}
              </div>
            ) : null}
            <div aria-hidden="true" className="absolute -left-96 size-0 overflow-hidden">
              <label>Website<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label="Choose a photo" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void shrinkPhoto(f).then((r) => { if (r.ok) { setPhoto(r.dataUrl); setPhotoError(null); } else setPhotoError(r.error); }); }} />
            <Button type="button" variant="secondary" iconOnly aria-label="Attach a photo" onClick={() => fileRef.current?.click()} icon={<ImagePlus aria-hidden="true" className="size-icon" />} />
            <div className="flex-1">
              <TextInput label="Your message" hideLabel placeholder="Type your question" value={draft} maxLength={800} onChange={(e) => setDraft(e.target.value)} />
            </div>
            <Button type="submit" iconOnly aria-label="Send message" loading={busy} disabled={!draft.trim() && !photo} icon={<Send aria-hidden="true" className="size-icon" />} />
          </form>
        }
      >
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-3" aria-live="polite" aria-label="Conversation">
            {messages.map((m, index) => (
              <li key={m.id} className={cx("flex flex-col gap-3", m.role === "user" ? "ml-8 items-end" : "mr-8 items-start")}>
                <div className={cx("max-w-prose rounded-lg px-4 py-3 type-body", m.role === "user" ? "bg-gold text-on-gold" : "bg-surface-2 text-fg")}>
                  {m.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.image} alt="The photo you sent" className="mb-2 max-h-48 rounded-md" />
                  ) : null}
                  {m.role === "assistant" ? <ChatText text={m.text} /> : m.text}
                </div>
                {m.products ? (
                  <ul className="flex w-full flex-col gap-2" aria-label={m.similar ? "Similar articles" : "Articles"}>
                    {m.products.map((p) => (
                      <li key={p.code}><ProductCard p={p} similar={Boolean(m.similar)} onOpen={() => setOpen(false)} /></li>
                    ))}
                  </ul>
                ) : null}
                {m.quickReplies && index === messages.length - 1 && !busy ? (
                  <ul className="flex flex-wrap gap-2" aria-label="Suggested replies">
                    {m.quickReplies.map((q) => (
                      <li key={q}>
                        <button type="button" onClick={() => void send(undefined, q)} className="inline-flex min-h-control items-center rounded-full border border-border-strong bg-surface px-4 type-small font-semibold hover:bg-surface-2 focus-ring">{q}</button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
            {busy ? <li className="self-start rounded-lg bg-surface-2 px-4 py-3 type-small text-fg-muted" role="status">Leaf Star is typing…</li> : null}
          </ul>
          <div ref={endRef} />
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <Checkbox
              label="Remember my details next time"
              checked={remember}
              onChange={(e) => { setRemember(e.target.checked); writeStore(REMEMBER_KEY, e.target.checked ? "1" : "0"); }}
            />
            <p className="type-caption text-fg-muted">Off by default. If you tick this, we keep what you tell us (like your name and what you sell) to help you faster. You can delete it any time.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" icon={<Trash2 aria-hidden="true" className="size-icon-sm" />} onClick={() => void forget()}>Forget me</Button>
              {wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-control items-center rounded-sm type-small font-bold text-gold-text underline focus-ring">Chat on WhatsApp instead</a> : null}
            </div>
            {forgotten ? <p role="status" className="type-small text-success">Done. Everything we stored about you was deleted.</p> : null}
          </div>
        </div>
      </Drawer>
    </>
  );
}
