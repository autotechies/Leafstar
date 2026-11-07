# Leaf Star — Things only the owner can do

Claude builds the application. This file collects everything that needs **you**: accounts, keys, files, photos and decisions. It grows as steps land. Tick items off as you go. Never paste a key into chat or commit it: keys live in `.env.local` (on your computer) and in Vercel's settings (at the end).

Legend: **[now]** needed before the app can run for real · **[content]** your information or photos · **[go-live]** only at the final hosting step.

---

## A. Database (Supabase) — run in the SQL Editor, in this order
Run each file completely, one at a time. Each must finish with no error. Do it in the **real** project and in the **leafstar-test** project.

| # | File | Status |
|---|------|--------|
| 1 | `supabase/schema.sql` | done in real project |
| 2 | `supabase/003_hardening.sql` | confirm it was run |
| 3 | `supabase/004_step2.sql` | run |
| 4 | `supabase/005_image_system.sql` | run (added in Step 3) |
| 5 | `supabase/006_stock_entries.sql` | run (added in Step 4) |
| 6 | `supabase/007_inventory.sql` | run (added in Step 5) |
| 7 | `supabase/008_public_leads.sql` | run (added in Step 6) |
| 8 | `supabase/009_bill_scanning.sql` | run (added in Step 7) |
| 9 | `supabase/010_crm.sql` | run (added in Step 10) |
| 10 | `supabase/011_security.sql` | run (added in Step 12; closes a real hole, do not skip) |
| 11 | `supabase/012_chat_images.sql` | run (added in Step 14; creates the private `chat-images` bucket) |

## B. Supabase settings [now]
- [ ] Authentication → sign-ups **OFF**; password minimum length **12**; leaked-password protection ON if your plan has it.
- [ ] Authentication → Emails → "Reset password" template link:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/admin/update-password`
- [ ] Authentication → URL configuration: Site URL = your live address; add `http://localhost:3000/**` for local use.
- [ ] Your owner user exists and `select * from profiles;` shows one row with role `owner`.
- [ ] Storage → buckets `article-images`, `site-media` (public) and `bills` (private) exist (the SQL creates them; check).
- [ ] After first login: Settings → Account → turn on two-step login (authenticator app).

## C. Your computer (only if you want to run the app yourself)
1. Install Node.js LTS (v22 or newer) and Git.
2. `git clone https://github.com/techie-29/Leafstar.git` then `cd Leafstar` and `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the values (section D).
4. `npm run dev` and open http://localhost:3000.

## D. Keys and settings for `.env.local` (and Vercel at go-live)
| Name | Where to get it |
|------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | same page; secret, server only |
| `GEMINI_API_KEY` | Google AI Studio → Get API key (Step 7/8 need it) |
| `GEMINI_MODEL` | a current Gemini Flash model name from Google AI Studio |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally; your domain live |
| `CRON_SECRET` | any long random string you make up (32+ characters) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | run `npx web-push generate-vapid-keys` (phone alerts) |
| `VAPID_SUBJECT` | `mailto:` plus your email, for example `mailto:you@yourdomain.com` |
| `RESEND_API_KEY`, `RESEND_FROM` | Resend account; `RESEND_FROM` like `Leaf Star <alerts@yourdomain.com>` on a domain you verified in Resend |

## E. GitHub
- [ ] Repo `techie-29/Leafstar` is public; Settings → Pages → Source = **GitHub Actions**.
- [ ] Settings → Secrets and variables → Actions: `PREVIEW_SUPABASE_URL` and `PREVIEW_SUPABASE_ANON_KEY` = the **leafstar-test** project's URL and anon key (safe to expose; never the real project).

## F. Accounts to create
- [ ] **Email service** (Step 9) — Resend (free tier is enough to start). Verify your sending domain there. Needed so alert emails arrive.
- [ ] **Google AI Studio** key (Steps 7, 8). Set a spending limit in Google Cloud.
- [ ] **Error monitoring** (Step 12) — Sentry free plan, if you want it; Claude wires it, you paste the DSN.
- [ ] **Vercel** account (Step 13) and a paid Supabase plan before real data.
- [ ] **Domain** name and where it is registered (Step 13).

## G. Content only you have [content]
- [ ] Business details typed into Admin → Settings: legal name, GSTIN, address, phones, WhatsApp, email, Instagram, alert email.
- [ ] Brands, and which ones show on the website (Settings → Brands).
- [ ] FAQ and policies (Settings → FAQ): minimum order, dispatch time, delivery areas, payment terms, customisation. The chatbot answers only from these.
- [ ] Logos as SVG (or at least 2000 px wide), light and dark versions.
- [ ] Say which factory photos are really yours. Real factory, workers, machinery and process photos/videos.
- [ ] Real trust numbers (years, pieces made, buyers served) and certifications — nothing is invented.
- [ ] Your story, how you work with buyers, how a deal closes (rough notes are fine).
- [ ] Article photos: every colour, portrait 4:5, plain background, long side at least 1600 px.
- [ ] Excel file of current stock (article, colour, size, pieces).
- [ ] Many real sample bills in every format you use (photo, PDF, Word, Excel).

## H. Decisions I made for you (change any of them by telling me)
- Lots: each article has a minimum order (default 50 pieces). A fixed lot size is optional per article; empty means any quantity at or above the minimum.
- Types: Shirt and Pant. Sizes S, M, L, XL, XXL. 16 common colours are one tap in Add Stock; any other colour can be added.
- Excel import columns: Article code, Article name, Type, Brand, Fabric, Pattern, Colour, Colour code, Colour hex, Size, Pieces (download the template from Add Stock).

## H1. Public website: placeholders and draft wording (Step 6)
- Every photo on Home and About is a labelled grey placeholder ("Photo to be added"). Send real photos and I will swap them in (or tell me to add an admin screen for editing them).
- All wording on Home, About and the "trust" section above the footer is in ONE file: `src/modules/site/content.ts`. It is drafted only from facts you told me (own factory, wholesale lots, GST registered, credit for regular buyers, shirts and pants). Please read it and change anything that is not true for you. There are no numbers, awards or certificates on purpose.
- The Home trust bar shows four facts, not numbers. Give me real numbers (years, pieces made, buyers served) when you are ready.
- Business phone, WhatsApp, email, address and Instagram come from Admin → Settings. Until you fill them in, the site simply hides those links.
- The Privacy page is a plain-language draft. Please have it checked against your own practice (and a lawyer if you wish).

## H2. Decisions I still need from you
- [ ] Lots: fixed pack (e.g. 50 per lot) or any quantity at or above the minimum?
- [ ] Shirt types you make; colour names to preload.
- [ ] Should Home/About text and photos be editable from the admin?

## I. Tests on your phone (I cannot do these)
- [ ] `/dev/image-lab` on the GitHub Pages preview: pinch, double-tap, swipe, back gesture; try an iPhone photo and a cheaper Android phone.
- [ ] Public site as a buyer, in both themes.
- [ ] Install the app to the home screen; confirm a push notification arrives.

## J. Go-live [go-live] (Step 13)
See "Go-live checklist" in `BUILD_PLAN.md`.

## I. Bill scanning (Step 7)

- Run `009_bill_scanning.sql` in both Supabase projects.
- Set `GEMINI_API_KEY` and `GEMINI_MODEL`, and make sure AI is not paused in Admin → Settings.
- Create the private `bills` Storage bucket if it is not already there (see section on Storage buckets).
- Try 5–10 of your real bills (photo, PDF, Word, Excel) at Admin → Bills → Scan. Wrongly matched lines you correct are learned for next time.
- Old `.doc` and `.xls` files are refused with instructions: re-save them as `.docx` or `.xlsx`.
- Upload and reading could not be tested against real Storage or real Gemini in the build sandbox; please test with real bills.

## J. Website assistant (Step 8)

- No new migration: it uses the chat tables from earlier steps. Needs `GEMINI_API_KEY` and `GEMINI_MODEL` (same as bill scanning).
- Admin → Chats → **Your answers**: add your real answers (payment terms, delivery, returns, samples, custom sizes). The assistant only answers from your articles and these answers, and never gives prices or exact stock. Anything it cannot answer appears under **Could not answer**; write the answer once and it learns.
- Run the 50-question check with your real key: `RUN_CHAT_EVAL=1 GEMINI_API_KEY=… GEMINI_MODEL=… npx vitest run tests/unit/chat-eval.test.ts` (prints a pass/fail table). It could not be run in the build sandbox because it needs your key.
- Visitors: memory is off unless they tick "Remember my details", and "Forget me" deletes everything stored about them. Mention this in your Privacy page (the draft already covers it generally; please have it reviewed).
- If the AI is paused, out of budget or down, the widget says so honestly and points to WhatsApp / call; the question is still logged.

## K. Owner alerts and the phone app (Step 9)

- Alerts need no migration. Set the keys in section D, then in **Admin → Settings** fill the private **alert email** (where new-enquiry emails go).
- Without the keys nothing breaks: the Inbox still fills and shows live; only the email and phone alerts are off.
- Phone app: open the admin site on your phone, then **Add to Home Screen** (iPhone: Safari → Share → Add to Home Screen; Android: Chrome menu → Install app). Open it from the home screen, go to **Inbox**, and tap **Turn on alerts here**. iPhone alerts only work from the home-screen app (iOS 16.4 or newer).
- The home-screen icon is made from your small logo mark, so it looks soft. Send a larger square logo (at least 512 × 512) and replace `public/icons/icon-192.png` and `icon-512.png`.
- Alerts and the live Inbox could not be tested on a real phone or against real Resend in the build sandbox; please test once with a real enquiry.

## L. CRM (Step 10)

- Run `010_crm.sql` in both Supabase projects.
- Leads from the website appear in **New**. Drag a card (computer) or use its Stage menu (phone). **Lost** asks for a reason; **Won** creates the buyer (or links the existing one) in **CRM → Buyers**.
- "Value" in the Buyers list shows only when your bills carry a total amount; "Pieces bought" always works.
- Please check the stage wording (New, Contacted, Quoted, Negotiation, Won, Lost) suits how you work.

## M. Photo search in the chat (Step 14)

- Run `012_chat_images.sql` in both Supabase projects (creates the private `chat-images` bucket).
- Visitors can attach one photo (JPG/PNG/WEBP, up to 5 MB). It is shrunk in their browser and again on the server, saved as a plain JPEG (location/camera details removed), and the assistant suggests up to 3 *similar* articles from your catalogue, never "exact".
- Photos are kept **30 days** in a private bucket (a daily job deletes them); "Forget me" deletes them at once. Add one sentence about this to your Privacy page and have it reviewed.
- Needs a real Gemini key; photo matching quality could not be tested in the build sandbox. Try it with a few shirt/pant photos.
