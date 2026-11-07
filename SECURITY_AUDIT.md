# Leaf Star — security review (Step 12)

Scope: the code in this repository, the Supabase schema (migrations 001–011) and the build settings.
Method: reading the code, searching it for the patterns that usually go wrong, and writing tests that fail if a rule breaks.
**Not covered:** your real Supabase and Vercel projects (settings there are yours to check, see "What you must do"), and a hands-on penetration test by a person. This is a careful review, not a guarantee.

## What was checked, and the result

| # | Question | Result | Proof |
|---|----------|--------|-------|
| 1 | Is every database table protected by Row Level Security? | Yes | Database test fails the build if any table is without it |
| 2 | What can the public website (anonymous visitor) read? | Only the two views `public_catalog` and `public_settings`, read-only | Database test |
| 3 | Can anyone write through those views? | **Was possible, now fixed** (see Finding 1) | Database test + migration `011_security.sql` |
| 4 | Can the public run database functions? | Only three harmless helpers (`is_admin`, `norm_alias`, `size_rank`) | Database test |
| 5 | Is the powerful "service role" key kept off the browser? | Yes: every file that uses it imports `server-only`, so the build fails if browser code ever imports it | Build |
| 6 | Does every admin page and action check the person is signed in staff? | Yes. Every exported server action calls `requireStaff`; every admin API route calls `apiStaff`; the scheduled job needs `CRON_SECRET` (compared in constant time) | Code review + searches |
| 7 | Are public forms protected from bots and floods? | Same-site check, database-backed rate limit (fails closed), input checked by zod, hidden bot-trap field, size limits | Browser tests |
| 8 | Can the chatbot leak prices, stock numbers or hidden brands? | It is never given them, told not to, and every reply is checked again before a visitor sees it | Unit tests + the 50-question run (needs your key) |
| 9 | Can a visitor trick the chatbot with "ignore your instructions"? | The visitor's text is marked untrusted, and the output check does not depend on the model obeying | Unit tests; 50-question run includes such attempts |
| 10 | Are uploads limited? | Bills and photos upload only into the signed-in person's own folder; type and size limits; the bills bucket is private | Unit tests |
| 11 | Are secrets in the repository? | None. `.env*` is git-ignored except `.env.example`; a scan for key-like strings found nothing | Search |
| 12 | Are the developer test pages (`/dev/*`) reachable on the live site? | **Now closed** in production unless `ALLOW_DEV_PAGES=1` | Code |
| 13 | Browser protections (headers) | Added: no framing, no content sniffing, strict referrer, camera/microphone/location off, HSTS, and a base Content-Security-Policy | Code |
| 14 | Search engines | `robots.txt` blocks admin, API, test pages; `sitemap.xml` lists public pages and visible articles only | Code |
| 15 | Third-party packages | See "Dependencies" | `npm audit` |

## Finding 1 (fixed): public views could be written to

Supabase gives every new table or view in the `public` schema full rights for the anonymous role and for any signed-in user, by default. The earlier step that removes those rights ran before the two public views were created, so the views kept `INSERT`, `UPDATE` and `DELETE`. A simple view such as `public_settings` can be written through, and it runs with its owner's rights, which skip Row Level Security. On a real Supabase project that would have let anyone on the internet change your business name, phone number or address on the website.

Fix: `supabase/011_security.sql` removes those rights, grants read-only again, and changes the defaults so anything created later starts closed. The database tests now fail if this ever comes back. **Run `011_security.sql` in both Supabase projects.**

## Dependencies

`npm audit` reports 10 moderate findings and no high or critical ones.
- **Runtime (2):** `uuid` inside `exceljs` (reading the Excel stock file). The flaw only matters when a program passes its own buffer to `uuid`; this app never does, and `exceljs` is used only by signed-in staff. Accepted. The automatic fix would downgrade `exceljs` to a version from 2020, which is worse.
- **Build tools only (8):** the code-checking tools (`eslint`, `typescript-eslint`, `minimatch`). They run on a developer's machine and in GitHub, never on the live site. Accepted until the tool authors release a fix; re-check every few months with `npm audit`.

## Known limits (not fixed, by design or by lack of access)

- **Content-Security-Policy is partial.** It blocks framing, plug-ins and form posts to other sites, but does not restrict scripts, because Next.js needs inline scripts. A stricter policy needs per-request nonces; worth doing later, not needed to launch.
- **Visitor tracking.** The assistant stores a visitor record only when someone chats. Page-view tracking is not built, which is the privacy-friendly choice; say if you want it.
- **True missed-call capture** needs a phone provider (Exotel, MyOperator and similar); the site only knows when someone taps Call.
- **Two-step login** exists (Settings); turning it on for every staff account is recommended.
- **Staff roles.** Only the owner and managers exist. If you add people later, the roles and their access need a second review.
- **Real-service behaviour** (Supabase Storage uploads, Gemini answers, Resend email, phone push) could not be tested in the build sandbox. Please test each once with real keys.

## What you must do

1. Run `supabase/011_security.sql` (and every earlier migration) in **both** Supabase projects.
2. In Supabase → Authentication → Providers: **turn off "Allow new users to sign up"** so nobody else can create an account. (Row Level Security already stops a stranger reading anything, but there is no reason to allow it.)
3. Turn on two-step login for your own account in Settings.
4. Keep `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `VAPID_PRIVATE_KEY` and `CRON_SECRET` only in Vercel's environment settings, never in chat, email or the repository. If one is ever exposed, make a new one and replace it.
5. In Vercel, do **not** set `ALLOW_DEV_PAGES`.
6. Set a spending limit on your Gemini and Resend accounts; the app also has its own daily AI limit and pause switch (Settings).

## Chat photos (Step 14)
- Server re-decodes every upload with sharp (format allow-list, pixel limit, 5 MB cap, 8 MB request cap), re-encodes to JPEG (EXIF stripped).
- Stored in private bucket `chat-images` (no public/anon policy); 30-day purge in the daily maintenance job; removed on "Forget me".
- Photo requests rate-limited to 6 per 10 minutes per IP. Suggestions are filtered to real catalogue codes, so the model cannot invent links.
