"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORY_OPTS, COUNTRY_OPTS, COURSE_LEVEL_OPTS, MINORITY_OPTS, STATE_OPTS, STREAM_OPTS } from "@/lib/options";

type P = Record<string, unknown>;

function Sel({ label, value, opts, onChange, hint }: { label: string; value: unknown; opts: { v: string; l: string }[]; onChange: (v: string | null) => void; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="input" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Not set</option>
        {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

function Num({ label, value, onChange, hint, step = "any" }: { label: string; value: unknown; onChange: (v: number | null) => void; hint?: string; step?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" type="number" step={step} value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

export function ProfileForm({ initial, sources }: { initial: P; sources: Record<string, { from: string }> }) {
  const router = useRouter();
  const [p, setP] = useState<P>(initial);
  const [saved, setSaved] = useState(false);
  const set = (k: string) => (v: unknown) => { setP({ ...p, [k]: v }); setSaved(false); };
  const fromDoc = (k: string) => (sources[k]?.from === "document" ? "From your uploaded document" : undefined);
  const scope = (p.scope_pref as string[]) ?? ["india"];

  async function save() {
    const fs = { ...sources };
    for (const k of Object.keys(p)) if (p[k] !== initial[k]) fs[k] = { from: "typed" };
    const res = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...p, field_source: fs }) });
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="space-y-8">
      <section className="card bg-cream-2 p-5">
        <h2 className="mb-4 text-lg font-semibold">Studies</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="label">Full name</span><input className="input" value={(p.full_name as string) ?? ""} onChange={(e) => set("full_name")(e.target.value)} /></label>
          <Sel label="Course level" value={p.course_level} opts={COURSE_LEVEL_OPTS} onChange={set("course_level")} />
          <Sel label="Stream" value={p.stream} opts={STREAM_OPTS} onChange={set("stream")} />
          <Num label="Year of study" value={p.year_of_study} onChange={set("year_of_study")} step="1" />
          <Sel label="Marks type" value={p.marks_system} opts={[{ v: "percent", l: "Percentage" }, { v: "cgpa", l: "CGPA" }]} onChange={set("marks_system")} />
          <Num label={p.marks_system === "cgpa" ? "CGPA" : "Percentage"} value={p.marks_value} onChange={set("marks_value")} hint={fromDoc("marks_value")} />
          {p.marks_system === "cgpa" && <Sel label="CGPA scale" value={p.cgpa_scale != null ? String(p.cgpa_scale) : null} opts={[{ v: "10", l: "Out of 10" }, { v: "4", l: "Out of 4" }]} onChange={(v) => set("cgpa_scale")(v ? Number(v) : null)} />}
        </div>
      </section>

      <section className="card bg-cream-2 p-5">
        <h2 className="mb-4 text-lg font-semibold">Background</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Sel label="State of domicile" value={p.state} opts={STATE_OPTS} onChange={set("state")} hint={fromDoc("state")} />
          <Sel label="Gender" value={p.gender} opts={[{ v: "female", l: "Female" }, { v: "male", l: "Male" }, { v: "other", l: "Other" }, { v: "undisclosed", l: "Prefer not to say" }]} onChange={set("gender")} />
          <Num label="Annual family income (₹)" value={p.family_income_inr} onChange={set("family_income_inr")} hint={fromDoc("family_income_inr") ?? "Total yearly income of your household"} step="1000" />
          <Sel label="Category" value={p.category} opts={CATEGORY_OPTS} onChange={set("category")} hint={fromDoc("category") ?? "Optional"} />
          <Sel label="Minority community" value={p.minority ?? "none"} opts={MINORITY_OPTS} onChange={set("minority")} hint="Optional" />
          <Sel label="Disability certificate" value={p.disability === true ? "yes" : p.disability === false ? "no" : null} opts={[{ v: "yes", l: "Yes" }, { v: "no", l: "No" }]} onChange={(v) => set("disability")(v === "yes" ? true : v === "no" ? false : null)} hint="Optional" />
        </div>
      </section>

      <section className="card bg-cream-2 p-5">
        <h2 className="mb-4 text-lg font-semibold">Where you want to study</h2>
        <div className="flex flex-wrap gap-2">
          {[["india", "India"], ["abroad", "Abroad"]].map(([k, l]) => (
            <button key={k} data-on={scope.includes(k)} className="choice" onClick={() => set("scope_pref")(scope.includes(k) ? scope.filter((x) => x !== k).length ? scope.filter((x) => x !== k) : scope : [...scope, k])}>{l}</button>
          ))}
        </div>
        {scope.includes("abroad") && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <span className="label">Target countries</span>
              <div className="flex flex-wrap gap-2">
                {COUNTRY_OPTS.map((c) => {
                  const arr = (p.target_countries as string[]) ?? [];
                  const on = arr.includes(c.v);
                  return <button key={c.v} data-on={on} className="choice" onClick={() => set("target_countries")(on ? arr.filter((x) => x !== c.v) : [...arr, c.v])}>{c.l}</button>;
                })}
              </div>
            </div>
            <Num label="English test score (IELTS band)" value={p.english_test_score} onChange={set("english_test_score")} />
            <Num label="Work experience (years)" value={p.work_experience_years} onChange={set("work_experience_years")} />
          </div>
        )}
      </section>

      <div className="sticky bottom-20 flex items-center justify-end gap-3 lg:bottom-4">
        {saved && <span className="text-sm font-medium">Saved. Matches updated.</span>}
        <button onClick={save} className="btn btn-primary">Save changes</button>
      </div>
    </div>
  );
}
