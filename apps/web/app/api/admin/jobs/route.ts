import { NextResponse } from "next/server";
import { normalizeUrl } from "@grantly/core";
import { processSource, withTimeout } from "@grantly/pipeline";
import { pdfText } from "@/lib/pdf-server";
import { assertAdmin } from "@/lib/admin";
import { adminClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const b = await req.json().catch(() => ({}));
  const db = adminClient();

  if (b.action === "recheck" && b.source_id) {
    await db.from("jobs").insert({ type: "recheck_source", payload: { source_id: b.source_id } });
    return NextResponse.json({ ok: true });
  }
  if (b.action === "reminders") {
    await db.from("jobs").insert({ type: "send_reminders", payload: {} });
    return NextResponse.json({ ok: true });
  }

  const url = normalizeUrl(String(b.url ?? ""));
  if (!url) return NextResponse.json({ error: "bad url" }, { status: 400 });
  const kind = ["index", "detail", "pdf"].includes(b.kind) ? b.kind : url.endsWith(".pdf") ? "pdf" : "detail";
  const { data: src, error } = await db
    .from("sources")
    .upsert({ url, kind, tier: b.tier ?? "B", provider: b.provider ?? null, check_every: b.check_every ?? "7 days", active: true }, { onConflict: "url" })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (kind === "index") {
    await db.from("jobs").insert({ type: "ingest_source", payload: { source_id: src.id, use_llm: b.use_llm !== false } });
    return NextResponse.json({ ok: true, queued: true, note: "Index pages are crawled by the background job (runs every 6 hours, or press Run now on GitHub Actions)." });
  }
  try {
    const r = await withTimeout(processSource(db, src.id, { pdfText }, b.use_llm !== false), 50000, "Ingest");
    await db.from("jobs").insert({ type: "ingest_source", payload: { source_id: src.id }, status: "done", result: r, finished_at: new Date().toISOString(), llm_used: !!(r as { llm_used?: boolean }).llm_used });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    await db.from("jobs").insert({ type: "ingest_source", payload: { source_id: src.id, use_llm: b.use_llm !== false }, error: (e as Error).message });
    return NextResponse.json({ ok: true, queued: true, note: `Couldn't finish now (${(e as Error).message}). Queued for the background job, which has a full browser.` });
  }
}
