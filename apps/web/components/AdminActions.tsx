"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AddSource() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [provider, setProvider] = useState("");
  const [kind, setKind] = useState("detail");
  const [useLlm, setUseLlm] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, provider: provider || null, kind, use_llm: useLlm }) });
    const j = await r.json().catch(() => ({ error: "Request failed" }));
    setBusy(false);
    setMsg(r.ok ? (j.note ?? (j.scholarship_id ? "Draft created. It is in the review list." : "Done.")) : j.error);
    if (r.ok) {
      setUrl("");
      router.refresh();
    }
  }
  return (
    <div className="space-y-3">
      <input className="input" placeholder="Official scholarship page or PDF URL" value={url} onChange={(e) => setUrl(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <input className="input" placeholder="Provider (optional)" value={provider} onChange={(e) => setProvider(e.target.value)} />
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="detail">Detail page</option>
          <option value="index">Index page (find links)</option>
          <option value="pdf">PDF</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-black" checked={useLlm} onChange={(e) => setUseLlm(e.target.checked)} />Allow LLM fallback for missing fields</label>
      <button className="btn btn-primary w-full" disabled={!url || busy} onClick={go}>{busy ? "Reading page (up to a minute)…" : "Ingest"}</button>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}

export function JobButton({ body, label }: { body: Record<string, unknown>; label: string }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  return (
    <button
      className="pill border-[1.5px] border-ink px-3 py-1 text-xs font-semibold"
      onClick={async () => {
        await fetch("/api/admin/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        setDone(true);
        router.refresh();
      }}
    >
      {done ? "Queued" : label}
    </button>
  );
}
