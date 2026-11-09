# LEAF STAR — Handoff for a new chat (read this first)

Written 8 Nov 2026 so a fresh conversation can continue the project without the old chat. Read this file, then `AGENTS.md` (rules), `DESIGN.md` (look), `BUILD_PLAN.md` (steps), `MANUAL_SETUP.md` (owner tasks), `SECURITY_AUDIT.md`, `DEPLOY.md`. Those files are the source of truth; this file explains the history, the current state and the open problems.

---

## 1. The project in one paragraph
Leaf Star is the owner's clothing **manufacturer** (shirts and pants, sold **wholesale in lots of 50/100**, own factory, hidden-label brands, buyers on credit, GST registered). The app is one system for the whole business: a **public website** for buyers (catalogue, enquiry list, Request Price, call sheet, chatbot) and a private **owner admin** (inventory, add stock, bill scanning, inbox, CRM, dashboard, chats, settings). It is a real business tool, built to final quality, step by step. The owner is not a developer: explain simply, keep instructions complete and in order.

- Repo: `https://github.com/techie-29/Leafstar` (public, so **no secret or `.env*` is ever committed**). Last pushed commit at time of writing: `7ad4e0b`.
- Owner machine: Windows, VS Code, folder `C:\Users\Comp\Desktop\ls-latest-v\Leafstar`, runs `npm run dev`. Time zone India (IST). Owner uses a real Supabase project (EU region) and a separate `leafstar-test` project.
- Hosting is **not live yet**. Vercel is only set up at Step 13.

## 2. Stack (fixed)
Next.js **16.4** (App Router, Turbopack, **Cache Components enabled**) · TypeScript strict · Tailwind v4 · Supabase (Postgres, Auth, Storage, Realtime, RLS) · Gemini via `@google/genai` (server only) · zod · lucide-react · sharp · heic-convert · web-push · mammoth (.docx) · exceljs (.xlsx/.csv) · vitest · Playwright · GitHub Actions. Two themes: **Navy & Cream** (light) and **Black & Gold** (dark). Fonts Playfair Display + Manrope. Indian number format and ₹.

**Next 16 warning (in AGENTS.md):** this is not the Next.js from older training data; read `node_modules/next/dist/docs/` before writing Next code.

## 3. How the owner wants the work done (standing instructions)
1. Build everything **autonomously, step by step**, in the order of `BUILD_PLAN.md`; commit and push each step.
2. Keep everything only the owner can do in `MANUAL_SETUP.md`.
3. Use **dummy/placeholder photos and details** where real ones are missing (labelled "Photo to be added"); **never invent** claims, numbers, certificates or photos.
4. Choose sensible defaults instead of asking, unless the answer changes what is built.
5. At the end give **one clear list** of everything the owner must do or connect.
6. Never ask the owner to paste keys into chat. Keys live only in `.env.local` (and Vercel later).
7. Be honest about what could not be tested (real Gemini, Storage, Resend, phone push cannot be tested in Claude's sandbox).
8. Commit messages end with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: <session url>`.

## 4. Hard rules (summary; full text in AGENTS.md)
- **Stock is a ledger**: never `update variants set stock`; insert into `stock_movements` (trigger maintains `variants.stock`). Undo is enforced by the database (`undo_bill`, `undo_movement`).
- Multi-write operations are **one database function call** (security definer, checks `is_admin()`). Optimistic concurrency with `updated_at`.
- **Never edit an applied migration.** Add a new numbered file. **Every new table gets RLS and is closed to anon.** Supabase grants ALL on new public objects to anon/authenticated by default, so new objects need explicit revokes (see `011_security.sql`).
- **Prices and exact stock are never public.** Public pages read only the `public_catalog` / `public_settings` views. The chatbot never states prices, hidden brands or exact stock.
- All admin pages and actions call `requireStaff()` (`src/modules/auth/session.ts`) next to their data. Public writes go through server routes: zod, DB rate limit (fails closed), origin check (`isSameOrigin`).
- Design is enforced: `node scripts/check-design.mjs` (no raw hex, only md/lg/xl breakpoints, spacing scale, `type-*` text utilities, inline styles need a comment line above). Components use semantic tokens only.
- SKU: article `LS-<SH|PN>-<4 digits>`; variant `<article>-<3-letter colour>-<size>` e.g. `LS-SH-0101-NVY-M`. Sizes S, M, L, XL, XXL.
- A step is "done" only when lint, type-check, tests and build pass and changed pages were checked at 375/768/1024/1440 in both themes.

## 5. Architecture
```
src/app/(site)/            public pages: / , /about, /catalog, /catalog/[code], /enquiry, /contact, /privacy
src/app/admin/(auth)/      /admin/login, reset/update password
src/app/admin/(app)/       dashboard, inbox, inventory, stock/add, bills (+scan, review/[id]), crm (+buyers, [id]), chats, search, settings
src/app/api/               chat, visitor, leads, contact, enquiry, uploads/sign, images/process, bills/process, push/subscribe, cron/maintenance, stock/template
src/app/dev/               /dev/styleguide, /dev/image-lab (closed in production unless ALLOW_DEV_PAGES=1)
src/modules/               admin-shell, ai (gemini wrapper), auth, bills, chat, crm, dashboard, images, inbox, inventory, maintenance, notify, search, settings, site, stock
src/components/            shared UI (ui/*, brand, charts)
src/lib/                   supabase clients (browser, server, admin), env, formats
src/proxy.ts               auth proxy, /dev gate
supabase/                  schema.sql, 003..014 migrations, tests
tests/unit, tests/e2e      vitest, Playwright
scripts/                   e2e.mjs, local-supabase.mjs, build-preview.mjs, check-design.mjs, ai-check.mjs
```
Key mechanisms:
- **Supabase clients**: `supabaseServer()` (visitor/owner session, RLS applies; now awaits `connection()` then `cookies()`), `supabaseAdmin()` (service role, server only), browser client.
- **Gemini wrapper** `src/modules/ai/gemini.ts` `generate()`: checks `ai_allowed()` (pause + daily token budget), 55 s timeout (AbortController), retries 429/503/500 with backoff (4 tries), logs every call in `ai_usage` (ok/error text). Injectable `GeminiTransport` for tests. Throws `AiUnavailableError`; callers show a friendly fallback.
- **Bills**: upload → `bill_scan_jobs` → `/api/bills/process` claims jobs (`claim_scan_job`) → extraction (Gemini JSON schema; Word/Excel text extracted first) → DB `match_bill_line()` → review screen → `apply_bill` (15 s Undo) / `undo_bill`. Matching order: exact variant SKU (1.00) → article code + size/colour (0.98) → learned alias in `item_aliases` (0.95) → fuzzy name (pg_trgm, ≤0.90, needs ≥0.45 and a size). "Confident" = ≥0.85.
- **Chatbot**: `/api/chat` → `chatTurn()` in `src/modules/chat/engine.ts`: guard (`guardReply` removes prices/hidden brands), prompt built from public catalogue + FAQ + visitor memory (only with consent), phone number typed → lead via `create_lead` + owner alert. Photo input (Step 14): `prepareChatImage` (≤5 MB, jpeg/png/webp, sharp re-encode, EXIF stripped), stored in private bucket `chat-images`, 30-day purge in maintenance, suggestions filtered to real catalogue codes (max 3), photo requests rate-limited (6 per 10 min per IP).
- **Notifications**: `notifyOwner()` (Resend email + web push via VAPID), fired with `after()`. Inbox is live via Realtime. PWA manifest + `public/sw.js`.
- **Images**: signed direct upload → server processing (thumb/medium/large WebP, blur placeholder, EXIF stripped, HEIC converted) → shared `ImageViewer`.
- **Preview**: `npm run build:preview` makes a static export for GitHub Pages (public routes + /dev pages only; admin is not in the preview; `cacheComponents` is off there).

## 6. Build history (all pushed)
| Step | What | Commit |
|---|---|---|
| 1 | Foundation, design system, tests, preview build | 113d6cb |
| 2 | Owner login, admin shell, Settings | dcf55de |
| 3 | Image system, shared viewer, image lab | 0cf5258 |
| 4 | Add Stock (new article, add to existing, Excel import) | 5e40046 |
| 5 | Inventory list + article detail | a5c79db |
| 6 | Public website, lead function (migration 008) | cf43026 |
| 7 | Bulk bill scanning (migration 009) | cda4809 |
| 8 | Chatbot, admin Chats | fe75f46 |
| 9 | Inbox, alerts (email+push), PWA | 4761a48 |
| 10 | CRM (migration 010) | d544bac |
| 11 | Dashboard + global search | 8b64a06 |
| 12 + 14 | Security pass (migration 011), error pages, deploy docs, chat photo search (migration 012) | 2bb8b2d |
| after | Fixes after the owner started running locally: Date.now prerender errors, `ai:check`, bill-line split helper | 658694f, b068263, 2b3bfbb, bfc4890, 7ad4e0b |

**Step 13 (real hosting on Vercel) has not been done.** Migrations required in order: schema.sql, 003, 004, 005, 006, 007, 008, 009, 010, 011 (closes a real hole, do not skip), 012, 013 (delete an article with no real history), 014 (footer details: Facebook, year started, owner's contact details).

## 7. Testing
- Unit/DB: `npx vitest run tests/unit` (86 pass, 1 skipped = the 50-question chat eval that needs a real key). DB tests run against a local Postgres.
- E2E: `scripts/e2e.mjs` starts a local stand-in (real Supabase Auth "GoTrue" + PostgREST) on a fresh DB, builds, starts `next start`, runs Playwright. Needs `DATABASE_URL` and `PW_CHROMIUM_PATH`. Use `--workers=1`. Projects: chromium, phone, admin-flows, admin-stock, admin-visual.
- **Last full browser run (before the final fixes) had 4 failures** that looked like timeouts caused by a rebuild clashing with the test server: visual `privacy · dark · 1024px`, the theme-toggle test, the phone image-lab swipe test, and the admin-flows "signed-out visitor sent to login and back" test. Later full reruns never finished in the sandbox (time limit). **These four are unconfirmed; rerun them.**
- Always run `npx tsc --noEmit`, `npx eslint .`, `node scripts/check-design.mjs`, `npm run build`, `npm run build:preview` before pushing.
- Gotcha: never run `npm run build` while the e2e server is running (they clobber `.next`).

## 8. Open problems and what happened most recently (resume here)
1. **Gemini model on the owner's key.** Free-tier access is unreliable. `ai_usage` showed `gemini-3.8-flash` calls "aborted" (55 s) and one "fetch failed". `npm run ai:check` showed the network is fine (model list in 0.5 s) but `gemini-3.8-flash` does not answer a one-word prompt in 30 s. Older models (e.g. 2.5-flash) are "no longer available to new users". The updated `ai:check` tests every text Flash model on the key (15 s each) and prints a working `GEMINI_MODEL=` line. **Pending: owner runs `git pull` + `npm run ai:check` and picks a model** (candidates: gemini-3.7-flash, 3.6-flash, 3.5-flash, 3.5-flash-lite, 3.1-flash-lite). Later the owner mentioned they had "come up with an approach" for unreliable free-tier availability and wanted to first run one real scan; a scan then **did work** (the AI read the invoice correctly). Possible follow-ups: longer timeout, a fallback model list, or a test-only fake-AI mode (offered, not built; `AI_FAKE=1`, must be impossible in production).
2. **Dev-mode `Date.now()` prerender errors** (Next 16 "blocking-prerender-current-time") appeared on `/admin/login`, `/admin`, `/admin/inbox`, `/admin/bills/scan`. Pages still returned 200. Cause: Supabase auth session checks read the current time. Fixes pushed: `loadQueue()` calls `await connection()`; `supabaseServer()` now awaits `connection()` before `cookies()` (commit b068263). **Not confirmed in the owner's dev server; ask whether any red error remains.** Other `Date.now()` uses: `InboxView.tsx` (client component), `NewPasswordForm.tsx`, `maintenance/run.ts`, `images/localPhotos.ts`. Also the footer year was changed to a client `CurrentYear` component.
3. **Bill review: "Not matched" for assorted lines.** The owner's real invoice (Tax Invoice LS/2026-27/042, 01 Nov 2026, buyer ABC Textiles Pvt. Ltd., one line: Product ID `LS-SH-0001`, "Men's Premium Cotton Shirt (Sizes: S-XXL, Assorted Colours)", HSN 6205, 1,000 pcs @ ₹450 = ₹4,50,000, CGST/SGST 2.5% each, total ₹4,72,500) was read correctly (bill number, date, buyer, line). It was unmatched because the line names the article but **no single colour and size**, and stock is tracked per article+colour+size. The owner suspected the bill number was mistaken for the product ID; that is **not** what happened (matching looks only at each line's own text). Built (commit 7ad4e0b): such lines now show a note, the dropdown is filtered to that article's variants, and a **"Split: add another line for this article"** button copies the line (qty 0) so pieces can be assigned per colour/size; the app does not learn an alias from such a line. **Open question asked to the owner, unanswered:** for "assorted" bills, (1) manually split across colours/sizes, or (2) track only per-article totals (less accurate colour/size stock)? Also offered: make Gemini extract an explicit `product_code` from the "Product ID/SKU/Item code" column and pass it to matching.
4. Not yet built: visitor page-view tracking and "welcome back", Inbox "Anonymous" tab and bulk bar, Sentry-style alerting (only structured logs), stricter CSP with nonces, and Step 13 (Vercel deploy).

## 9. Owner to-do list (also in MANUAL_SETUP.md)
Run migrations 004–014 in both Supabase projects · fill `.env.local` (Supabase URL/anon/service keys, `GEMINI_API_KEY`, `GEMINI_MODEL`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`, VAPID public/private/subject, `RESEND_API_KEY`, `RESEND_FROM`) · Supabase: sign-ups OFF, min password 12, reset-password email link, owner user + two-step login · accounts: Resend (verify domain), Vercel, domain · Admin → Settings: business details, alert email, brands, FAQ answers (chatbot answers only from these) · real content in `src/modules/site/content.ts` and photos (everything is placeholder now) · bigger square logo for PWA icons · test on a phone: push, email, chat, photo search, bill upload · privacy page legal review (add the 30-day chat-photo sentence) · run `RUN_CHAT_EVAL=1 … npx vitest run tests/unit/chat-eval.test.ts` with the real key · follow `DEPLOY.md` at go-live.

## 10. Decisions already taken (change only if the owner asks)
Lots: each article has a minimum order (default 50); a fixed lot size is optional (empty = any quantity ≥ MOQ) — the owner has not yet confirmed fixed packs vs any quantity. Types Shirt/Pant; 16 common colours one tap in Add Stock. Excel import columns: Article code, Article name, Type, Brand, Fabric, Pattern, Colour, Colour code, Colour hex, Size, Pieces. Stage names in CRM: New, Contacted, Quoted, Negotiation, Won, Lost. Old `.doc`/`.xls` bills are refused with a "re-save as .docx/.xlsx" message. Inbox items go red after 24 h.

## 11. Roadmap beyond this phase (design so it plugs in; do not build yet)
Manufacturing (batches, stages, wastage), expenses and costing (fills admin-only `wholesale_price`), employees and roles, sales depth (quotations, orders, GST invoices, credit, dispatch), an intelligence layer over permission-checked read-only views, extras (QR labels, WhatsApp automation, offline catalogue). Never hard-wire "owner = any logged-in user"; keep the ledger, `contacts`, `batches`, `locations`, `audit_log` as the backbone.

## 12. Suggested first message in the new chat
> Read `HANDOFF.md`, `AGENTS.md`, `DESIGN.md`, `BUILD_PLAN.md` and `MANUAL_SETUP.md` in the repo `techie-29/Leafstar`, then continue from section 8 of `HANDOFF.md`. Follow the standing instructions in section 3. Start by asking me for the output of `npm run ai:check` and whether any red `Date.now()` error remains in `npm run dev`.
