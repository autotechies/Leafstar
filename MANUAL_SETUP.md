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
| 6 | `supabase/007_*.sql` and later: listed here as Claude adds them | |

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
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | run `npx web-push generate-vapid-keys` (Step 9) |
| `EMAIL_API_KEY`, `ALERT_FROM_EMAIL` | email service account (Step 9; see section F) |

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
