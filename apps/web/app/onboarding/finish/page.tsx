"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DocumentUploader } from "@/components/DocumentUploader";
import { ONBOARDING_KEY } from "@/lib/keys";

type Suggestion = { doc_type: string; label: string; n: number };

export default function Finish() {
  const router = useRouter();
  const [step, setStep] = useState<"saving" | "docs" | "reminders">("saving");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [email, setEmail] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let answers: Record<string, unknown> = {};
    try {
      answers = JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? "null")?.answers ?? {};
    } catch {}
    setProfile(answers);
    fetch("/api/profile/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(answers) })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Could not save your profile");
        try {
          localStorage.removeItem(ONBOARDING_KEY);
        } catch {}
        setSuggestions(j.suggestions ?? []);
        setStep("docs");
      })
      .catch((e) => setErr(e.message));
  }, []);

  async function finish() {
    await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ reminder_email: email }) });
    router.push("/dashboard");
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <span className="text-2xl font-bold tracking-tight">grantly</span>
      {step === "saving" && (
        <div className="mt-16 text-center">
          {err ? <p className="text-pink-deep">{err}</p> : <p className="text-muted">Saving your matches…</p>}
        </div>
      )}

      {step === "docs" && (
        <section className="mt-10 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Speed things up</h1>
            <p className="mt-2 text-muted">Upload documents once and we&apos;ll fill your profile and check readiness for every scholarship. You can do this later from your vault.</p>
          </div>
          {suggestions.length === 0 && <p className="text-sm text-muted">No documents needed yet.</p>}
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div key={s.doc_type} className="rounded-[18px] bg-cream-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{s.label}</p>
                    <p className="text-xs text-muted">Needed by {s.n} of your matches</p>
                  </div>
                  <button className="btn btn-outline !py-2" onClick={() => setOpen(open === s.doc_type ? null : s.doc_type)}>{open === s.doc_type ? "Close" : "Upload"}</button>
                </div>
                {open === s.doc_type && <div className="mt-3"><DocumentUploader defaultType={s.doc_type} profile={profile} compact /></div>}
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            <button className="btn btn-outline" onClick={() => setStep("reminders")}>Do it later</button>
            <button className="btn btn-primary" onClick={() => setStep("reminders")}>Continue</button>
          </div>
        </section>
      )}

      {step === "reminders" && (
        <section className="mt-10 space-y-6">
          <h1 className="text-3xl font-bold">Never miss a deadline</h1>
          <label className="flex items-center justify-between rounded-[18px] bg-cream-2 p-4">
            <span>
              <span className="block font-semibold">Email reminders</span>
              <span className="text-xs text-muted">14, 3 and 1 day before deadlines, plus expiring documents. One digest a day at most.</span>
            </span>
            <input type="checkbox" className="h-5 w-5 accent-black" checked={email} onChange={(e) => setEmail(e.target.checked)} />
          </label>
          <div className="flex justify-between">
            <Link href="/settings" className="btn btn-outline">More options</Link>
            <button className="btn btn-primary" onClick={finish}>Go to my dashboard</button>
          </div>
        </section>
      )}
    </main>
  );
}
