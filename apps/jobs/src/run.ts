import { processSource, processUserUrl, recheckSource, withTimeout } from "@grantly/pipeline";
import { renderWithBrowser } from "./browser";
import { db, type Job } from "./db";
import { env } from "./env";
import { ocrDocument } from "./jobs/document";
import { sendReminders } from "./jobs/reminders";
import { pdfToText } from "./ocr";

const MAX_ATTEMPTS = 3;
const PER_JOB_MS = 3 * 60000;
const load = { render: renderWithBrowser, pdfText: async (b: Buffer) => (await pdfToText(b)).text };

async function handle(job: Job): Promise<Record<string, unknown>> {
  switch (job.type) {
    case "ingest_source":
      return processSource(db, String(job.payload.source_id), load, job.payload.use_llm !== false);
    case "recheck_source":
      return recheckSource(db, String(job.payload.source_id), load);
    case "ingest_url": {
      const r = await processUserUrl(db, job.user_id!, String(job.payload.url), load, true);
      return { ...r, note: r.kind };
    }
    case "ocr_document":
      return ocrDocument(job);
    case "send_reminders":
      return sendReminders();
  }
}

async function runOne(): Promise<boolean> {
  const { data, error } = await db.rpc("claim_job", { worker_types: null });
  if (error) throw error;
  const job = (data as Job[] | null)?.[0];
  if (!job) return false;
  const t0 = Date.now();
  try {
    const result = await withTimeout(handle(job), PER_JOB_MS, job.type);
    await db.from("jobs").update({ status: "done", result, llm_used: !!result.llm_used, finished_at: new Date().toISOString(), error: null }).eq("id", job.id);
    console.log(`done   ${job.type} ${job.id} ${Date.now() - t0}ms ${result.note ?? ""}`);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    const retry = job.attempts < MAX_ATTEMPTS;
    await db
      .from("jobs")
      .update(retry ? { status: "queued", error: msg, run_after: new Date(Date.now() + 2 ** job.attempts * 30 * 60000).toISOString() } : { status: "failed", error: msg, finished_at: new Date().toISOString() })
      .eq("id", job.id);
    if (job.type === "ocr_document" && !retry) await db.from("documents").update({ extract_status: "failed" }).eq("id", job.payload.document_id);
    console.error(`${retry ? "retry " : "failed"} ${job.type} ${job.id}: ${msg}`);
  }
  return true;
}

async function scheduleRechecks() {
  const now = Date.now();
  const { data: sources } = await db.from("sources").select("id, kind, check_every, last_fetched_at").eq("active", true).neq("kind", "index");
  const { data: soon } = await db.from("scholarships").select("source_id, deadline").eq("status", "published").not("source_id", "is", null);
  const near = new Set((soon ?? []).filter((s) => s.deadline && new Date(s.deadline).getTime() - now < 30 * 86400000 && new Date(s.deadline).getTime() > now).map((s) => s.source_id));
  let n = 0;
  for (const s of sources ?? []) {
    const m = String(s.check_every ?? "7 days").match(/(\d+)\s*day/);
    const every = (near.has(s.id) ? 1 : m ? Number(m[1]) : 7) * 86400000 - 3600000;
    if (s.last_fetched_at && now - new Date(s.last_fetched_at).getTime() < every) continue;
    const { count } = await db.from("jobs").select("id", { count: "exact", head: true }).eq("type", "recheck_source").in("status", ["queued", "running"]).contains("payload", { source_id: s.id });
    if (!count) {
      await db.from("jobs").insert({ type: "recheck_source", payload: { source_id: s.id } });
      n++;
    }
  }
  return n;
}

async function maybeQueueReminders() {
  const istHour = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }));
  const todayIst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  if (istHour < 7 && process.env.FORCE_REMINDERS !== "1") return false;
  const { data: run } = await db.from("system_runs").select("details").eq("name", "reminders").maybeSingle();
  if ((run?.details as { day?: string } | null)?.day === todayIst && process.env.FORCE_REMINDERS !== "1") return false;
  await db.from("jobs").insert({ type: "send_reminders", payload: { day: todayIst } });
  await db.from("system_runs").upsert({ name: "reminders", last_run_at: new Date().toISOString(), ok: true, details: { day: todayIst } });
  return true;
}

async function main() {
  const started = Date.now();
  const summary: Record<string, unknown> = {};
  try {
    const { data: swept } = await db.rpc("sweep_jobs", { stale_minutes: 10 });
    summary.swept = swept;
    summary.rechecks_queued = await scheduleRechecks();
    summary.reminders_queued = await maybeQueueReminders();
    let processed = 0;
    while (Date.now() - started < env.budgetMs && (await runOne())) processed++;
    summary.processed = processed;
    await db.from("system_runs").upsert({ name: "jobs", last_run_at: new Date().toISOString(), ok: true, details: summary });
    console.log("summary", JSON.stringify(summary));
  } catch (e) {
    summary.error = (e as Error).message;
    await db.from("system_runs").upsert({ name: "jobs", last_run_at: new Date().toISOString(), ok: false, details: summary });
    console.error("run failed", e);
    process.exitCode = 1;
  }
}

main();
