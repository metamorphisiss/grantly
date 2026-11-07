# Grantly

Scholarship discovery that tells students what they can actually win, why, and what to do today.

**To deploy, follow [DEPLOY.md](./DEPLOY.md).**

```
apps/web            Next.js site + API routes (deploys to Vercel)
apps/jobs           Background jobs run by GitHub Actions (re-checks, OCR retries, reminders)
packages/core       Matching engine, ranking, rule-based extractors (unit tested)
packages/pipeline   Page fetching, cleaning, LLM fallback chain, ingestion
supabase/setup.sql  One-paste database setup: schema, security rules, storage, 33 real scholarships
data/               Research source for the scholarship data (with links to every source)
.github/workflows   jobs.yml (scheduled background jobs), ci.yml (typecheck and tests)
```

## How it works

- **Matching** is deterministic: every verdict (Eligible, Almost, Need info, Not eligible) comes with a reason, criterion by criterion.
- **Scholarship data** is real. 33 scholarships were researched on 7 Nov 2026 from official and partner sources, and each one stores its sources and a "checked on" date. Many Indian schemes for 2026-27 closed in Sept–Oct, so closed ones show when they usually reopen.
- **Extraction** (admin ingest and student-pasted links) works in this order:
  1. Rules and site templates.
  2. A chain of free LLM providers, only for missing fields: Gemini → Groq → OpenRouter. Each call is limited to a small snippet, cached, budgeted per provider, and must quote evidence that exists on the page.
  3. Rules only, if every provider fails.
- **Documents** are read in the browser if they're text PDFs. Scanned pages are turned into images in the browser and OCRed on the server (tesseract.js, bundled English, Hindi and Marathi) with a time cap. A background retry with full Tesseract runs on GitHub Actions. Manual entry is always available. Documents are never sent to an LLM, and ID numbers are never stored.
- **Sign-in** uses Supabase Auth: email link or code, with optional Google.

## Develop

```powershell
pnpm install
copy apps\web\.env.example apps\web\.env.local
pnpm dev
pnpm test
pnpm typecheck
```

To update scholarship data, edit `data/build_dataset.py`, then run `python data/build_dataset.py` and `python scripts/gen_seed.py`. Run the new `supabase/seed.sql` in the Supabase SQL Editor.
