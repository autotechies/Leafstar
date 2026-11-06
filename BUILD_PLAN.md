# LEAF STAR — Build Plan (v3, Claude builds)

Claude writes the code in this repository, one step at a time. There is no deadline: a step is done when it is right, checked and approved — not when it is fast.

**Hosting while building:** no paid host yet. The code lives in a public GitHub repo. A static preview build (pages that need no server — the styleguide, the image lab, the public catalog and article pages) publishes automatically to GitHub Pages on every push, so the owner can open a real link and test on a phone throughout. Anything that needs a server — login, Add Stock, bill scanning, the chatbot, alerts — cannot run on that preview; Claude tests those locally and shows screenshots, recordings and a written report. Full hosting (Vercel + the live Supabase project) is set up once, at Step 13.

After each step: Claude pushes to GitHub; the owner opens the GitHub Pages preview (where that step shows there) and works through that step's **Your check** list; for server-only steps the owner reviews Claude's report and recordings instead. The owner says "approved" or sends what is wrong. The next step never starts before approval.
Rules for every step are in `AGENTS.md`; every look and layout is in `DESIGN.md`.
Claude's workspace cannot reach the real Supabase, Gemini, or the owner's phone. So Claude tests everything it can on a local copy of the database and in a browser it controls, and says plainly what it could not test; those things are proven on the GitHub Pages preview or, for server features, once Step 13 provides real hosting.

**Every step ends with the same done-list:** lint, type-check, tests and build pass; Playwright screenshots of every changed page at 375 / 768 / 1024 / 1440 px in both themes were reviewed against `DESIGN.md`; the consistency checklist (DESIGN.md §10) passed; the work is committed and pushed.

---

## Step 0 — Setup (owner)
1. Install Node.js LTS and Git (only needed if you want to run things yourself; Claude does the building).
2. Supabase: run `supabase/schema.sql` (done), then `supabase/003_hardening.sql` (done), then `supabase/004_step2.sql` (with Step 2) in the SQL Editor. Choose "Run and enable RLS" if asked. Each must finish with no error.
3. Supabase → Authentication: sign-ups OFF; password minimum length 12; leaked-password protection if your plan offers it. The owner user exists and `bootstrap_owner` has been run (check: `select * from profiles;` shows one row, role `owner`). Turn on two-step login (TOTP) for your account once Step 2 is live.
4. Create a **separate second Supabase project** named "leafstar-test" (free is fine). Run the same files in it, in the same order. It never holds real data; the GitHub Pages preview's catalog/image-lab pages read from this project, never the real one.
5. **Public** GitHub repository `leafstar` (public so GitHub Pages is free), with GitHub Pages turned on in its settings, building from GitHub Actions. Claude is given access when asked. Because the repo is public, no key or secret is ever committed. Only the **test** project's URL and anon key go into the repo's GitHub Actions secrets (Settings → Secrets and variables → Actions) as `PREVIEW_SUPABASE_URL` and `PREVIEW_SUPABASE_ANON_KEY`, for building the preview; both are safe to expose (see `AGENTS.md` §2 and §7). Settings → Pages → Source must be set to **GitHub Actions**.
6. For later: when Step 13 arrives, create a Vercel project connected to this same repo for the real, server-backed site. Nothing to do here yet.
7. Your own `.env.local` (for anything you run yourself) holds the real project's URL, anon key and service-role key, plus `GEMINI_API_KEY`, `GEMINI_MODEL`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`. Never paste these in chat, and never into the repo.

## Step 0.5 — Design sign-off (owner + Claude)
Owner reviews the preview and `DESIGN.md`, asks for changes, approves. Transparent light/dark logos (SVG preferred) delivered. No coding starts before this.

## Content checklist (collect in parallel; Claude asks again in the step that needs it)
| What | Needed by |
|---|---|
| Two transparent logos (light and dark theme) | Step 1 |
| Business details: legal name, GSTIN, address, phone, WhatsApp, email, Instagram, alert email | Step 2 |
| Brand names and which are shown on the website | Step 2 |
| Excel file of current stock (article, colour, size, pieces) | Step 4 |
| Photos for 1–2 articles first: every colour, portrait 4:5, plain background, long side ≥ 1600px | Step 3–4 |
| Factory, workers, machinery, process photos and videos (real) | Step 6 |
| Real trust numbers (years, pieces made, buyers served) and certifications | Step 6 |
| Your story, how you work with buyers, how a deal closes (rough notes; Claude writes the copy for approval) | Step 6 |
| **Many real sample bills in every format you use** (photo, PDF, Word, Excel) | Step 7 |
| FAQ and policies: minimum order, dispatch time, delivery areas, payment terms, customisation | Step 8 |
| Domain name and where it is registered | Step 13 |

---

## Step 1 — Foundation, themes, components, tests
**Claude builds:** Next.js project (App Router, strict TypeScript, Tailwind configured to the DESIGN.md scales); the two-theme system with a no-flash cookie; fonts; Supabase clients (browser, server, service-role server-only); env validation; generated database types; every shared component from DESIGN.md §5; a `/dev/styleguide` page showing each in both themes; the test setup (Vitest, Playwright with the screenshot matrix, axe), a database test harness that applies `schema.sql` + `003_hardening.sql` to a throwaway Postgres, and a GitHub Actions workflow.
**Your check:** open `/dev/styleguide` on desktop and phone; toggle the theme and refresh (no flash); everything readable in both themes; gold used only for actions; `.env.local` and keys are not in GitHub; the GitHub Action is green.

## Step 2 — Admin login, shell and Settings
**Ask first:** business details and brand list.
**Claude builds:** login with password reset, route protection, logout, the admin shell, Settings (business details, Brands with show-on-website switch, FAQ/policies list, alert email, AI budget and pause switch showing today's usage).
**Before checking (owner):** run `supabase/004_step2.sql` in the SQL Editor of both projects. Optional but recommended, so reset links work on any device: Supabase → Authentication → Emails → "Reset password" template, set the link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/admin/update-password`. Without it, open the reset email on the same phone or computer that asked for it.
**Your check:** login and Settings need a server, so they are NOT on the GitHub Pages preview; review Claude's screenshots and test report now, and try them for real at Step 13. In the report: `/admin` while logged out redirects to login; wrong password refused, 10 wrong tries block for 15 minutes; reset link sets a new password; Settings saves are checked and never overwrite a change made elsewhere; brands hide/show; FAQ answers; AI limit and pause; two-step login on and off.

## Step 3 — Image system and viewer
**Built (migration `005_image_system.sql`, run it in both projects):** direct-to-storage upload with signed URLs, server processing (HEIC conversion, rotation, thumb/medium/large WebP, blur placeholder, EXIF stripped), `ProcessedImage`, the shared `ImageViewer` (library chosen and justified), and `/dev/image-lab`.
**Your check (on your own phone):** open `/dev/image-lab`; upload a large phone photo and an iPhone photo if you have one; images blur then sharpen without jumping; pinch, double-tap, drag, swipe; back gesture closes the viewer and the page behind doesn't move; swatches switch photos instantly. Tell Claude what feels slow. Repeat on a cheaper Android phone if you can.

## Step 4 — Add Stock and Excel import
**Ask first:** (1) is a lot a fixed pack or any quantity at or above the minimum? (2) shirt types you make; (3) colour names to preload; (4) the Excel stock file and its columns.
**Claude builds:** the three tabs (New article five-step form with live preview; Add to existing article; Import from Excel with template and row-by-row errors), using the single-call database functions so a failure leaves nothing behind; draft autosave and unsaved-changes warning; a 15-second Undo toast after saving.
**Your check:** create one real article end to end; duplicate code gives a friendly error; publishing without a photo is refused; close the tab mid-form and your draft returns; add 20 pieces to one colour/size; undo it within 15 seconds; import 3 template rows with one deliberate mistake (nothing saved until fixed), then your real file and spot-check ten rows.

## Step 5 — Inventory
**Claude builds:** list (table/cards), filters, detail page with the colour × size grid, adjust dialog (note required), movement history with **Undo** per manual entry, archive/publish-hide, add colours/sizes later, replace photos.
**Your check:** every filter works; change a cell by -3 with a note (refused without a note); undo that entry once (second try refused); two browser tabs adjusting the same cell both count; an article with history offers Archive, not Delete; photos open in the viewer on your phone.

## Step 6 — Public website
**Ask first:** hero and About photos/videos; real trust numbers; your story and how a deal closes; should Home/About content be editable from the admin?
**Claude builds:** navbar, footer, Home, About, Catalog, article page, enquiry list, Request Price, call sheet, Contact, Privacy, 404, and **migration 007** (a single database function that creates a lead + items + activity + inbox item together and handles repeat enquiries from the same phone). All writes go through rate-limited, origin-checked server routes.
**Your check:** go through the site as a buyer on your phone; colour dots switch photos instantly; out-of-stock articles/colours/sizes and hidden brands appear nowhere; no price anywhere (also in View Source); enquiry list with three articles sends one request; a second request from the same phone joins the open lead; Call sheet and callback form work; WhatsApp link opens a pre-filled chat; both themes on every page.

## Step 7 — Bulk bill scanning
**Ask first:** many real sample bills in every format you use. Claude re-checks the format rules (§10 of AGENTS.md) against them.
**Claude builds:** direct upload of many files, the queue, short-request processing plus the scheduled maintenance route, Gemini extraction through the shared wrapper (usage log, budget, fallback), matching, review screen, alias learning, apply with 15-second Undo, history with later undo, manual line entry when AI is unavailable.
**Your check:** upload 20+ bills at once; one bad file fails alone with Retry; review three bills line by line against paper; correct one match and see it learned; apply one, stock falls exactly, Undo restores exactly; same bill twice is flagged; a bill that would oversell is blocked; a manual stock change and a bill applied close together both count; switch the AI pause on and confirm scanning degrades politely; read Claude's honest accuracy report; look at Gemini usage afterwards.

## Step 8 — Chatbot
**Ask first:** FAQ and policies (also entered in Settings).
**Claude builds:** the widget, `/api/chat`, consent and memory, "welcome back", Inquire with AI, lead capture, Forget me, rate limits, the Gemini wrapper limits, friendly fallback, `/admin/chats` with flagging and unanswered questions; then writes and runs ~50 buyer questions (price traps, hidden-brand probes, rule-breaking attempts) and shows every question, answer and pass/fail.
**Your check:** read every answer; ask for a price five ways (never a number); ask about a hidden brand (no confirmation); ask for exact stock (refused); "ignore your rules" (polite refusal); returning visitor is welcomed back; chat lead appears in the Inbox; switch Gemini off and see the WhatsApp fallback.

## Step 9 — Inbox, alerts, installable app
**Ask first:** the alert email address; create the email-service account.
**Claude builds:** Inbox (tabs, grouping, actions, live badge), `notifyOwner()` with email and web push, the installable app, install guidance for Android and iPhone.
**Your check:** from a second device submit a callback, a Request Price and a chat lead; each shows in the Inbox live, arrives by email and buzzes your installed app; same phone number groups into one contact; Call/WhatsApp then "Mark as handled?"; items older than 24 hours show red.

## Step 10 — CRM
**Claude builds:** board, drawer, timeline, follow-ups, manual leads, Won → buyer, buyers directory.
**Your check:** leads from earlier steps are in New; drag through every stage (phone: dropdown); overdue follow-up highlighted; Lost asks for a reason; a Won lead creates a buyer.

## Step 11 — Dashboard and global search
**Claude builds:** the Dashboard exactly as in DESIGN.md §8 and AGENTS.md §14, and the global SKU/article search with a result page.
**Your check:** three numbers match Inventory/Inbox by hand; every tile opens a pre-filtered page; 7/30/90 days change the charts; empty widgets are honest; searching a full variant SKU shows stock, movements, bills and leads.

## Step 12 — Security and quality pass
**Claude does:** the full audit in AGENTS.md §15–16 with a written report (checked, changed, could not verify), error monitoring set up, dependency audit, accessibility scan, performance pass, sitemap, metadata, error pages.
**Your check:** read the report; log out and try admin addresses; View Source shows no keys, prices, hidden brands or stock numbers; submit a public form rapidly (rate limit kicks in); slow-connection test; keyboard-only test.

## Step 13 — Real hosting and deploy
This is where paid, server-backed hosting is set up for the first time. Before this step, everything ran as a static GitHub Pages preview plus Claude's own local testing; from here on the site is a full application.
**Ask first:** domain; confirmation to move from the free test setup to paid Supabase and Vercel plans.
**Claude prepares:** a Vercel project connected to the repo, the production variable checklist (the real Supabase project's keys, Gemini key, VAPID keys, email key — none of which ever touched the public repo), Supabase redirect URLs for the real project, a plan and backup check, the cron schedule for maintenance, a short README; the owner clicks the buttons Claude lists. Nothing goes live without the owner's confirmation.
**Your check:** the go-live checklist below.

### Go-live checklist
- [ ] Vercel project builds from the repo with every real environment variable set, and the service-role and Gemini keys appear only in Vercel's settings, never in the repo
- [ ] The real Supabase project (not "leafstar-test") is on a plan with backups; sign-ups are off; the owner's two-step login works
- [ ] Every step's **Your check** list has been approved, including the server-only ones that could only be reviewed from screenshots and recordings until now — re-test those live for real this time
- [ ] The domain points at Vercel and loads over HTTPS in both themes
- [ ] A real article, with real photos, is published and visible on the live catalog
- [ ] Request Price, the callback form and the chatbot each reach the Inbox, an email and a phone notification
- [ ] One real bill is scanned, applied and undone successfully
- [ ] The security checks from Step 12 are repeated against the live address, not the preview
- [ ] GitHub Pages can be turned off once the owner no longer needs the preview (or left running harmlessly alongside — it costs nothing)

## Step 14 — Chatbot image input (after launch is stable)
**Claude builds:** one photo per message (JPG/PNG/WEBP, ≤ 5 MB), Gemini describes it, the bot suggests the closest catalog articles ("similar to", never "exact"), EXIF stripped, 30-day retention, counted in the AI budget, rate limited, same no-price/no-hidden-brand rules.
**Your check:** send photos of clearly different styles and a blurry one; an unreadable image gives a polite message; no price or hidden article ever appears.

---

## No deadline — what matters instead
There is no day count on this plan. Steps run in order, each waiting for your approval; the pace is set by real content arriving and by how long a check takes, not by a clock. Bulk bill scanning and the chatbot are the two steps most likely to need extra rounds of fixing — give them the room they need. Security (Step 12) and the undo/ledger guarantees are never shortened to save time. If you ever want to know where things stand, ask for a status report rather than checking it against a schedule.
