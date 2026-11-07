"use client";
import { browserClient } from "@/lib/supabase-browser";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CATEGORY_OPTS, COUNTRY_OPTS, COURSE_LEVEL_OPTS, MINORITY_OPTS, STATE_OPTS, STREAM_OPTS } from "@/lib/options";
import { VerdictBadge, VerdictGlyph, DeadlineChip } from "@/components/ui";
import type { Verdict } from "@grantly/core";

import { ONBOARDING_KEY as KEY } from "@/lib/keys";

type A = Record<string, unknown> & { scope_pref: string[] };
type Preview = { counts: Record<Verdict, number>; top: { slug: string; name: string; provider: string | null; amount: string; verdict: Verdict; reason: string; daysLeft: number | null }[] };

function Choices({ opts, value, onChange, multi = false }: { opts: { v: string; l: string }[]; value: unknown; onChange: (v: unknown) => void; multi?: boolean }) {
  const arr = Array.isArray(value) ? (value as string[]) : [];
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((o) => {
        const on = multi ? arr.includes(o.v) : value === o.v;
        return (
          <button type="button" key={o.v} data-on={on} className="choice" onClick={() => onChange(multi ? (on ? arr.filter((x) => x !== o.v) : [...arr, o.v]) : on ? null : o.v)}>
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, why, children }: { label: string; why?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <span className="label">{label}</span>
      {children}
      {why && <p className="text-xs text-muted">{why}</p>}
    </div>
  );
}

const num = (s: string) => (s.trim() === "" ? null : Number(s));

export default function Onboarding() {
  const [isSignedIn, setSignedIn] = useState(false);
  useEffect(() => {
    browserClient().auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);
  const router = useRouter();
  const [a, setA] = useState<A>({ scope_pref: ["india"], nationality: "IN" });
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [incomeLakh, setIncomeLakh] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (saved) {
        setA(saved.answers);
        setStep(Math.min(saved.step ?? 0, 3));
        if (saved.answers.family_income_inr) setIncomeLakh(String(saved.answers.family_income_inr / 100000));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ answers: a, step }));
    } catch {}
  }, [a, step]);

  const set = (k: string) => (v: unknown) => setA((p) => ({ ...p, [k]: v }));
  const abroad = a.scope_pref.includes("abroad");
  const steps = ["where", "studies", "background", ...(abroad ? ["abroad"] : []), "results"];
  const cur = steps[step];

  useEffect(() => {
    if (cur !== "results") return;
    setBusy(true);
    fetch("/api/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(a) })
      .then((r) => r.json())
      .then(setPreview)
      .finally(() => setBusy(false));
  }, [cur, a]);

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  async function save() {
    if (!isSignedIn) {
      router.push("/login?next=/onboarding/finish");
      return;
    }
    router.push("/onboarding/finish");
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold tracking-tight">grantly</Link>
        <span className="text-sm text-muted">Step {step + 1} of {steps.length}</span>
      </div>
      <div className="mb-8 flex gap-1.5">
        {steps.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-ink" : "bg-ink/15"}`} />)}
      </div>

      {cur === "where" && (
        <section className="space-y-6">
          <h1 className="text-3xl font-bold">Where do you want to study?</h1>
          <Choices
            opts={[{ v: "india", l: "India" }, { v: "abroad", l: "Abroad" }, { v: "both", l: "Both" }]}
            value={a.scope_pref.length === 2 ? "both" : a.scope_pref[0]}
            onChange={(v) => set("scope_pref")(v === "both" ? ["india", "abroad"] : v ? [v] : ["india"])}
          />
        </section>
      )}

      {cur === "studies" && (
        <section className="space-y-6">
          <h1 className="text-3xl font-bold">Your studies</h1>
          <Field label="Current level"><Choices opts={COURSE_LEVEL_OPTS} value={a.course_level} onChange={set("course_level")} /></Field>
          <Field label="Stream"><Choices opts={STREAM_OPTS} value={a.stream} onChange={set("stream")} /></Field>
          <Field label="Year of study">
            <Choices opts={[1, 2, 3, 4, 5].map((n) => ({ v: String(n), l: `Year ${n}` }))} value={a.year_of_study ? String(a.year_of_study) : null} onChange={(v) => set("year_of_study")(v ? Number(v) : null)} />
          </Field>
          <Field label="Latest marks" why="Enter them the way your marksheet shows them. We never convert CGPA to percentage on our own.">
            <Choices opts={[{ v: "percent", l: "Percentage" }, { v: "cgpa", l: "CGPA" }]} value={a.marks_system} onChange={set("marks_system")} />
            {!!a.marks_system && (
              <div className="flex gap-2">
                <input className="input" inputMode="decimal" placeholder={a.marks_system === "percent" ? "e.g. 72.5" : "e.g. 8.2"} value={(a.marks_value as number | null) ?? ""} onChange={(e) => set("marks_value")(num(e.target.value))} />
                {a.marks_system === "cgpa" && (
                  <select className="input max-w-32" value={(a.cgpa_scale as number) ?? 10} onChange={(e) => set("cgpa_scale")(Number(e.target.value))}>
                    <option value={10}>out of 10</option>
                    <option value={4}>out of 4</option>
                  </select>
                )}
              </div>
            )}
          </Field>
        </section>
      )}

      {cur === "background" && (
        <section className="space-y-6">
          <h1 className="text-3xl font-bold">A bit about you</h1>
          <Field label="State of domicile">
            <select className="input" value={(a.state as string) ?? ""} onChange={(e) => set("state")(e.target.value || null)}>
              <option value="">Select state</option>
              {STATE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </Field>
          <Field label="Gender"><Choices opts={[{ v: "female", l: "Female" }, { v: "male", l: "Male" }, { v: "other", l: "Other" }, { v: "undisclosed", l: "Prefer not to say" }]} value={a.gender} onChange={set("gender")} /></Field>
          <Field label="Annual family income (in lakh)" why="Many scholarships have an income limit. An approximate figure is fine; your income certificate can confirm it later.">
            <input className="input" inputMode="decimal" placeholder="e.g. 4.5" value={incomeLakh} onChange={(e) => { setIncomeLakh(e.target.value); const n = num(e.target.value); set("family_income_inr")(n === null || isNaN(n) ? null : Math.round(n * 100000)); }} />
          </Field>
          <Field label="Category" why="Optional. Many government schemes are for specific categories.">
            <Choices opts={[...CATEGORY_OPTS, { v: "undisclosed", l: "Prefer not to say" }]} value={a.category} onChange={(v) => set("category")(v === "undisclosed" ? null : v)} />
          </Field>
          <Field label="Minority community" why="Optional. Some schemes are for notified minority communities.">
            <Choices opts={MINORITY_OPTS} value={a.minority ?? null} onChange={set("minority")} />
          </Field>
          <Field label="Do you have a disability certificate?" why="Optional. Some scholarships are for students with disabilities.">
            <Choices opts={[{ v: "yes", l: "Yes" }, { v: "no", l: "No" }]} value={a.disability === true ? "yes" : a.disability === false ? "no" : null} onChange={(v) => set("disability")(v === "yes" ? true : v === "no" ? false : null)} />
          </Field>
        </section>
      )}

      {cur === "abroad" && (
        <section className="space-y-6">
          <h1 className="text-3xl font-bold">Studying abroad</h1>
          <Field label="Target countries"><Choices multi opts={COUNTRY_OPTS} value={a.target_countries ?? []} onChange={set("target_countries")} /></Field>
          <Field label="English test score (IELTS band)" why="Skip if you haven't taken one yet.">
            <input className="input" inputMode="decimal" placeholder="e.g. 7.0" value={(a.english_test_score as number | null) ?? ""} onChange={(e) => set("english_test_score")(num(e.target.value))} />
          </Field>
          <Field label="Full-time work experience (years)">
            <input className="input" inputMode="decimal" placeholder="e.g. 0" value={(a.work_experience_years as number | null) ?? ""} onChange={(e) => set("work_experience_years")(num(e.target.value))} />
          </Field>
        </section>
      )}

      {cur === "results" && (
        <section className="space-y-6">
          <h1 className="text-3xl font-bold">Here&apos;s what you can win</h1>
          {busy || !preview ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-[22px]" />)}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(["eligible", "almost", "need_info", "not_eligible"] as Verdict[]).map((v) => (
                  <div key={v} className={`card p-4 ${{ eligible: "bg-green", almost: "bg-yellow", need_info: "bg-blue", not_eligible: "bg-pink" }[v]}`}>
                    <div className="text-3xl font-bold">{preview.counts[v]}</div>
                    <div className="mt-2"><VerdictBadge v={v} size="sm" /></div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {preview.top.map((t) => (
                  <div key={t.slug} className="flex items-center gap-3 rounded-[18px] bg-cream-2 p-3">
                    <VerdictGlyph v={t.verdict} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{t.name}</p>
                      <p className="truncate text-xs text-muted">{t.amount} · {t.reason}</p>
                    </div>
                    <DeadlineChip days={t.daysLeft} />
                  </div>
                ))}
              </div>
              <div className="card bg-ink p-6 text-white">
                <h2 className="text-xl font-semibold">Save your matches</h2>
                <p className="mt-1 text-sm text-white/70">Create a free account to keep these, track deadlines and get reminders.</p>
                <button onClick={save} className="btn mt-4 bg-pink text-ink">Save and continue</button>
              </div>
            </>
          )}
        </section>
      )}

      <div className="mt-10 flex items-center justify-between">
        <button onClick={back} disabled={step === 0} className="btn btn-outline"><ArrowLeft className="h-4 w-4" />Back</button>
        {cur !== "results" && (
          <div className="flex gap-2">
            {cur !== "where" && <button onClick={next} className="btn text-muted">Skip</button>}
            <button onClick={next} className="btn btn-primary">Continue</button>
          </div>
        )}
      </div>
    </main>
  );
}
