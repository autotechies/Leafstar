"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ImagePlus, MessageCircle, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox, TextInput } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Modal";
import { cx } from "@/lib/cx";
import { whatsappLink } from "@/modules/site/links";

/*
  The website assistant (AGENTS.md §11). It answers from the public catalog and the owner's FAQ only. Prices, exact stock and
  hidden brands never reach it. A visitor id lives in this browser; memory is only kept if the visitor ticks the box, and
  "Forget me" deletes everything stored about them.
*/

interface Suggestion { code: string; name: string; thumb: string | null }
interface Message { id: string; role: "user" | "assistant"; text: string; image?: string; suggestions?: Suggestion[] }

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

const GREETING = "Hello! I can help with our shirts and pants, minimum lots and how ordering works. For prices, the owner will call you personally.";

export function ChatWidget({ whatsapp }: { whatsapp: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [articleCode, setArticleCode] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([{ id: "hello", role: "assistant", text: GREETING }]);
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
    async (event?: FormEvent) => {
      event?.preventDefault();
      const text = draft.trim() || (photo ? "Do you have something like this?" : "");
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
        const data = (await response.json().catch(() => null)) as { ok?: boolean; reply?: string; sessionId?: string; error?: string; suggestions?: Suggestion[] } | null;
        if (response.ok && data?.ok && data.reply) {
          if (data.sessionId) sessionId.current = data.sessionId;
          setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: data.reply as string, suggestions: data.suggestions?.length ? data.suggestions : undefined }]);
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
    setMessages([{ id: "hello", role: "assistant", text: GREETING }]);
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
            {messages.map((m) => (
              <li key={m.id} className={cx("max-w-prose rounded-lg px-4 py-3 type-body", m.role === "user" ? "ml-8 self-end bg-gold text-on-gold" : "mr-8 self-start bg-surface-2 text-fg")}>
                {m.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.image} alt="The photo you sent" className="mb-2 max-h-48 rounded-md" />
                ) : null}
                {m.text}
                {m.suggestions ? (
                  <ul className="mt-3 flex flex-col gap-2" aria-label="Similar articles">
                    {m.suggestions.map((a) => (
                      <li key={a.code}>
                        <Link href={`/catalog/${encodeURIComponent(a.code)}`} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md border border-border bg-surface p-2 text-fg focus-ring">
                          {a.thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.thumb} alt="" className="aspect-4/5 w-12 rounded-sm object-cover" />
                          ) : null}
                          <span className="flex min-w-0 flex-col"><span className="type-small font-semibold">{a.name}</span><span className="type-caption text-gold-text">{a.code} · similar</span></span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
            {busy ? <li className="self-start rounded-lg bg-surface-2 px-4 py-3 type-small text-fg-muted">Typing…</li> : null}
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
