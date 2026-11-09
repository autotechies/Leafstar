# LEAF STAR — Architecture and technical reference

Companion to `HANDOFF.md` (status and history), `AGENTS.md` (rules), `DESIGN.md` (look) and `BUILD_PLAN.md` (steps). This file explains **how the system is built**: the database, the security model, and how data moves for each feature. It was written from the SQL migrations and the code (8 Nov 2026). When code and this file disagree, the code and the migrations win; fix this file.

---

## 1. System at a glance
```
Buyer's phone/PC ──► Next.js public site (server-rendered, cached) ──reads──► views public_catalog, public_settings  (anon key)
                 └─► /api/* routes (zod + same-origin + DB rate limit) ──service key──► DB functions (create_lead, ...) + Storage
Owner's phone/PC ──► /admin/* (Supabase Auth email+password, optional TOTP) ──user session (RLS)──► tables / DB functions
Gemini (server only) ◄── src/modules/ai/gemini.ts ◄── bills extraction, chatbot
Resend (email) + Web Push (VAPID) ◄── notifyOwner()
Vercel cron (daily 21:30 UTC) ──► /api/cron/maintenance (needs CRON_SECRET)
```
Three ways code reaches the database, and which one to use:
| Client | File | Key | Rules applied | Used for |
|---|---|---|---|---|
| Browser | `src/lib/supabase/browser` | anon / user session | RLS | live updates (Realtime), admin forms that talk directly |
| Server as visitor/owner | `supabaseServer()` in `src/lib/supabase/server.ts` | anon + the user's cookie | RLS (`is_admin()`) | every admin page and action, public views |
| Server as the system | `supabaseAdmin()` in `src/lib/supabase/admin.ts` | **service role** (server only) | bypasses RLS | public form handlers, chat, maintenance, bill processing |

## 2. Roles and the single gate
- `profiles(id → auth.users, full_name, role app_role, is_active)`. Roles: `owner, manager, warehouse, sales, accounts`. Only `owner`/`manager` pass `is_admin()` today; other roles are reserved for later phases.
- `is_admin()` (security definer): true only for an active owner/manager **and**, once the user has switched on two-step login, only when the session has passed the second step (`aal2`) — enforced in the database (migration 004), so a stolen password cannot call the API directly.
- `bootstrap_owner(email, name)` makes the first user the owner (refuses if an owner exists).
- App side: `requireStaff()` in `src/modules/auth/session.ts` (`lookupStaff()` is cached per request and calls `supabase.auth.getUser()`, which checks the session with Supabase rather than trusting the cookie). Every admin page and action calls it next to its data, because Next renders layouts and pages in parallel.
- `src/proxy.ts`: redirects signed-out `/admin/*` to the login, and closes `/dev/*` in production unless `ALLOW_DEV_PAGES=1`.

## 3. Database reference
Postgres 16-style Supabase. Extensions: `pg_trgm`. Enums: `app_role, article_category (upperwear|lowerwear), article_source, contact_role, movement_reason (production|sale|adjustment|return|undo|opening), bill_status (draft|applied|undone), scan_status (queued|processing|extracted|failed), lead_source, lead_stage (new|contacted|quoted|negotiation|won|lost), activity_kind, inbox_kind, inbox_status (unanswered|handled|dismissed), inbox_via`.

### 3.1 Catalogue and stock
| Table | Purpose and important rules |
|---|---|
| `business_settings` | Exactly one row (`id boolean check (id)`). Business name, tagline, phone, whatsapp (digits with country code), email, address, city, gstin, instagram, **alert_email (private)**, `ai_daily_token_budget` (default 2,000,000), `ai_paused`. |
| `locations` | One row now: **Factory** (`…f001`, default). Movements carry `location_id` so more locations can come later. |
| `brands` | `name` unique ignoring case (004). `is_public=false` brands are hidden everywhere public. |
| `articles` | One per design. `code` unique uppercase (`LS-SH-0101`), category, garment (Shirt/Pant), style, brand, fabric, pattern, description, `moq` (default 50), `lot_size` (nullable; null = any quantity ≥ moq), `hsn_code`, `source`, `is_public`, `is_featured`, `is_active` (false = archived), `wholesale_price` (admin only, filled by a future costing module). Trigger `enforce_publish_rules` (003): cannot be public unless it has ≥1 colour and every colour has ≥1 photo. |
| `article_colors` | name, 3-letter `code`, `hex`, `sort_order`; unique per article by code and by name. Deleting a colour deletes its photos; a colour with stock history cannot be deleted (ledger protects it). |
| `article_images` | Processed photo: `thumb_url, medium_url, url (large), blur_data_url, width, height, sort_order`; `color_id` null = general photo. |
| `variants` | **article + colour + size** — the unit of stock. `sku` unique (`LS-SH-0101-NVY-M`), `stock` (cached, ≥0, maintained by trigger), `low_stock_threshold` (default 10), `last_movement_at`, `is_active`, `size_order`. Unique (colour, size). |
| `batches` | Production batch (`code` unique, `produced_on`, notes). Every production entry names a batch. |
| `stock_movements` | **The ledger.** `qty_change` (+/−, never 0), `reason`, `bill_id`, `batch_id`, `reverses_movement_id`, `note` (required for `adjustment`), `created_by`. Append-only (trigger `block_append_only`); trigger `apply_stock_movement` keeps `variants.stock` in sync. View `stock_by_location` (security_invoker). |
| `image_uploads` | Record of each processed photo set so unused ones can be cleaned (005). Trigger `mark_image_attached` flags use by an article. |

### 3.2 Bills
| Table | Purpose |
|---|---|
| `bill_scan_jobs` | Queue: `batch_ref`, `file_path`, `file_name`, `mime_type`, `file_hash`, `status`, `attempts`, `error`, `bill_id`, timestamps. Realtime-published. |
| `bills` | One per bill: number, date, `contact_id`, `buyer_name_raw`, `file_path`, `file_hash`, `extracted_json` (includes `raw_text`), `total_amount`, `status`, `applied_at/by`, `undone_at`. Unique index on (lower(number), date) and on `file_hash` **only while status = applied** (so an undone bill can be re-applied). |
| `bill_items` | Lines: `variant_id` (null = unmatched), `raw_text`, extracted name/colour/size, `qty` (>0, always **pieces**), `rate`, `amount`, `match_method` (sku/alias/fuzzy/manual), `match_confidence`. |
| `item_aliases` | What the scanner learned: `alias_norm` (unique) → article, optional colour, optional size. |

### 3.3 Contacts, CRM, inbox, visitors, chat
| Table | Purpose |
|---|---|
| `contacts` | People and companies in one table (buyer/supplier/worker/employee roles array). Phone digits-only, unique when present; `gstin`, `credit_limit`, `payment_terms_days` for the later money phase. |
| `leads` | `phone` (digits, 11–13 incl. 91), source, stage, message, `quoted_amount`, `lost_reason`, `next_follow_up`. **Unique index: one open lead per phone** (stage not won/lost). |
| `lead_items` | Articles (optional colour, quantity in pieces) a lead asked about. |
| `lead_activities` | Timeline: note, call, whatsapp, stage_change, enquiry, quote, follow_up (+ `meta`). |
| `inbox_items` | "Someone tried to reach us; has anyone responded?" kind, status, name, phone (null = anonymous), visitor/lead/article links, preview, handled_* fields. Check: handled rows need `handled_at`. Realtime-published. |
| view `inbox_open_by_contact` | Open items grouped by phone (or by visitor for anonymous): counts, kinds, oldest/latest, item ids. |
| `push_subscriptions` | Each owner device's web-push registration (policy: only your own rows). |
| `visitors` | Anonymous id made in the visitor's browser; name/phone/instagram only after they share; `consent_at`, `memory`. |
| `visitor_events` | Page/article views, searches etc. (table exists; **client-side tracking not built yet**). |
| `chat_sessions` | Visitor, optional focused article, `flagged`, `owner_note`. |
| `chat_messages` | role user/assistant, content, `image_path` (012; private bucket `chat-images`). |
| `faq_entries` | Owner's answers (topic, question, answer, sort, active). **The chatbot answers only from these + the public catalogue.** |
| `unanswered_questions` | Things the bot could not answer; owner resolves by writing an FAQ (`faq_id`). |

### 3.4 Platform tables
`audit_log` (append-only; row triggers on articles, brands, contacts, leads, bills, business_settings, profiles, locations, and variants for non-stock changes) · `rate_limits(key, window_start, hits)` (no policies; service only) · `ai_usage` (feature bill_scan/chat/other, model, tokens, ok, error, ref_id) with view `ai_usage_daily` and function `ai_allowed()`.

### 3.5 The only public surface
- View **`public_catalog`**: public + active articles whose brand is public and whose total stock > 0. Returns code, name, category, garment, style, brand, fabric, pattern, description, moq, lot_size, featured, `sizes` (only sizes with stock), `colors` (only colours with stock, each with its in-stock sizes and photo set), general `images`, and `availability` (`in_stock` or `low_stock` when total < moq). **No prices, no exact stock.**
- View **`public_settings`**: business name, tagline, phone, whatsapp, email, address, city, instagram (not alert_email, not GSTIN).
- `anon` has **no** table access; migration 011 revokes write rights on those two views and sets default privileges so new objects start closed. Never loosen the views in app code.
- Storage: `article-images`, `site-media` public (read by link, listing closed in 003); `bills`, `image-staging`, `chat-images` private.

### 3.6 Database functions (all-or-nothing operations)
| Function | Migration | Called by | What it does |
|---|---|---|---|
| `create_article_full(p)` | 003 | New article form | Article + colours + sizes (variants and SKUs) + photos + batch + opening production stock in one transaction. |
| `add_stock_batch(p)` | 003 | Add to existing | One batch + many production entries. |
| `undo_movement(id, note)` | 003 | Inventory history | Reverses one manual entry exactly once (reverse row with `reverses_movement_id`). |
| `undo_batch(batch, archive_article)` | 006 | 15-second Undo after Add Stock/New article/Import | Reverses a whole batch; refuses if any entry was undone/belongs to a bill/would go below zero. |
| `import_stock(p)` | 006 | Excel import | Reuses/creates articles, colours, sizes (new articles are hidden drafts) and adds stock in one batch. |
| `next_article_code(type)` | 006 | "Auto-generate next" | Next free `LS-SH-0102` etc. |
| `add_colour(p)`, `add_size(article,size)`, `set_colour_photos(color,images)` | 007 | Inventory detail | Add a colour with photos/stock; add a size to every colour; replace a colour's photos (old files cleaned a day later). |
| `apply_bill(bill)` / `undo_bill(bill)` | schema | Review screen | Insert `sale` movements for every line (refuses to oversell) / reverse them. |
| `norm_alias`, `match_bill_line`, `finish_scan_job`, `save_bill_draft` | 009 | bill processing / review | See section 5.3. |
| `claim_scan_job()` / `reset_stuck_scan_jobs()` | schema/003 | process route / maintenance | Safe job claiming; recover stuck jobs (10 min, max 3 attempts). |
| `create_lead(p)` | 008 | all public forms, chat | Phone validation; join the one open lead for that phone or create it (race-safe); items; timeline; inbox item. Service role only. |
| `move_lead`, `create_manual_lead` | 010 | CRM | Stage change with optimistic `updated_at`; Lost needs a reason; **Won** creates/links the buyer in `contacts`; writes timeline. |
| `handle_inbox_items(ids, via, note)` | schema | Inbox | Mark handled. |
| `rate_limit_allow(key, limit, window)` / `purge_rate_limits()` | 003 | public routes, login | DB-backed fixed-window limiter; the app **fails closed** if it errors. |
| `ai_allowed()` | 003 | Gemini wrapper | Not paused and today's tokens (India day) under budget. |
| `orphan_image_folders`, `forget_image_folders` | 005 | maintenance | Find/forget unused processed photos. |
| `article_delete_report(article)` | 013 | Delete dialog | Read-only: what deleting would remove (colours, photos, stock entries, pieces) and the plain-English reasons it must be kept (bill lines, leads, sale/return entries). |
| `delete_article(article, updated_at)` | 013 | Delete dialog | Re-checks the report, then in one transaction releases photo files for cleanup, removes the owner's own ledger rows (the only permitted ledger delete: flag `leafstar.ledger_purge` + `is_admin()` checked by `ledger_guard()`), writes them to `audit_log`, removes now-empty batches, and deletes the article (colours, variants, photo rows cascade). |
| `is_admin()`, `bootstrap_owner()` | schema/004 | everywhere | See section 2. |

### 3.7 Row Level Security in one paragraph
Every business table has RLS on, with a single policy `admin_all` (`is_admin()`), except: `profiles` (admin all + each user reads own row), `audit_log` (admin read only), `push_subscriptions` (own rows), `rate_limits` (none), `ai_usage` (admin read). Visitors never touch tables; public pages use the two views, and public writes go through server routes using the service key. DB tests (in `tests/db/`) assert `anon` cannot read or write tables, cannot execute internal functions (except `is_admin`, `norm_alias`, `size_rank`), and cannot write through the public views.

---

## 4. Application layers
- `src/app` — routes only; thin. `src/modules/<name>` — each feature's `queries.ts` (reads), `actions.ts` (server actions), `types.ts`, `components/`. `src/components` — shared UI (design system components, brand, charts, `ImageViewer`). `src/lib` — env (`env.ts` public, `env.server.ts` server with zod), supabase clients, `api.ts` (`isSameOrigin`, `jsonError`), `rate-limit.ts`, `request.ts` (client IP), `formats.ts`.
- **Next 16 Cache Components**: anything reading request data (`cookies()`, `await params/searchParams`, `useSearchParams`, `usePathname`) must sit inside `<Suspense>`. Code that reads the current time must run at request time (`await connection()`); `supabaseServer()` already does this. `"use client"` modules cannot receive function props (icons) from server components. `after()` (from `next/server`) is used for fire-and-forget owner alerts.
- Public pages revalidate (~1 day with 1 week stale, `cacheLife`), and are refreshed on demand after stock/catalogue changes.
- Server actions return `{ ok, ... } | { ok:false, message }`; they validate with zod and call `requireStaff()` first. Forms that edit a record send the `updated_at` they loaded; a mismatch shows "This changed since you opened it".
- Design enforcement: `scripts/check-design.mjs` (see HANDOFF §4) runs in CI; Tailwind's default palette/spacing/type are removed, only DESIGN.md scales exist.

## 5. Data flows (step by step)

### 5.1 Stock in (Add Stock / New article / Excel import)
1. Browser uploads photos straight to Storage via a signed URL (`/api/uploads/sign`), then `/api/images/process` downloads, rotates, strips EXIF, converts HEIC, makes thumb/medium/large WebP + blur placeholder, saves them, records `image_uploads`.
2. Form → `createArticleAction` / `addStockAction` / `commitImportAction` → one DB function (3.6) → rows in `stock_movements` (`production`, with batch) → trigger updates `variants.stock`.
3. UI shows a 15-second Undo toast → `undoStockEntryAction` → `undo_batch`.
3b. Delete (Inventory detail): `checkArticleDeleteAction` → `article_delete_report`; the owner types the article code; `deleteArticleAction` re-checks on the server and calls `delete_article`. Blocked by any bill line, lead, or sale/return entry (Archive instead).
4. Manual correction (Inventory detail): `adjustStockAction` inserts an `adjustment` movement with a required note; `undoMovementAction` reverses a manual entry once.
5. Pages that show stock are refreshed (revalidated). The public view automatically hides anything out of stock.

### 5.2 Public enquiry → Inbox → CRM → Buyer
1. Visitor submits Request Price, enquiry list, callback (call sheet), contact form, or types a phone number in chat → `/api/leads|enquiry|contact|call-tap|chat`.
2. `handleLead()` (`src/modules/site/leads.ts`): same-origin check → body ≤ 20 KB → DB rate limit (default 6 per 10 min per route+IP) → hidden "website" bot-trap field → zod → `create_lead` (one transaction).
3. `create_lead` joins the open lead for that phone or creates it, adds `lead_items`, a timeline activity and an `inbox_items` row; the response never says whether the phone was already known.
4. `after()` → `notifyOwner()` → Resend email to `alert_email` + web push to every `push_subscriptions` row. Realtime updates the sidebar badge and Inbox live.
5. Owner handles it in the Inbox (call/WhatsApp then "Mark as handled?") via `handle_inbox_items`; the lead sits on the CRM board; `move_lead` through New → Contacted → Quoted → Negotiation → Won/Lost. **Won** creates or links a `contacts` buyer (Buyers directory shows pieces bought; value only when bills carry a total).

### 5.3 Bill scanning
1. Scan page uploads files to the private `bills` bucket (`/api/bills/sign`), `createScanJobsAction` creates `bill_scan_jobs` (duplicate files flagged by SHA-256 hash).
2. The page repeatedly calls `/api/bills/process`; each call runs `processNextJob()` (`src/modules/bills/process.ts`): `claim_scan_job()` → download → `extractBill()` (`extract.ts`: photos/PDF go to Gemini as inline data; .docx via `mammoth` and .xlsx/CSV via `exceljs` become text first; old .doc/.xls refused with instructions; Gemini returns JSON checked by zod) → `finish_scan_job` (creates a draft `bills` row + `bill_items`, each matched by `match_bill_line`). Failures are stored on the job (AI problems → "AI unavailable. Press Retry, or enter the lines by hand."), never thrown. The daily maintenance job also reads up to 3 queued bills and resets stuck jobs.
3. **`match_bill_line(raw, name, colour, size)`** tries, in order: (1) full variant SKU `LS-XX-0000-AAA-S` in the line text → 1.00; (2) article code `LS-XX-0000` + the line's size (+ colour similarity > 0.6) → 0.98; (3) a learned `item_aliases` row for the normalised name+colour+size → 0.95; (4) closest article-name+colour for the same size by trigram similarity, needs ≥ 0.45, capped 0.90 → fuzzy; else unmatched. It only looks at each line's own text, never the bill header. **Confident = ≥ 0.85.** A line that names an article but no single colour/size (e.g. "Sizes S–XXL, assorted colours") stays unmatched; the review screen filters the choices to that article and offers "Split: add another line" and a manual **Split this line** button. After splitting, a summary under the lines lists the colour, size and pieces chosen and says whether they add up to the bill (the owner decides every number; nothing is suggested or deducted automatically). Split lines are ordinary variant-level `bill_items` (method `manual`). Gemini also extracts the invoice's Product ID column (`product_id`), which `extract.ts` merges into the line name so article matching sees it.
4. Review screen (`BillReview.tsx`): original bill zoomable beside editable lines (variant dropdown, pieces), stock now → after, over-stock warnings, duplicate warnings (same file hash or same bill number+date already applied), "learn" tick that saves an alias.
5. **Deduct stock** → `saveBillAction` → `save_bill_draft(..., apply=true)` → `apply_bill` (sale movements; refuses to oversell) → 15-second Undo → `undo_bill`; later undo from Bills history with confirmation. Buyer name is linked to `contacts` (created if new). Nothing is deducted without confirmation (`approveConfidentAction` only applies fully matched, confident, non-duplicate drafts).

### 5.4 Chatbot (`/api/chat` → `chatTurn()` in `src/modules/chat/engine.ts`)
1. Route: same-origin, size cap (8 MB with a photo), rate limits per IP/visitor (photo requests 6 per 10 min), zod (`message` ≤ 800, optional `articleCode`, `remember`, base64 `image`), bot-trap.
2. Optional photo: `prepareChatImage()` (`image.ts`) accepts JPEG/PNG/WEBP ≤ 5 MB, limits pixels, rotates, resizes to ≤ 1280, flattens, re-encodes as JPEG (EXIF gone), then uploads to private `chat-images/<visitor>/<session>/<uuid>.jpg`.
3. Visitor row upserted; memory read only if consent (`remember` or `consent_at`); session created or continued; last 12 messages loaded; user message stored.
4. Prompt (`prompt.ts`): rules + public catalogue + public settings + FAQ + visitor memory + (if image) IMAGE_RULES. Visitor text is marked untrusted. Structured JSON answer: `reply, needs_owner, similar_codes, image_unreadable, unanswered_question, name, memory_note`.
5. `generate()` (Gemini wrapper) → answer parsed with zod → **`guardReply()`** strips/replaces anything that states a price or names a hidden brand (the reply is replaced and `needs_owner` set) → suggestions filtered to real catalogue codes (max 3, shown as "similar to", with thumbnails).
6. Stored: assistant message, unanswered question (also on AI failure), visitor memory/name/phone only with consent. A phone number typed in chat → `create_lead` (source `chatbot`) + owner alert. AI down/paused/over budget → friendly fallback pointing to WhatsApp/call.
7. "Forget me" → `forgetVisitor()` deletes chat photos then the visitor row (cascade deletes events, sessions, messages).
8. Admin → Chats: read transcripts, flag bad answers with notes, answer "Could not answer" items (turn them into FAQ entries).

### 5.4b Owner assistant (admin only, `src/modules/assistant`)
A SEPARATE assistant from the public chatbot: own prompt (`prompt.ts`), own knowledge (`guide.ts` = what each admin screen does, written by hand; `context.ts` = a live snapshot read with the signed-in owner's own rights), own server actions (`actions.ts`, each starts with `requireStaff()`), nothing stored. The public chatbot never imports it and it never imports the public chat engine (a unit test enforces both). Two tabs in the admin drawer (`AssistantLauncher`, loaded by `AssistantLoader` in the admin layout):
- **Since last visit**: `loadBriefing()` counts what is new in every section with ONE database call, `briefing_counts(p_since)` (migration 015, security invoker), plus a few short lists. No AI. "Mark as seen" sets `profiles.last_briefed_at`; the number on the button counts only NEW things (inbox, leads, buyers, chat visitors, unanswered questions, failed scans), not things that are merely still open.
- **Ask**: `askAssistant()` sends the question, the last 8 turns and the snapshot to Gemini (`feature: "other"`, shares the daily AI budget), 40 questions per 10 minutes per person. It can only READ. Links it offers are checked against `^/admin...` before they reach the screen (`safeLinks`). When the AI is off it says so and the briefing still works.
Chats screen: one row per visitor (`loadChats`), thread built by `loadVisitorChatAction` with day dividers and "Came back after N days" (`src/lib/when.ts`, India time). A visitor and a lead with the same phone number are shown together, and the lead drawer shows the website chat.

### 5.5 Gemini wrapper (`src/modules/ai/gemini.ts`)
`generate({feature, refId, system, parts, jsonSchema, temperature, maxOutputTokens, timeoutMs})`: errors with `AiUnavailableError` (`not-configured` when key/model missing, `paused-or-budget`, `failed`); checks `ai_allowed()`; up to 4 attempts with growing back-off for 429/503/500; default timeout 55 s (abort); writes `ai_usage` for every call (ok or error text). A fake `GeminiTransport` can be injected in tests. `npm run ai:check` (`scripts/ai-check.mjs`) tests a real call and lists models that answer.

### 5.6 Owner alerts and the phone app
`notifyOwner({title, body})` (`src/modules/notify/notify.ts`): email via Resend to `business_settings.alert_email` (needs `RESEND_API_KEY`, `RESEND_FROM`) and web push via `web-push` + VAPID to `push_subscriptions` (invalid subscriptions removed). Both are optional: without keys the Inbox still fills and updates live. PWA: `src/app/manifest.ts`, `public/sw.js`, icons in `public/icons` (currently upscaled from the small logo mark). iPhone push works only from the home-screen app (iOS 16.4+). `/api/push/subscribe` stores a device registration.

### 5.7 Dashboard and search
`src/modules/dashboard/queries.ts` computes everything in SQL/TS from the ledger and tables (needs-attention list, KPIs, stock flow, stock by article, size/colour spread, restock-first by days of cover, demand vs stock, slow movers (30+ days), recent movements, data check, AI use today). Sales widgets show "not enough sales yet" instead of inventing numbers. `src/modules/search`: global admin search by SKU/article/contacts with a results page.

### 5.8 Daily maintenance (`/api/cron/maintenance`, schedule in `vercel.json`: 21:30 UTC = 03:00 IST)
Requires header with `CRON_SECRET`. Runs, each independently: `unused-photos` (orphan processed photos > 1 day), `unfinished-uploads` (staging files > 1 day), `rate-limit-counters`, `bill-scans` (reset stuck jobs, read up to 3 queued), `chat-photos` (delete chat photos older than 30 days; message text stays). Returns a per-task report.

## 6. Security model (details in `SECURITY_AUDIT.md`)
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `CRON_SECRET`, `VAPID_PRIVATE_KEY`, `RESEND_API_KEY`) are read only in server code (`env.server.ts`), never `NEXT_PUBLIC_*`, never committed (repo is public).
- Layers: proxy redirect → `requireStaff()` in every page/action → RLS `is_admin()` → DB-enforced two-step login. Public: views only + service-key server routes with zod, origin check, DB rate limit (fail closed), bot-trap, body-size caps.
- Login: 10 tries/15 min per IP and per email (DB-backed). Sign-ups are off (owner setting in Supabase).
- Production headers in `next.config.ts` (CSP incl. `frame-ancestors`, etc.; skipped in preview). A stricter nonce-based CSP is not built.
- Privacy (DPDP): notice before storing visitor data, `/privacy` page (draft; needs legal review), working "Forget me", chat photos purged at 30 days.
- Known accepted risk: `npm audit` shows 10 moderate findings (2 runtime through `exceljs → uuid`, 8 dev tooling), documented.

## 7. Testing and build tooling
- `npx vitest run tests/unit` (86 pass, 1 skipped = the 50-question chat eval; run with `RUN_CHAT_EVAL=1` and a real key). DB tests apply `schema.sql` + all migrations to a throwaway Postgres and test the ledger, apply/undo, undo-once, no-oversell, atomic Add Stock, publish rules, public-view hiding, `anon` blocked, and the 011 security baseline.
- `scripts/e2e.mjs`: starts `scripts/local-supabase.mjs` (real Supabase Auth "GoTrue" binary + PostgREST on a fresh DB; Storage, Realtime and email are **not** part of it), builds and starts the app, runs Playwright (projects: chromium, phone, admin-flows, admin-stock, admin-visual), then tears down. Needs `DATABASE_URL`, `PW_CHROMIUM_PATH`; use `--workers=1`; never run `npm run build` at the same time.
- `npm run build:preview` (`scripts/build-preview.mjs`): static export of the public routes + `/dev` pages for GitHub Pages (cacheComponents off, no admin).
- CI (GitHub Actions): lint, type-check, tests, build on every push.

## 8. Extension points (roadmap, not built)
Manufacturing (stages on `batches`, wastage), expenses/costing (fills `wholesale_price`, attaches to batches/contacts), employees and role-specific RLS (never assume "owner = any logged-in user"), sales depth (quotes, orders, GST invoices, credit using `contacts.credit_limit/payment_terms_days`), intelligence layer over permission-checked read-only views, QR labels/WhatsApp automation. Rules: every new table gets RLS in its own migration, closed to anon; never edit an applied migration; keep the ledger, `batches`, `contacts`, `locations`, `audit_log` as the backbone.

## 9. Known gaps (as of 8 Nov 2026)
Visitor page-view tracking and "welcome back"; Inbox "Anonymous" tab and bulk bar; error alerting beyond logs (Sentry); nonce-based CSP; Step 13 (Vercel deployment); Gemini model availability on the owner's free key is unresolved (see HANDOFF §8).
