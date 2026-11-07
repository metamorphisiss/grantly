import { NextResponse } from "next/server";
import { pingProvider, providersFromEnv } from "@grantly/pipeline";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Status = "pass" | "warn" | "fail";
interface Check {
  id: string;
  group: string;
  label: string;
  status: Status;
  detail: string;
  fix?: string;
}

const REQUIRED = [
  ["NEXT_PUBLIC_SUPABASE_URL", "Supabase → Project Settings → API → Project URL"],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "Supabase → Project Settings → API Keys → anon / publishable key"],
  ["SUPABASE_SECRET_KEY", "Supabase → Project Settings → API Keys → service_role / secret key"],
  ["NEXT_PUBLIC_APP_URL", "Your site address, e.g. https://grantly-yourname.vercel.app (http://localhost:3000 locally)"],
] as const;

async function authorised(req: Request) {
  const token = process.env.SETUP_CHECK_TOKEN;
  if (!token) return true;
  return new URL(req.url).searchParams.get("token") === token;
}

export async function GET(req: Request) {
  if (!(await authorised(req))) return NextResponse.json({ error: "Add ?token=YOUR_SETUP_CHECK_TOKEN to the address." }, { status: 401 });
  const deep = new URL(req.url).searchParams.get("deep") === "1";
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  for (const [k, where] of REQUIRED) {
    add({ id: `env-${k}`, group: "Environment variables", label: k, status: process.env[k] ? "pass" : "fail", detail: process.env[k] ? "Set" : "Missing", fix: process.env[k] ? undefined : `Add it in Vercel → Project → Settings → Environment Variables (or apps/web/.env.local locally). Value: ${where}. Redeploy after adding.` });
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const reqOrigin = new URL(req.url).origin;
  if (appUrl && !appUrl.startsWith(reqOrigin) && !reqOrigin.includes("localhost")) {
    add({ id: "env-appurl-match", group: "Environment variables", label: "NEXT_PUBLIC_APP_URL matches this site", status: "warn", detail: `Set to ${appUrl}, but you're visiting ${reqOrigin}`, fix: "Set NEXT_PUBLIC_APP_URL to this site's address and redeploy, so sign-in emails link back here." });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (url && secret) {
    const db = createClient(url, secret, { auth: { persistSession: false } });
    const { count, error } = await db.from("scholarships").select("id", { count: "exact", head: true });
    if (error) {
      const missing = /does not exist|schema cache/i.test(error.message);
      const badKey = /invalid|jwt|api key/i.test(error.message);
      add({ id: "db", group: "Database", label: "Tables created", status: "fail", detail: error.message, fix: missing ? "Open Supabase → SQL Editor, paste the whole of supabase/setup.sql and click Run." : badKey ? "SUPABASE_SECRET_KEY looks wrong. Copy the service_role / secret key again." : "Check the Supabase URL and that the project is not paused (free projects pause after a week idle; open the dashboard to wake it)." });
    } else {
      add({ id: "db", group: "Database", label: "Tables created", status: "pass", detail: "Connected" });
      add({ id: "seed", group: "Database", label: "Scholarship data loaded", status: (count ?? 0) > 0 ? "pass" : "fail", detail: `${count ?? 0} scholarships`, fix: (count ?? 0) > 0 ? undefined : "Run supabase/seed.sql in the SQL Editor." });
      const { count: admins } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("is_admin", true);
      add({ id: "admin", group: "Database", label: "Admin account", status: (admins ?? 0) > 0 ? "pass" : "warn", detail: `${admins ?? 0} admin(s)`, fix: (admins ?? 0) > 0 ? undefined : "Sign in once on the site, then in Supabase SQL Editor run: update profiles set is_admin = true where email = 'you@example.com';" });
      const { data: bucket, error: bErr } = await db.storage.getBucket("documents");
      add({ id: "storage", group: "Database", label: "Document storage bucket", status: bucket ? "pass" : "fail", detail: bucket ? "documents bucket exists" : bErr?.message ?? "missing", fix: bucket ? undefined : "Re-run supabase/setup.sql; it creates the private 'documents' bucket." });
      const { error: aErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1 });
      add({ id: "auth", group: "Sign-in", label: "Supabase Auth reachable with secret key", status: aErr ? "fail" : "pass", detail: aErr ? aErr.message : "OK", fix: aErr ? "Use the service_role / secret key, not the anon key, for SUPABASE_SECRET_KEY." : undefined });

      const { data: runs } = await db.from("system_runs").select("*");
      const jobsRun = runs?.find((r) => r.name === "jobs");
      const ageH = jobsRun ? (Date.now() - new Date(jobsRun.last_run_at).getTime()) / 3600000 : Infinity;
      add({ id: "cron", group: "Background jobs (GitHub Actions)", label: "Last background run", status: ageH < 8 ? "pass" : ageH < 30 ? "warn" : "fail", detail: jobsRun ? `${ageH.toFixed(1)} hours ago` : "Never ran", fix: ageH < 8 ? undefined : "On GitHub: Actions tab → 'Grantly background jobs' → Run workflow. Check the repo secrets SUPABASE_URL and SUPABASE_SECRET_KEY are set." });
      const stuckSince = new Date(Date.now() - 15 * 60000).toISOString();
      const { count: stuck } = await db.from("jobs").select("id", { count: "exact", head: true }).eq("status", "running").lt("started_at", stuckSince);
      const { count: failed } = await db.from("jobs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
      const { count: queued } = await db.from("jobs").select("id", { count: "exact", head: true }).eq("status", "queued");
      add({ id: "jobs", group: "Background jobs (GitHub Actions)", label: "Job queue health", status: (stuck ?? 0) > 0 ? "warn" : "pass", detail: `${queued ?? 0} queued, ${stuck ?? 0} stuck, ${failed ?? 0} failed this week`, fix: (stuck ?? 0) > 0 ? "Stuck jobs are reset automatically by the next background run. Run the workflow now to clear them." : undefined });
    }
  }

  const providers = providersFromEnv();
  add({ id: "llm-config", group: "AI fallback (optional)", label: "LLM providers configured", status: providers.length ? "pass" : "warn", detail: providers.length ? providers.map((p) => `${p.name} (${p.model})`).join(", ") : "None. Extraction runs on rules only.", fix: providers.length ? undefined : "Optional: add GEMINI_API_KEY, GROQ_API_KEY and/or OPENROUTER_API_KEY in Vercel." });
  if (deep) {
    for (const p of providers) {
      const r = await pingProvider(p);
      add({ id: `llm-${p.name}`, group: "AI fallback (optional)", label: `${p.name} responds`, status: r.ok ? "pass" : "warn", detail: `${r.detail} (${r.ms} ms)`, fix: r.ok ? undefined : /404|not found|model/i.test(r.detail) ? `Model name may have changed. Set ${p.name.toUpperCase()}_MODEL to a current model from the provider's model list.` : /401|403|key/i.test(r.detail) ? `Check ${p.name.toUpperCase()}_API_KEY.` : "Provider is busy or rate limited; the chain will skip it and use the next one." });
    }
    try {
      const { ocrSelfTest } = await import("@/lib/ocr");
      const r = await ocrSelfTest();
      add({ id: "ocr", group: "Document reading", label: "OCR engine loads on the server", status: r.ok ? "pass" : "warn", detail: `${r.ok ? "Read test image" : `Read '${r.read}'`} in ${r.ms} ms`, fix: r.ok ? undefined : "OCR ran but misread the test image. Uploads still fall back to manual entry." });
    } catch (e) {
      add({ id: "ocr", group: "Document reading", label: "OCR engine loads on the server", status: "fail", detail: (e as Error).message.slice(0, 200), fix: "Redeploy. If it persists, check that apps/web/ocr-data exists in your repo. Uploads still work: students type values manually and the background job retries OCR." });
    }
  }
  add({ id: "google", group: "Sign-in", label: "Google sign-in button", status: process.env.NEXT_PUBLIC_GOOGLE_AUTH === "true" ? "pass" : "warn", detail: process.env.NEXT_PUBLIC_GOOGLE_AUTH === "true" ? "Shown" : "Hidden (email sign-in only)", fix: process.env.NEXT_PUBLIC_GOOGLE_AUTH === "true" ? undefined : "Optional. See DEPLOY.md, step 'Google sign-in'." });

  return NextResponse.json({ checks, deep, at: new Date().toISOString() });
}
