import { LLM_SYSTEM_PROMPT, buildSnippet, mergeLlm, validateLlm, type Draft, type RequiredField } from "@grantly/core";
import { createHash } from "node:crypto";

export type ProviderName = "gemini" | "groq" | "openrouter";

export interface Provider {
  name: ProviderName;
  model: string;
  key: string;
}

export interface LlmStore {
  getCache(key: string): Promise<unknown | null>;
  setCache(key: string, provider: string, value: unknown): Promise<void>;
  tokensToday(provider: ProviderName): Promise<number>;
  addUsage(provider: ProviderName, tokensIn: number, tokensOut: number, ok: boolean): Promise<void>;
  cooldownUntil(provider: ProviderName): Promise<number>;
  setCooldown(provider: ProviderName, untilMs: number, error: string): Promise<void>;
}

export interface Attempt {
  provider: ProviderName;
  outcome: "ok" | "partial" | "invalid" | "rate_limited" | "error" | "timeout" | "skipped_cooldown" | "skipped_budget";
  detail?: string;
}

export interface ChainResult {
  draft: Draft;
  used: boolean;
  attempts: Attempt[];
  skipped?: string;
}

const PROMPT_VERSION = "v2";

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  gemini: "gemini-2.5-flash-lite",
  groq: "openai/gpt-oss-20b",
  openrouter: "openrouter/free",
};

export function providersFromEnv(env: Record<string, string | undefined> = process.env): Provider[] {
  if (env.LLM_ENABLED === "false") return [];
  const order = (env.LLM_ORDER ?? "gemini,groq,openrouter").split(",").map((s) => s.trim()) as ProviderName[];
  const keys: Record<ProviderName, string | undefined> = { gemini: env.GEMINI_API_KEY, groq: env.GROQ_API_KEY, openrouter: env.OPENROUTER_API_KEY };
  const models: Record<ProviderName, string | undefined> = { gemini: env.GEMINI_MODEL, groq: env.GROQ_MODEL, openrouter: env.OPENROUTER_MODEL };
  return order.filter((n) => keys[n]).map((n) => ({ name: n, key: keys[n]!, model: models[n] || DEFAULT_MODELS[n] }));
}

const OUTPUT_SPEC = `Reply with JSON only, using these short keys and omitting fields you were not asked for:
{"name":{"v":"...","e":"quote"},"deadline":{"v":"YYYY-MM-DD","e":"quote"},"amount":{"min":0,"max":0,"cur":"INR","per":"year|month|one_time|total|null","e":"quote"},"criteria":[{"f":"field","op":"<=","v":0,"e":"quote"}]}
Use null for anything not stated.`;

export class ProviderError extends Error {
  constructor(public kind: "rate_limited" | "error" | "timeout", message: string, public retryAfterMs?: number) {
    super(message);
  }
}

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    const text = await res.text();
    if (res.status === 429) {
      const ra = Number(res.headers.get("retry-after"));
      throw new ProviderError("rate_limited", text.slice(0, 200), isFinite(ra) && ra > 0 ? ra * 1000 : undefined);
    }
    if (!res.ok) throw new ProviderError(res.status >= 500 ? "error" : "error", `${res.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text);
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if ((e as Error).name === "AbortError") throw new ProviderError("timeout", "timed out");
    throw new ProviderError("error", (e as Error).message);
  } finally {
    clearTimeout(t);
  }
}

export async function callProvider(p: Provider, system: string, user: string, timeoutMs = 12000): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  if (p.name === "gemini") {
    const j = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.model)}:generateContent`,
      { "x-goog-api-key": p.key },
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 500, responseMimeType: "application/json" },
      },
      timeoutMs,
    );
    const text = j.candidates?.[0]?.content?.parts?.map((x: { text?: string }) => x.text ?? "").join("") ?? "";
    return { text, tokensIn: j.usageMetadata?.promptTokenCount ?? 0, tokensOut: j.usageMetadata?.candidatesTokenCount ?? 0 };
  }
  const url = p.name === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
  const headers: Record<string, string> = { authorization: `Bearer ${p.key}` };
  if (p.name === "openrouter") {
    headers["HTTP-Referer"] = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://grantly.app";
    headers["X-Title"] = "Grantly";
  }
  const body: Record<string, unknown> = {
    model: p.model,
    temperature: 0,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  };
  if (p.name === "groq") {
    body.max_completion_tokens = 1200;
    if (p.model.includes("gpt-oss")) body.reasoning_effort = "low";
  } else body.max_tokens = 800;
  const j = await post(url, headers, body, timeoutMs);
  const text = j.choices?.[0]?.message?.content ?? "";
  return { text, tokensIn: j.usage?.prompt_tokens ?? 0, tokensOut: j.usage?.completion_tokens ?? 0 };
}

export function parseJsonLoose(text: string): unknown | null {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

type Compact = {
  name?: { v?: unknown; e?: string } | null;
  deadline?: { v?: unknown; e?: string } | null;
  amount?: { min?: number | null; max?: number | null; cur?: string; per?: string | null; e?: string } | null;
  criteria?: { f: string; op: string; v: unknown; e: string }[] | null;
};

export function expandCompact(raw: unknown): unknown {
  const c = (raw ?? {}) as Compact;
  const out: Record<string, unknown> = {};
  if (c.name?.v != null && c.name.e) out.name = { value: c.name.v, evidence: c.name.e };
  if (c.deadline?.v != null && c.deadline.e) out.deadline = { value: c.deadline.v, evidence: c.deadline.e };
  if (c.amount && c.amount.e) {
    const per = c.amount.per && ["year", "month", "one_time", "total"].includes(c.amount.per) ? c.amount.per : null;
    out.amount = { min: c.amount.min ?? null, max: c.amount.max ?? null, currency: c.amount.cur ?? "INR", period: per, evidence: c.amount.e };
  }
  if (Array.isArray(c.criteria)) out.criteria = c.criteria.filter((x) => x && x.f && x.e).map((x) => ({ field: x.f, op: x.op, value: x.v, evidence: x.e }));
  return out;
}

export interface ChainOptions {
  providers: Provider[];
  store: LlmStore;
  dailyTokenCapPerProvider?: number;
  timeoutMs?: number;
  totalBudgetMs?: number;
  allow?: boolean;
  call?: typeof callProvider;
}

export async function fillMissing(draft: Draft, text: string, opts: ChainOptions): Promise<ChainResult> {
  const missing = [...new Set([...draft.missing, ...draft.conflicts])] as RequiredField[];
  const attempts: Attempt[] = [];
  if (!missing.length) return { draft, used: false, attempts };
  if (opts.allow === false) return { draft, used: false, attempts, skipped: "LLM not allowed for this request" };
  if (!opts.providers.length) return { draft, used: false, attempts, skipped: "No LLM providers configured" };

  const snippet = buildSnippet(text, missing, 600);
  if (snippet.trim().length < 40) return { draft, used: false, attempts, skipped: "Nothing relevant to send" };

  const key = createHash("sha256").update([PROMPT_VERSION, snippet, missing.join(",")].join("|")).digest("hex");
  const cached = await opts.store.getCache(key).catch(() => null);
  if (cached) {
    const v = validateLlm(expandCompact(cached), snippet, missing);
    return { draft: mergeLlm(draft, v), used: false, attempts, skipped: "cache hit" };
  }

  const call = opts.call ?? callProvider;
  const cap = opts.dailyTokenCapPerProvider ?? 150000;
  const started = Date.now();
  const budgetMs = opts.totalBudgetMs ?? 30000;
  let remaining = [...missing];
  let current = draft;
  let used = false;
  const merged: Compact = {};

  for (const p of opts.providers) {
    if (!remaining.length) break;
    if (Date.now() - started > budgetMs) break;
    if ((await opts.store.cooldownUntil(p.name).catch(() => 0)) > Date.now()) {
      attempts.push({ provider: p.name, outcome: "skipped_cooldown" });
      continue;
    }
    if ((await opts.store.tokensToday(p.name).catch(() => 0)) >= cap) {
      attempts.push({ provider: p.name, outcome: "skipped_budget" });
      continue;
    }
    const user = `Fields needed: ${remaining.join(", ")}\n<page_text>\n${snippet}\n</page_text>`;
    try {
      const timeLeft = Math.max(3000, Math.min(opts.timeoutMs ?? 12000, budgetMs - (Date.now() - started)));
      const r = await call(p, `${LLM_SYSTEM_PROMPT}\n${OUTPUT_SPEC}`, user, timeLeft);
      used = true;
      await opts.store.addUsage(p.name, r.tokensIn, r.tokensOut, true).catch(() => {});
      const parsed = parseJsonLoose(r.text);
      if (!parsed) {
        attempts.push({ provider: p.name, outcome: "invalid", detail: "not JSON" });
        continue;
      }
      const valid = validateLlm(expandCompact(parsed), snippet, remaining);
      const got = Object.keys(valid) as RequiredField[];
      if (!got.length) {
        attempts.push({ provider: p.name, outcome: "invalid", detail: "nothing passed validation" });
        continue;
      }
      Object.assign(merged, Object.fromEntries(Object.entries(parsed as Compact).filter(([k]) => got.includes(k as RequiredField))));
      current = mergeLlm(current, valid);
      remaining = remaining.filter((f) => !got.includes(f));
      attempts.push({ provider: p.name, outcome: remaining.length ? "partial" : "ok" });
    } catch (e) {
      const err = e as ProviderError;
      const kind = err instanceof ProviderError ? err.kind : "error";
      attempts.push({ provider: p.name, outcome: kind, detail: err.message?.slice(0, 120) });
      await opts.store.addUsage(p.name, 0, 0, false).catch(() => {});
      const cool = kind === "rate_limited" ? err.retryAfterMs ?? 10 * 60000 : kind === "timeout" ? 60000 : 2 * 60000;
      await opts.store.setCooldown(p.name, Date.now() + cool, err.message ?? kind).catch(() => {});
    }
  }

  if (Object.keys(merged).length) await opts.store.setCache(key, attempts.filter((a) => a.outcome === "ok" || a.outcome === "partial").map((a) => a.provider).join("+"), merged).catch(() => {});
  return { draft: current, used, attempts };
}

export async function pingProvider(p: Provider) {
  const t0 = Date.now();
  try {
    const r = await callProvider(p, "Reply with JSON only.", 'Return {"ok":true}', 15000);
    const j = parseJsonLoose(r.text) as { ok?: boolean } | null;
    return { ok: !!j?.ok, ms: Date.now() - t0, detail: j ? "responded" : `unexpected reply: ${r.text.slice(0, 80)}` };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, detail: (e as Error).message.slice(0, 200) };
  }
}
