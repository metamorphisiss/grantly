import { extractScholarship, normalizeName, normalizeUrl, slugify, trustReport, type Draft } from "@grantly/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashText, htmlToText, tidy } from "./clean";
import { FetchError, safeGet } from "./fetch";
import { fillMissing, providersFromEnv, type Attempt } from "./llm";
import { supabaseLlmStore } from "./store";
import { runTemplate, templateToText } from "./templates";

export interface Page {
  url: string;
  title: string | null;
  text: string;
  links: { href: string; text: string }[];
  hash: string;
  viaTemplate: boolean;
}

export interface LoadOptions {
  templateName?: string | null;
  render?: (url: string) => Promise<string | null>;
  pdfText?: (buf: Buffer) => Promise<string>;
}

export async function loadPage(url: string, opts: LoadOptions = {}): Promise<Page> {
  const r = await safeGet(url);
  const isPdf = r.contentType.includes("pdf") || url.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    if (!opts.pdfText) throw new FetchError("PDF needs the background reader");
    const t = tidy(await opts.pdfText(r.body));
    if (t.length < 120) throw new FetchError("PDF looks scanned; queued for OCR");
    return { url, title: null, text: t, links: [], hash: hashText(t), viaTemplate: false };
  }
  if (r.contentType && !/html|text\/plain/.test(r.contentType)) throw new FetchError("Unsupported file type");
  let html = r.body.toString("utf8");
  let cleaned = htmlToText(html, url);
  if (cleaned.text.length < 300 && opts.render) {
    const rendered = await opts.render(url);
    if (rendered) {
      html = rendered;
      cleaned = htmlToText(html, url);
    }
  }
  if (cleaned.text.length < 120) throw new FetchError(opts.render ? "Page has almost no readable text" : "Page needs a browser to read");
  const tpl = runTemplate(new URL(url).hostname, opts.templateName ?? null, html);
  if (tpl) {
    const text = tidy(`# ${tpl.title ?? cleaned.title ?? ""}\n\n${templateToText(tpl)}\n\n${cleaned.text}`);
    return { url, title: tpl.title ?? cleaned.title, text, links: cleaned.links, hash: cleaned.hash, viaTemplate: true };
  }
  return { url, title: cleaned.title, text: cleaned.text, links: cleaned.links, hash: cleaned.hash, viaTemplate: false };
}

function method(m: string | undefined, viaTemplate: boolean) {
  return m === "llm" ? "llm" : viaTemplate ? "template" : "rules";
}

export async function extractWithFallback(db: SupabaseClient, page: Page, opts: { allowLlm: boolean; budgetMs?: number }) {
  const draft = extractScholarship({ text: page.text, title: page.title });
  const res = await fillMissing(draft, page.text, {
    providers: providersFromEnv(),
    store: supabaseLlmStore(db),
    allow: opts.allowLlm,
    dailyTokenCapPerProvider: Number(process.env.LLM_DAILY_TOKEN_CAP ?? 150000),
    totalBudgetMs: opts.budgetMs ?? 25000,
  });
  return res;
}

export async function saveDraft(
  db: SupabaseClient,
  d: Draft,
  page: Page,
  opts: { provider?: string | null; sourceId?: string | null; ownerId?: string | null; visibility: "public" | "private"; status: "draft" | "published"; trust?: unknown; attempts?: Attempt[] },
) {
  const name = d.name?.value ?? page.title ?? "Untitled scholarship";
  const canonical = normalizeUrl(page.url);
  const a = d.amount?.value;
  const fieldMeta = {
    source_text: page.text.slice(0, 30000),
    fields: {
      name: d.name && { method: method(d.name.method, page.viaTemplate), confidence: d.name.confidence, evidence: d.name.evidence },
      deadline: d.deadline && { method: method(d.deadline.method, page.viaTemplate), confidence: d.deadline.confidence, evidence: d.deadline.evidence },
      amount: d.amount && { method: method(d.amount.method, page.viaTemplate), confidence: d.amount.confidence, evidence: d.amount.evidence },
    },
    missing: d.missing,
    llm_attempts: opts.attempts ?? [],
  };
  const { data: s, error } = await db
    .from("scholarships")
    .insert({
      slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      name_key: normalizeName(name),
      provider: opts.provider ?? d.provider?.value ?? null,
      source_id: opts.sourceId ?? null,
      source_url: page.url,
      canonical_url: canonical,
      apply_url: page.url,
      amount_min: a?.min ?? null,
      amount_max: a?.max ?? null,
      amount_currency: a?.currency ?? "INR",
      amount_period: a?.period ?? null,
      coverage: a?.coverage ?? null,
      opens_on: d.opens_on?.value ?? null,
      deadline: d.deadline?.value ?? null,
      deadline_type: d.deadline_type,
      status: opts.status,
      visibility: opts.visibility,
      owner_id: opts.ownerId ?? null,
      track_only: d.criteria.length === 0,
      other_conditions: d.other_conditions,
      trust: opts.trust ?? {},
      field_meta: fieldMeta,
      verification: { level: "unverified", sources: [page.url], checked_on: new Date().toISOString().slice(0, 10) },
    })
    .select("id, slug, name")
    .single();
  if (error) throw error;

  if (d.criteria.length) {
    await db.from("scholarship_criteria").insert(
      d.criteria.map((c) => ({
        scholarship_id: s.id,
        field: c.field,
        op: c.op,
        value: c.value,
        fixable_by: c.fixable_by ?? null,
        evidence: c.evidence,
        group_no: c.group_no,
        source_method: c.source_method === "llm" ? "llm" : page.viaTemplate ? "template" : "rules",
        confidence: c.confidence,
      })),
    );
  }
  if (d.required_documents.length) await db.from("scholarship_documents").insert(d.required_documents.map((t) => ({ scholarship_id: s.id, doc_type: t })));
  if (d.steps.length) await db.from("scholarship_steps").insert(d.steps.map((t, i) => ({ scholarship_id: s.id, position: i + 1, title: t.slice(0, 200) })));
  return s;
}

export type UrlResult =
  | { kind: "existing"; slug: string }
  | { kind: "created"; slug: string; name: string; deadline: string | null; amount: number | null; found: string[]; missing: string[]; trust: ReturnType<typeof trustReport>; llm_used: boolean }
  | { kind: "unreadable"; reason: string; retryable: boolean };

export async function processUserUrl(db: SupabaseClient, userId: string, url: string, load: LoadOptions = {}, allowLlm = true): Promise<UrlResult> {
  let page: Page;
  try {
    page = await loadPage(url, load);
  } catch (e) {
    if (e instanceof FetchError) {
      const retryable = /browser|scanned|background|Timed out|reach/i.test(e.reason);
      return { kind: "unreadable", reason: e.reason, retryable };
    }
    throw e;
  }
  const trust = trustReport(url, page.text);
  const pre = extractScholarship({ text: page.text, title: page.title });
  if (pre.name) {
    const { data: same } = await db.from("scholarships").select("slug").eq("name_key", normalizeName(pre.name.value)).eq("visibility", "public").eq("status", "published").limit(1).maybeSingle();
    if (same) return { kind: "existing", slug: same.slug };
  }
  const { draft, used, attempts } = await extractWithFallback(db, page, { allowLlm, budgetMs: 20000 });
  const s = await saveDraft(db, draft, page, { ownerId: userId, visibility: "private", status: "published", trust, attempts });
  return {
    kind: "created",
    slug: s.slug,
    name: s.name,
    deadline: draft.deadline?.value ?? null,
    amount: draft.amount?.value.max ?? null,
    found: (["name", "deadline", "amount", "criteria"] as const).filter((f) => !draft.missing.includes(f)),
    missing: draft.missing,
    trust,
    llm_used: used,
  };
}

const SCHOLARSHIP_LINK = /scholarship|fellowship|award|scheme|grant|bursary|stipend/i;

export async function processSource(db: SupabaseClient, sourceId: string, load: LoadOptions = {}, allowLlm = true) {
  const { data: src } = await db.from("sources").select("*").eq("id", sourceId).single();
  if (!src) throw new Error("Source not found");
  let page: Page;
  try {
    page = await loadPage(src.url, { ...load, templateName: src.template });
  } catch (e) {
    await db.from("sources").update({ last_error: (e as Error).message, last_fetched_at: new Date().toISOString() }).eq("id", src.id);
    throw e;
  }
  await db.from("sources").update({ last_hash: page.hash, last_fetched_at: new Date().toISOString(), last_error: null }).eq("id", src.id);

  if (src.kind === "index") {
    const { data: known } = await db.from("sources").select("url");
    const knownSet = new Set((known ?? []).map((k) => k.url));
    const host = new URL(src.url).hostname.replace(/^www\./, "");
    const fresh = [
      ...new Map(
        page.links
          .filter((l) => SCHOLARSHIP_LINK.test(l.text + " " + l.href))
          .filter((l) => {
            try {
              return new URL(l.href).hostname.endsWith(host);
            } catch {
              return false;
            }
          })
          .map((l) => [normalizeUrl(l.href)!, l]),
      ).keys(),
    ]
      .filter((u) => u && !knownSet.has(u))
      .slice(0, 20);
    for (const url of fresh) {
      const { data: ns } = await db.from("sources").insert({ url, kind: url.endsWith(".pdf") ? "pdf" : "detail", tier: src.tier, provider: src.provider }).select("id").single();
      if (ns) await db.from("jobs").insert({ type: "ingest_source", payload: { source_id: ns.id, use_llm: allowLlm } });
    }
    return { note: `Found ${fresh.length} new links` };
  }

  const canonical = normalizeUrl(page.url);
  const { data: existing } = await db.from("scholarships").select("id").eq("canonical_url", canonical).neq("status", "archived").limit(1).maybeSingle();
  if (existing) return { note: "Already in database, use re-check", scholarship_id: existing.id };

  const { draft, used, attempts } = await extractWithFallback(db, page, { allowLlm, budgetMs: 30000 });
  const s = await saveDraft(db, draft, page, { provider: src.provider, sourceId: src.id, visibility: "public", status: "draft", trust: trustReport(page.url, page.text), attempts });
  const ok = attempts.filter((a) => a.outcome === "ok" || a.outcome === "partial").map((a) => a.provider);
  return { note: `Draft created${ok.length ? ` with ${ok.join(", ")}` : ""}. Missing: ${draft.missing.join(", ") || "none"}`, scholarship_id: s.id, llm_used: used };
}

export async function recheckSource(db: SupabaseClient, sourceId: string, load: LoadOptions = {}) {
  const { data: src } = await db.from("sources").select("*").eq("id", sourceId).single();
  if (!src) throw new Error("Source not found");
  const { data: sch } = await db.from("scholarships").select("id, deadline, amount_max, field_meta").eq("source_id", src.id).neq("status", "archived").maybeSingle();
  let page: Page;
  try {
    page = await loadPage(src.url, { ...load, templateName: src.template });
  } catch (e) {
    await db.from("sources").update({ last_error: (e as Error).message, last_fetched_at: new Date().toISOString() }).eq("id", src.id);
    if (sch) {
      const meta = sch.field_meta as { unreachable_since?: string } | null;
      await db.from("scholarships").update({ field_meta: { ...(meta ?? {}), unreachable_since: meta?.unreachable_since ?? new Date().toISOString() } }).eq("id", sch.id);
    }
    return { note: `Unreachable: ${(e as Error).message}` };
  }
  const changed = page.hash !== src.last_hash;
  await db.from("sources").update({ last_hash: page.hash, last_fetched_at: new Date().toISOString(), last_error: null }).eq("id", src.id);
  if (!changed) {
    if (sch) await db.from("scholarships").update({ last_verified: new Date().toISOString().slice(0, 10) }).eq("id", sch.id);
    return { note: "Unchanged" };
  }
  if (!sch) return { note: "Changed, no linked scholarship" };
  const d = extractScholarship({ text: page.text, title: page.title });
  const diff: Record<string, unknown> = {};
  if (d.deadline?.value && d.deadline.value !== sch.deadline) diff.deadline = d.deadline.value;
  if (d.amount?.value.max && Number(d.amount.value.max) !== Number(sch.amount_max)) diff.amount_max = d.amount.value.max;
  const meta: Record<string, unknown> = { ...((sch.field_meta as object) ?? {}), unreachable_since: null, source_text: page.text.slice(0, 30000) };
  if (Object.keys(diff).length === 1 && diff.deadline && (d.deadline?.confidence ?? 0) >= 0.9) {
    await db.from("scholarships").update({ deadline: diff.deadline, last_verified: new Date().toISOString().slice(0, 10), field_meta: meta }).eq("id", sch.id);
    return { note: `Deadline updated to ${diff.deadline}` };
  }
  meta.needs_review = true;
  meta.proposed = diff;
  await db.from("scholarships").update({ field_meta: meta }).eq("id", sch.id);
  return { note: `Changed, flagged for review: ${Object.keys(diff).join(", ") || "text only"}` };
}

export function withTimeout<T>(p: Promise<T>, ms: number, label = "operation"): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError(`${label} took longer than ${Math.round(ms / 1000)}s`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export class TimeoutError extends Error {}
