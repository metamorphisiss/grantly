"use client";
import { CriterionField, CriterionOp, DOC_TYPES, type Criterion } from "@grantly/core";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type F = {
  name: string;
  provider: string | null;
  provider_type: "government" | "private" | "institution" | "international" | null;
  scope: "domestic" | "international";
  amount_min: number | null;
  amount_max: number | null;
  amount_currency: string;
  amount_period: "year" | "month" | "one_time" | "total" | null;
  coverage: "full" | "partial" | "fixed" | null;
  deadline: string | null;
  deadline_type: "fixed" | "rolling" | "unknown";
  apply_url: string | null;
  other_conditions: string[];
  exclusive_group: string | null;
};

type Meta = Record<string, { method?: string; confidence?: number; evidence?: string }>;

const METHOD_TONE: Record<string, string> = { llm: "bg-yellow", rules: "bg-green", template: "bg-green", manual: "bg-cream-3" };

function Tag({ m }: { m?: { method?: string; confidence?: number } }) {
  if (!m?.method) return <span className="pill bg-blue px-2 py-0.5 text-[10px] font-semibold">missing</span>;
  const low = (m.confidence ?? 1) < 0.7;
  return <span className={`pill px-2 py-0.5 text-[10px] font-semibold ${low ? "bg-pink" : METHOD_TONE[m.method] ?? "bg-cream-3"}`}>{m.method}{low ? " · low" : ""}</span>;
}

export function ReviewEditor({ id, initial, criteria: c0, documents: d0, meta, sourceText, sourceUrl }: { id: string; initial: F; criteria: Criterion[]; documents: string[]; meta: Meta; sourceText: string; sourceUrl: string | null }) {
  const router = useRouter();
  const [f, setF] = useState<F>(initial);
  const [crit, setCrit] = useState<(Criterion & { raw: string })[]>(c0.map((c) => ({ ...c, raw: JSON.stringify(c.value) })));
  const [docs, setDocs] = useState<string[]>(d0);
  const [err, setErr] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const set = <K extends keyof F>(k: K, v: F[K]) => setF({ ...f, [k]: v });

  const highlighted = sourceText;

  async function submit(action: "publish" | "save" | "archive") {
    setErr(null);
    let criteria: Criterion[];
    try {
      criteria = crit.map(({ raw, ...c }) => ({ ...c, value: JSON.parse(raw) }));
    } catch {
      return setErr("A criterion value is not valid JSON.");
    }
    const r = await fetch("/api/admin/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action, fields: f, criteria, documents: docs }) });
    if (!r.ok) return setErr(JSON.stringify((await r.json()).error));
    router.push("/admin");
    router.refresh();
  }

  const renderSource = () => {
    if (!focus) return highlighted;
    const needle = focus.replace(/…$/, "");
    const i = highlighted.toLowerCase().indexOf(needle.toLowerCase());
    if (i < 0) return highlighted;
    return (
      <>
        {highlighted.slice(0, i)}
        <mark className="rounded bg-yellow px-0.5">{highlighted.slice(i, i + needle.length)}</mark>
        {highlighted.slice(i + needle.length)}
      </>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card max-h-[80vh] overflow-auto bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Source text</h2>
          {sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">Open source</a>}
        </div>
        <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink/80">{renderSource()}</pre>
      </div>

      <div className="space-y-5">
        <div className="card space-y-3 bg-cream-2 p-5">
          <h2 className="font-semibold">Fields</h2>
          <label className="block"><span className="label">Name <Tag m={meta.name} /></span><input className="input" value={f.name} onFocus={() => setFocus(meta.name?.evidence ?? null)} onChange={(e) => set("name", e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">Provider</span><input className="input" value={f.provider ?? ""} onChange={(e) => set("provider", e.target.value || null)} /></label>
            <label className="block"><span className="label">Provider type</span>
              <select className="input" value={f.provider_type ?? ""} onChange={(e) => set("provider_type", (e.target.value || null) as F["provider_type"])}>
                <option value="">—</option><option value="government">Government</option><option value="private">Private</option><option value="institution">Institution</option><option value="international">International</option>
              </select>
            </label>
            <label className="block"><span className="label">Deadline <Tag m={meta.deadline} /></span><input type="date" className="input" value={f.deadline ?? ""} onFocus={() => setFocus(meta.deadline?.evidence ?? null)} onChange={(e) => set("deadline", e.target.value || null)} /></label>
            <label className="block"><span className="label">Deadline type</span>
              <select className="input" value={f.deadline_type} onChange={(e) => set("deadline_type", e.target.value as F["deadline_type"])}><option value="fixed">Fixed</option><option value="rolling">Rolling</option><option value="unknown">Unknown</option></select>
            </label>
            <label className="block"><span className="label">Amount min <Tag m={meta.amount} /></span><input className="input" type="number" value={f.amount_min ?? ""} onFocus={() => setFocus(meta.amount?.evidence ?? null)} onChange={(e) => set("amount_min", e.target.value ? Number(e.target.value) : null)} /></label>
            <label className="block"><span className="label">Amount max</span><input className="input" type="number" value={f.amount_max ?? ""} onChange={(e) => set("amount_max", e.target.value ? Number(e.target.value) : null)} /></label>
            <label className="block"><span className="label">Currency</span><input className="input" value={f.amount_currency} maxLength={3} onChange={(e) => set("amount_currency", e.target.value.toUpperCase())} /></label>
            <label className="block"><span className="label">Period</span>
              <select className="input" value={f.amount_period ?? ""} onChange={(e) => set("amount_period", (e.target.value || null) as F["amount_period"])}><option value="">—</option><option value="year">Per year</option><option value="month">Per month</option><option value="one_time">One time</option><option value="total">Total</option></select>
            </label>
            <label className="block"><span className="label">Coverage</span>
              <select className="input" value={f.coverage ?? ""} onChange={(e) => set("coverage", (e.target.value || null) as F["coverage"])}><option value="">—</option><option value="fixed">Fixed amount</option><option value="partial">Partial</option><option value="full">Full funding</option></select>
            </label>
            <label className="block"><span className="label">Scope</span>
              <select className="input" value={f.scope} onChange={(e) => set("scope", e.target.value as F["scope"])}><option value="domestic">India</option><option value="international">Abroad</option></select>
            </label>
            <label className="col-span-2 block"><span className="label">Apply URL</span><input className="input" value={f.apply_url ?? ""} onChange={(e) => set("apply_url", e.target.value || null)} /></label>
            <label className="col-span-2 block"><span className="label">Exclusive group (can&apos;t combine)</span><input className="input" value={f.exclusive_group ?? ""} onChange={(e) => set("exclusive_group", e.target.value || null)} /></label>
          </div>
        </div>

        <div className="card space-y-3 bg-cream-2 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Criteria <span className="text-xs font-normal text-muted">same group = AND, different groups = OR</span></h2>
            <button className="pill bg-ink px-3 py-1 text-xs font-semibold text-white" onClick={() => setCrit([...crit, { field: "family_income_inr", op: "<=", value: 0, raw: "0", kind: "hard", group_no: 0, source_method: "manual", confidence: 1 }])}><Plus className="inline h-3 w-3" /> Add</button>
          </div>
          {crit.map((c, i) => (
            <div key={i} className="space-y-1 rounded-[14px] bg-white p-3">
              <div className="grid grid-cols-[1.3fr_0.7fr_1.3fr_0.5fr_auto] gap-2">
                <select className="input !py-1.5 text-xs" value={c.field} onChange={(e) => setCrit(crit.map((x, j) => (j === i ? { ...x, field: e.target.value as Criterion["field"] } : x)))}>{CriterionField.options.map((o) => <option key={o}>{o}</option>)}</select>
                <select className="input !py-1.5 text-xs" value={c.op} onChange={(e) => setCrit(crit.map((x, j) => (j === i ? { ...x, op: e.target.value as Criterion["op"] } : x)))}>{CriterionOp.options.map((o) => <option key={o}>{o}</option>)}</select>
                <input className="input !py-1.5 font-mono text-xs" value={c.raw} onChange={(e) => setCrit(crit.map((x, j) => (j === i ? { ...x, raw: e.target.value } : x)))} />
                <input className="input !py-1.5 text-xs" type="number" title="group" value={c.group_no} onChange={(e) => setCrit(crit.map((x, j) => (j === i ? { ...x, group_no: Number(e.target.value) } : x)))} />
                <button aria-label="Remove" onClick={() => setCrit(crit.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted">
                <Tag m={{ method: c.source_method, confidence: c.confidence }} />
                <button className="truncate text-left italic underline-offset-2 hover:underline" onClick={() => setFocus(c.evidence ?? null)}>{c.evidence ?? "no evidence"}</button>
              </div>
            </div>
          ))}
        </div>

        <div className="card space-y-3 bg-cream-2 p-5">
          <h2 className="font-semibold">Required documents</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(DOC_TYPES).map(([k, v]) => (
              <button key={k} data-on={docs.includes(k)} className="choice !py-1 !text-xs" onClick={() => setDocs(docs.includes(k) ? docs.filter((x) => x !== k) : [...docs, k])}>{v.label}</button>
            ))}
          </div>
          <span className="label">Other conditions (one per line)</span>
          <textarea className="input min-h-24 text-sm" value={f.other_conditions.join("\n")} onChange={(e) => set("other_conditions", e.target.value.split("\n").filter(Boolean))} />
        </div>

        {err && <p className="text-sm text-pink-deep">{err}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn btn-outline" onClick={() => submit("archive")}>Archive</button>
          <button className="btn btn-outline" onClick={() => submit("save")}>Save draft</button>
          <button className="btn btn-primary" onClick={() => submit("publish")}>Publish</button>
        </div>
      </div>
    </div>
  );
}
