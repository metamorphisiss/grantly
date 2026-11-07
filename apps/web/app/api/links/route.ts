import { NextResponse } from "next/server";
import { normalizeName, normalizeUrl, slugify } from "@grantly/core";
import { TimeoutError, processUserUrl, withTimeout } from "@grantly/pipeline";
import { pdfText } from "@/lib/pdf-server";
import { adminClient, getUser, userClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const DAILY_LIMIT = 10;
const BUDGET_MS = 40000;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const canonical = normalizeUrl(String(b.url ?? ""));
  if (!canonical) return NextResponse.json({ error: "That doesn't look like a web link." }, { status: 400 });

  const db = await userClient();
  const { data: existing } = await db.from("scholarships").select("slug").eq("canonical_url", canonical).limit(1).maybeSingle();
  if (existing) return NextResponse.json({ kind: "existing", slug: existing.slug });

  const admin = adminClient();
  const since = new Date(Date.now() - 86400000).toISOString();
  const { count } = await admin.from("jobs").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("type", "ingest_url").gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) return NextResponse.json({ error: "You've added a lot of links today. Try again tomorrow." }, { status: 429 });

  const { data: job } = await admin.from("jobs").insert({ type: "ingest_url", user_id: user.id, payload: { url: canonical }, status: "running", started_at: new Date().toISOString(), attempts: 1 }).select("id").single();
  const finish = (status: "done" | "queued" | "failed", result: unknown, error?: string) =>
    admin.from("jobs").update({ status, result, error: error ?? null, finished_at: status === "queued" ? null : new Date().toISOString(), run_after: new Date(Date.now() + 60000).toISOString() }).eq("id", job!.id);

  try {
    const r = await withTimeout(processUserUrl(admin, user.id, canonical, { pdfText }, true), BUDGET_MS, "Reading the page");
    if (r.kind === "unreadable") {
      await finish(r.retryable ? "queued" : "done", r, r.reason);
      return NextResponse.json({ ...r, queued: r.retryable });
    }
    await finish("done", r);
    return NextResponse.json(r);
  } catch (e) {
    const reason = e instanceof TimeoutError ? "The page took too long to read" : "Something went wrong reading the page";
    await finish("queued", { kind: "unreadable", reason }, (e as Error).message);
    return NextResponse.json({ kind: "unreadable", reason, retryable: true, queued: true });
  }
}

export async function PUT(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const canonical = normalizeUrl(String(b.url ?? ""));
  const name = String(b.name ?? "").trim().slice(0, 200);
  if (!canonical || !name) return NextResponse.json({ error: "Add a name and a link." }, { status: 400 });
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(b.deadline ?? "") ? b.deadline : null;
  const amount = b.amount ? Number(b.amount) : null;
  const { data, error } = await adminClient()
    .from("scholarships")
    .insert({
      slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      name_key: normalizeName(name),
      source_url: canonical,
      canonical_url: canonical,
      apply_url: canonical,
      amount_min: amount,
      amount_max: amount,
      coverage: amount ? "fixed" : null,
      deadline,
      deadline_type: deadline ? "fixed" : "unknown",
      status: "published",
      visibility: "private",
      owner_id: user.id,
      track_only: true,
      verification: { level: "unverified", sources: [canonical], note: "Added manually by you" },
    })
    .select("slug")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slug: data.slug });
}

export async function PATCH(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (b.name) patch.name = String(b.name).slice(0, 200);
  if (b.deadline !== undefined) {
    patch.deadline = /^\d{4}-\d{2}-\d{2}$/.test(b.deadline ?? "") ? b.deadline : null;
    patch.deadline_type = patch.deadline ? "fixed" : "unknown";
  }
  if (b.amount !== undefined) patch.amount_max = patch.amount_min = b.amount ? Number(b.amount) : null;
  const { error } = await adminClient().from("scholarships").update(patch).eq("slug", b.slug).eq("owner_id", user.id).eq("visibility", "private");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
