# Deploy Grantly (about 30 minutes)

Grantly runs on three free services:

| Service | What it does | You deploy it? |
|---|---|---|
| **GitHub** | Holds the code. Its Actions feature runs the background jobs (re-checking scholarships, retrying document reads, reminder emails) on a schedule | Push the code, add secrets |
| **Supabase** | Database, file storage for documents, sign-in | Create a project, paste one SQL file |
| **Vercel** | The website and all its API routes (matching, uploads, reading documents and links) | Import the repo |

Everything is done in a browser except the optional "run it locally" section, which works in plain Windows PowerShell. No Linux or WSL needed.

Keep a notes file open for the values you copy along the way. Never paste keys into chat or commit them to GitHub.

---

## Step 1 · Get the code into your GitHub repo (2 min)

If Claude pushed the code for you, open your repo on github.com, check that you can see folders like `apps`, `packages` and `supabase`, and skip to step 2.

Otherwise, in **PowerShell**, after installing Git for Windows:

```powershell
cd $HOME\Downloads
Expand-Archive grantly.zip -DestinationPath .
cd grantly
git init -b main
git add .
git commit -m "Grantly"
git remote add origin https://github.com/YOUR-USERNAME/grantly.git
git push -u origin main
```

A browser window asks you to sign in to GitHub the first time. Approve it.

---

## Step 2 · Supabase database (6 min)

1. On supabase.com, create a **New project**. Choose region **South Asia (Mumbai)**, and save the database password in your notes. Wait about 2 minutes for it to start.
2. Go to **SQL Editor → New query**.
3. On GitHub, open `supabase/setup.sql` in your repo, click **Raw**, then select all (`Ctrl+A`) and copy.
4. Paste into the SQL Editor and click **Run**. If it warns about destructive operations, confirm. You should see *Success. No rows returned*. This creates every table, the security rules, the private `documents` storage bucket and 33 real scholarships.
   - Run it **only once**. To refresh scholarship data later, run `supabase/seed.sql` instead, which is safe to repeat.
5. Go to **Project Settings → API Keys** and copy these into your notes:
   - **Project URL** (also under Project Settings → Data API)
   - **Publishable key** (or the legacy *anon* key)
   - **Secret key** (or the legacy *service_role* key). This one is private: it only goes into Vercel and GitHub secrets.

---

## Step 3 · Vercel website (6 min)

1. On vercel.com, go to **Add New → Project** and import your `grantly` repo.
2. **Root Directory**: click *Edit* and choose `apps/web`. Leave everything else as it is (Vercel detects Next.js and pnpm).
3. Open **Environment Variables** and add:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable / anon key |
| `SUPABASE_SECRET_KEY` | Supabase secret / service_role key |
| `NEXT_PUBLIC_APP_URL` | `https://placeholder.vercel.app` for now; you fix it in step 5 |
| `GEMINI_API_KEY` | Your Gemini key (optional) |
| `GROQ_API_KEY` | Your Groq key (optional) |
| `OPENROUTER_API_KEY` | Your OpenRouter key (optional) |
| `SETUP_CHECK_TOKEN` | Any random word, e.g. `kiwi-4821`. It protects the setup-check page |

4. Click **Deploy** and wait about 2–3 minutes.
5. Copy your site address (e.g. `https://grantly-abc.vercel.app`). Then:
   - Go to **Settings → Environment Variables**, set `NEXT_PUBLIC_APP_URL` to that address and save.
   - Go to **Deployments → ⋯ on the latest one → Redeploy**.

---

## Step 4 · Tell Supabase where your site is (2 min)

In Supabase, go to **Authentication → URL Configuration**:

- **Site URL**: your Vercel address
- **Redirect URLs**: add both of these
  - `https://YOUR-SITE.vercel.app/**`
  - `http://localhost:3000/**`

Without this, sign-in emails link to the wrong place.

---

## Step 5 · GitHub background jobs (4 min)

1. In your repo, go to **Settings → Secrets and variables → Actions → New repository secret** and add each of these:

| Secret | Value |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SECRET_KEY` | Supabase secret / service_role key |
| `APP_URL` | Your Vercel address |
| `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` | Same as Vercel (optional) |
| `RESEND_API_KEY` | Resend key, for reminder emails (optional) |

2. Go to the **Actions** tab. If GitHub asks, click *I understand my workflows, enable them*.
3. Click **Grantly background jobs → Run workflow → Run workflow**. It takes about 3–4 minutes and should end green.

From then on it runs by itself every 6 hours, and at 8 AM IST for reminders. GitHub turns off scheduled runs in repos with no activity for 60 days. Any push, or one click on *Run workflow*, turns them back on.

---

## Step 6 · Check everything (3 min)

1. Open `https://YOUR-SITE.vercel.app/setup-check?token=YOUR_SETUP_CHECK_TOKEN`.
2. Every red item has a **Fix:** line telling you exactly what to do. Work top to bottom, then click **Re-check**.
3. Click **Deep check**. This tests each AI provider and the document reader on the live server.
4. Sign in on the site with your email (step 7 explains email limits).
5. Make yourself admin. In Supabase **SQL Editor**, run:

   ```sql
   update public.profiles set is_admin = true where email = 'you@example.com';
   ```

6. Refresh the site. An **Admin** link appears in the sidebar.

---

## Step 7 · Sign-in for other people (pick one, 10 min)

Supabase's built-in email sender only allows **a few emails per hour**. That's enough for you to test, but not for a demo with other people signing up. Pick one of these:

**A. Google sign-in (recommended, free, no domain needed)**

1. Go to console.cloud.google.com and create a project.
2. Go to **APIs & Services → OAuth consent screen**. Choose *External*, enter an app name and your email, then save.
3. Go to **Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - **Authorized redirect URI**: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`. You can find this exact address in Supabase under **Authentication → Sign In / Providers → Google**.
4. Copy the Client ID and Client Secret into Supabase under **Authentication → Sign In / Providers → Google**, then click Enable and Save.
5. In Vercel, add `NEXT_PUBLIC_GOOGLE_AUTH` = `true`, then redeploy.

**B. Your own email sender via Resend (needs a domain you own)**

1. In Resend, add and verify your domain.
2. In Supabase, go to **Authentication → Emails → SMTP Settings**:
   - Host `smtp.resend.com`
   - Port `465`
   - User `resend`
   - Password: your Resend API key
   - Sender: an address on your domain

Without a verified domain, Resend only delivers to your own address. That's fine for testing reminders, but not for other users.

**Optional, for email sign-in:** to show a 6-digit code as well as the link, go to **Authentication → Emails → Magic Link** in Supabase and add `Your code: {{ .Token }}` to the template. The sign-in link works without this change.

---

## Run it on your laptop (Windows, 5 min)

You need Node.js 22 LTS and Git for Windows. Then, in PowerShell:

```powershell
npm install -g pnpm
git clone https://github.com/YOUR-USERNAME/grantly.git
cd grantly
pnpm install
copy apps\web\.env.example apps\web\.env.local
notepad apps\web\.env.local
```

In Notepad, fill in the same values as in Vercel. Keep `NEXT_PUBLIC_APP_URL=http://localhost:3000`. Save, then run:

```powershell
pnpm dev
```

Open http://localhost:3000. Your laptop uses the same Supabase project as the live site.

To check the code before pushing:

```powershell
pnpm typecheck
pnpm test
```

You don't need to run the background jobs locally, because GitHub runs them. If you want to, copy `apps\jobs\.env.example` to `apps\jobs\.env`, fill it in, and run `pnpm jobs`. Document OCR retries need Linux tools, so those are skipped on Windows. Everything else works.

---

## Before you demo

- Open the Supabase dashboard **the day before**. Free projects pause after about a week without activity.
- Run `/setup-check` and the **Deep check**.
- Run the GitHub workflow once by hand so the "last background run" is fresh.
- Set up Google sign-in (step 7A) if anyone other than you will sign up.
- Have a clean, well-lit photo of a certificate ready for the upload demo. Scanned PDFs and phone photos both work, but sharper images read better.

---

## What happens when something fails

Every flow has an end point the student can act on within about 45 seconds. Nothing waits forever.

| Situation | What the student sees | What happens behind the scenes |
|---|---|---|
| Document is a text PDF | Values appear in a few seconds | Text is read in the browser and parsed on the server. No OCR needed |
| Scanned PDF or photo | Values appear in about 5–20 s | Browser turns pages into images and the server runs OCR (25 s cap) |
| OCR fails or is too slow | A form to type the values, with the file already saved | A background job retries with full OCR tools. If it reads something, the student is asked to confirm |
| Password-protected PDF | Asked for the password, which never leaves the device | — |
| Pasted link can't be read (login wall, JavaScript-only page) | A short form to track the scholarship manually | A background job retries with a real browser |
| An AI provider is rate-limited or down | Nothing visible | The next provider is tried (Gemini → Groq → OpenRouter), then rules only. The failing provider is paused for a few minutes |
| A job crashes mid-run | — | The sweeper resets it at the next background run. Each job is tried at most 3 times |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Every page redirects to `/setup-check` | The Supabase variables are missing in Vercel. Add them and redeploy |
| Sign-in email link opens the wrong site or says expired | Fix step 4 (Site URL and Redirect URLs), then request a new email |
| "Too many emails" when signing in | Supabase's built-in email limit. Wait, or do step 7 |
| No Admin link | Run the `update profiles set is_admin = true …` SQL with the email you signed in with, then refresh |
| Setup-check says the AI model is not found | Providers rename models. Set `GEMINI_MODEL`, `GROQ_MODEL` or `OPENROUTER_MODEL` in Vercel to a current model name from the provider's model list |
| GitHub workflow says secrets are not set | Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in step 5 |
| Vercel build fails | Check that Root Directory is `apps/web`. Open the build log and send the first red error line to Claude |
