# Going live (Step 13)

You click the buttons; nothing here needs code. Do these in order. Nothing goes live until you finish the last section.

## 0. Before you start
- [ ] You have read [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md) and `MANUAL_SETUP.md`.
- [ ] You have a **domain name** (or are happy with the free `something.vercel.app` address for now).
- [ ] You agree to move from the free test setup to paid plans where needed (Supabase Pro for daily backups; Vercel Pro if the site earns money, since the free Hobby plan is for non-commercial use).

## 1. The real Supabase project
1. Create a **new** Supabase project for the business (not `leafstar-test`). Choose the region closest to your buyers (India: Mumbai). `vercel.json` pins the website's server functions to Mumbai (`bom1`) too, so each page does not cross the world to reach the database; without it Vercel runs them in the USA and every database call costs a few hundred milliseconds, which adds up to a slow admin.
2. SQL Editor → run, in this order, each file once: `schema.sql`, `003_hardening.sql`, `004_…` through `011_security.sql` (the full list is in `MANUAL_SETUP.md` section A).
3. SQL Editor → `select bootstrap_owner('your-email@example.com', 'Your Name');` after creating your user in Authentication → Users.
4. Authentication → Sign In / Providers → **turn off "Allow new users to sign up"**.
5. Authentication → URL Configuration: **Site URL** = your live address; **Redirect URLs** = `https://your-domain/auth/confirm` and `https://your-domain/admin/update-password`.
6. Database → Backups: confirm daily backups are on (Pro plan).
7. Storage: confirm the buckets `article-images`, `site-media`, `bills` exist (the schema creates them). `bills` must stay **private**.
8. Project Settings → API: copy the URL, anon key and service-role key. Keep the service-role key to yourself.

## 2. Vercel
1. vercel.com → Add New → Project → import `techie-29/Leafstar`. Framework: Next.js (detected). Do not change build settings.
2. Settings → Environment Variables (Production), add every name below. **Never** put these in GitHub.

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | same page, secret |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain` (no slash at the end) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Google AI Studio |
| `CRON_SECRET` | a long random text you make up (32+ characters) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `npx web-push generate-vapid-keys`; subject like `mailto:you@yourdomain.com` |
| `RESEND_API_KEY`, `RESEND_FROM` | Resend account; sender on a domain you verified there |

3. Do **not** add `ALLOW_DEV_PAGES`.
4. Deploy. The maintenance job (`vercel.json`) runs once a day on its own; Vercel sends `CRON_SECRET` automatically.
5. Settings → Domains → add your domain and follow the two DNS lines Vercel shows. HTTPS is automatic.

## 3. Settings inside the app
Open `https://your-domain/admin`:
- [ ] Settings → Business details: real phone, WhatsApp, address, Instagram, **alert email**.
- [ ] Settings → Brands: mark which brands may show on the website.
- [ ] Settings → Account: turn on two-step login.
- [ ] Chats → Your answers: your real answers (payment terms, delivery, returns, samples).
- [ ] Inbox → "Turn on alerts here" on your phone (after installing the app to the Home Screen).

## 4. Content
- [ ] Replace the placeholder wording in `src/modules/site/content.ts` (home, about, process) with your real story; the owner-approved text is committed through GitHub.
- [ ] Add your real articles and photos (Add stock). Hide anything not ready.
- [ ] Review the Privacy page text with whoever advises you on legal matters; it is a draft.

## 5. Go-live checklist (from the plan)
- [ ] Build on Vercel is green; the service-role and Gemini keys exist only in Vercel.
- [ ] Real Supabase has backups; sign-ups are off; your two-step login works.
- [ ] Every earlier "Your check" list has been approved, including the ones that needed real services: photo upload, bill scan, chatbot answers, email and phone alerts.
- [ ] The domain loads over HTTPS in both themes, on a real phone.
- [ ] One real article with real photos is live in the catalog.
- [ ] Request Price, the callback form and the chatbot each reach the Inbox, an email and a phone notification.
- [ ] One real bill is scanned, applied and undone.
- [ ] Repeat the security checks against the live address: logged out, `/admin` redirects to login; `/dev/styleguide` shows "not found"; View Source shows no keys, prices, hidden brands or stock numbers; a public form sent quickly gets the "too many requests" message.
- [ ] GitHub Pages preview can stay (free) or be switched off.

## If something breaks
Vercel → your project → Logs shows one line per error with a short code; the same code is shown on the error screen. Send me that code.
