# Leaf Star: set up on a new computer, and handing the project over

Two parts. **Part 1** is for the person receiving the project (follow it top to bottom, Windows wording). **Part 2** is for the owner handing it over (what to give, what never to send in a message, what to change afterwards).

You do not need to be a programmer to follow Part 1. Every step says what you should see. If a step does not show that, stop and ask.

---

## Part 1. For the person setting it up

### What this is
One application: the public website for buyers and a private admin for the owner (stock, bills, enquiries, CRM, chats). It runs on **Next.js** and stores everything in **Supabase** (database, login, photo storage). The AI parts use **Google Gemini**.

Read [`HANDOFF.md`](HANDOFF.md) first for where the project stands today, then [`ARCHITECTURE.md`](ARCHITECTURE.md) when you need detail. [`AGENTS.md`](AGENTS.md) has the rules every change must follow.

### 1. Install four things (once)
| Tool | Where | Check it worked (open **PowerShell**) |
|---|---|---|
| Git | git-scm.com | `git --version` shows a version |
| Node.js **22 or newer** (LTS) | nodejs.org | `node --version` shows `v22…` or higher |
| A code editor (VS Code) | code.visualstudio.com | opens |
| Chrome | chrome.com | opens |

### 2. Get the code
You need access to the GitHub repository first (the owner invites you, see Part 2). Then:

```powershell
git clone https://github.com/techie-29/Leafstar.git
cd Leafstar
git checkout feat/chatbot-leaf-star
npm ci
```
`npm ci` installs the exact packages the project was tested with. It takes a few minutes. You should end with no red errors.

> The latest finished work is on the branch `feat/chatbot-leaf-star`. Ask the owner whether it has been merged into `main`; if it has, use `main` instead.

### 3. Choose how you will run it

**Option A: your own practice database (recommended for anyone who is not the owner).** Nothing you do can touch the real business. Create a **new, free Supabase project** (supabase.com, choose Mumbai) just for yourself and use its keys in step 5.

**Option B: the real business database.** Only if the owner explicitly allows it. Any change you make (stock, bills, leads) is real. Prefer Option A.

### 4. Prepare the database (Option A: once per new Supabase project)
1. In your Supabase project open **SQL Editor**.
2. Run these files **one at a time, in this order**, each in full. Each must finish with no error before you run the next:
   `supabase/schema.sql`, then every numbered file in `supabase/` in order: `003_hardening.sql`, `004_step2.sql`, `005_image_system.sql` … up to `015_owner_assistant.sql`.
   The exact list and what each does is in [`MANUAL_SETUP.md`](MANUAL_SETUP.md) section A. (Open each file in VS Code, copy everything, paste into the SQL Editor, press Run.)
3. In Supabase → **Authentication → Providers → Email**: turn **sign-ups OFF**, set minimum password length to **12**.
4. Create your admin login: Authentication → Users → **Add user** (email and a long password, tick "auto confirm").
5. Make that user the owner: in the SQL Editor run  
   `select bootstrap_owner('your-email@example.com', 'Your Name');`  
   then `select * from profiles;` should show one row with role `owner`.
6. Storage → check these buckets exist (the SQL creates them): `article-images`, `site-media`, `bills`, `chat-images`.

### 5. Add your keys
1. In the project folder, copy the template:
   ```powershell
   copy .env.example .env.local
   ```
2. Open `.env.local` in VS Code and fill it in:

| Name | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | same page. **Secret. Server only.** |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` on your computer |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Google AI Studio (aistudio.google.com). Run `npm run ai:check` to find a model that answers on your key |
| `CRON_SECRET` | any long random text, 24+ characters |
| `VAPID_*`, `RESEND_*` | **Optional.** Only for phone and email alerts. Leave empty to start |

3. **Never** commit `.env.local`, post it in a chat, or email it. It is already ignored by Git.

Without Gemini keys everything still works except bill reading and the chat assistants, which say they are resting.

### 6. Run it
```powershell
npm run dev
```
- Website: http://localhost:3000
- Admin: http://localhost:3000/admin (sign in with the user from step 4)

You should see the Leaf Star home page, and after signing in the Dashboard. The first time, add a test article under **Add stock** to see the catalog fill in.

### 7. Before you change anything
Run the checks. They are the same ones GitHub runs:
```powershell
npm run lint
npm run typecheck
npm run check:design
npm test
```
All four must pass. The full set (`npm run verify`) also builds the site. The end-to-end browser tests (`npm run test:e2e`) need a local Postgres and are described in [`README.md`](README.md).

Work on a **new branch** (`git checkout -b my-change`), commit small, and open a pull request. Do not push straight to `main`.

### Known issues you may meet
- **`npm run build` fails on a Windows PC with `Cannot read properties of null (reading 'useState')`**, while it passes on the test server. Not yet explained. Try, in the same PowerShell window: `$env:NODE_ENV="production"; npm run build`, and delete the `.next` folder first. If it still fails, tell the owner.
- **The footer shows no Facebook link or "Since" year, and saving Business details fails**: migration `014_footer_details.sql` has not been run in that Supabase project.
- **The assistant button shows no numbers**: migration `015_owner_assistant.sql` has not been run.
- **Bills or chat say the assistant is resting**: the Gemini key or model is missing, wrong, or today's AI limit (Admin → Settings) is used up.
- **A red "two children with the same key" message** was fixed. Run `git pull`.

---

## Part 2. For the owner: handing the project over

### Give access (each by invitation, never by sharing your own login)
| What | How |
|---|---|
| The code | GitHub repository → Settings → Collaborators → add their GitHub account (give **Write** access, not Admin) |
| The real database (only if needed) | Supabase → Organization → Team → invite their email |
| Hosting (when it exists) | Vercel → Team → invite |
| Domain and email sending | Add them in the domain provider and Resend only when they need it |

### Give the secrets safely
The keys in `.env.local` are the passwords to your business. Rules:
- Send them through a **password manager's share feature**, or tell them in person or over a call. **Not** WhatsApp, email, screenshots or chat.
- Give a new person **their own** keys where possible: their own Supabase practice project, and their own Gemini key. Share the real service-role key only with someone you fully trust.
- Never put a key in the code or in GitHub.

### Things to hand over in writing
- The Supabase project URLs (real and `leafstar-test`) and who owns the Supabase account.
- Which Gemini key and model the live site uses.
- The list of migrations already run in each Supabase project (see [`MANUAL_SETUP.md`](MANUAL_SETUP.md) section A). Today: everything up to `014` is run in the real project; **`015` still needs running** in both projects.
- The open items in [`HANDOFF.md`](HANDOFF.md): stand-in photos to replace, missing phone/WhatsApp/GSTIN, the business-name spelling, the unexplained local build error.

### After the helper is done (or if you stop trusting a device)
1. Remove them from GitHub, Supabase and Vercel.
2. **Rotate** every key they saw: Supabase service-role key (Project Settings → API), Gemini key (Google AI Studio), `CRON_SECRET`, Resend key. Put the new values in `.env.local` on your computer and later in Vercel.
3. Change your admin password (Admin → Settings → Change password) if you shared it at any point.

### Recommended: set the project up so handovers are easy
- Merge the finished branch into `main` so a new person clones one branch.
- Keep this file and [`MANUAL_SETUP.md`](MANUAL_SETUP.md) up to date whenever a new database file is added.
