"use client";
import { CircleAlert, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Result = {
  slug?: string;
  name?: string;
  deadline?: string | null;
  amount?: number | null;
  found?: string[];
  missing?: string[];
  trust?: { level: string; positives: string[]; flags: string[] };
  unreadable?: boolean;
  reason?: string;
};

const LABEL: Record<string, string> = { name: "Name", deadline: "Deadline", amount: "Amount", criteria: "Eligibility rules" };

export default function AddLink() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<"idle" | "working" | "review" | "manual">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [form, setForm] = useState({ name: "", deadline: "", amount: "", provider: "" });

  async function submit() {
    setErr(null);
    setStage("working");
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 55000);
    let j: Result & { kind?: string; error?: string; queued?: boolean };
    try {
      const r = await fetch("/api/links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }), signal: ctl.signal });
      j = await r.json();
      if (!r.ok) {
        setErr(j.error ?? "Something went wrong");
        setStage("idle");
        return;
      }
    } catch {
      j = { kind: "unreadable", reason: "The page took too long to read", queued: true };
    } finally {
      clearTimeout(t);
    }
    if (j.kind === "existing" && j.slug) return router.push(`/scholarships/${j.slug}`);
    if (j.kind === "unreadable") {
      setRes(j);
      setStage("manual");
      return;
    }
    setRes(j);
    setForm({ name: j.name ?? "", deadline: j.deadline ?? "", amount: j.amount ? String(j.amount) : "", provider: "" });
    setStage("review");
  }

  async function saveEdits() {
    await fetch("/api/links", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: res!.slug, ...form }) });
    router.push(`/scholarships/${res!.slug}`);
  }

  async function saveManual() {
    const r = await fetch("/api/links", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, ...form }) });
    const j = await r.json();
    if (!r.ok) return setErr(j.error);
    router.push(`/scholarships/${j.slug}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Add a scholarship by link</h1>
        <p className="mt-1 text-sm text-muted">Found one we don&apos;t list? Paste the official page. We read it, check it for warning signs, and add it to your matches privately.</p>
      </div>

      <div className="flex gap-2">
        <input className="input" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <button className="btn btn-primary shrink-0" disabled={!url || stage === "working"} onClick={submit}>
          {stage === "working" ? <><Loader2 className="h-4 w-4 animate-spin" />Reading</> : "Add"}
        </button>
      </div>
      {err && <p className="text-sm text-pink-deep">{err}</p>}

      {res?.trust?.level === "warning" && (
        <div className="flex gap-3 rounded-[18px] border-[1.5px] border-ink bg-pink p-4 text-sm">
          <CircleAlert className="h-5 w-5 shrink-0" />
          <div><b>Possible scam.</b> {res.trust.flags.join(". ")}. Real scholarships never ask for a fee, an OTP or banking passwords.</div>
        </div>
      )}

      {stage === "review" && res && (
        <div className="card space-y-4 bg-cream-2 p-5">
          <p className="font-semibold">Here&apos;s what we read. Fix anything that looks wrong.</p>
          <div className="flex flex-wrap gap-2">
            {(res.found ?? []).map((f) => <span key={f} className="pill bg-green px-3 py-1 text-xs font-semibold">Found: {LABEL[f] ?? f}</span>)}
            {(res.missing ?? []).map((f) => <span key={f} className="pill bg-blue px-3 py-1 text-xs font-semibold">Not found: {LABEL[f] ?? f}</span>)}
          </div>
          <label className="block"><span className="label">Name</span><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">Deadline</span><input type="date" className="input" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></label>
            <label className="block"><span className="label">Amount (₹)</span><input className="input" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
          </div>
          <p className="text-xs text-muted">Saved as &ldquo;Added by you, unverified&rdquo;. Our team reviews added links before anyone else sees them.</p>
          <button className="btn btn-primary" onClick={saveEdits}>Looks right</button>
        </div>
      )}

      {stage === "manual" && (
        <div className="card space-y-4 bg-cream-2 p-5">
          <p className="font-semibold">We couldn&apos;t read that page{res?.reason ? ` (${res.reason})` : ""}.</p>
          {(res as { queued?: boolean } | null)?.queued && <p className="text-sm text-muted">We&apos;ll try again in the background with a full browser. If it works, it will show up in your matches.</p>}
          <p className="text-sm text-muted">Pages behind a login, image posts and forms can&apos;t be read. Add the basics and we&apos;ll track the deadline for you. Eligibility won&apos;t be checked for it.</p>
          <label className="block"><span className="label">Name</span><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">Deadline</span><input type="date" className="input" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></label>
            <label className="block"><span className="label">Amount (₹)</span><input className="input" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
          </div>
          <button className="btn btn-primary" onClick={saveManual}>Track it</button>
        </div>
      )}

      <Link href="/discover" className="inline-block text-sm text-muted underline">Back to Discover</Link>
    </div>
  );
}
