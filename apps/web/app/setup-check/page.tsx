"use client";
import { CheckCircle2, CircleAlert, CircleX, Loader2 } from "lucide-react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Check = { id: string; group: string; label: string; status: "pass" | "warn" | "fail"; detail: string; fix?: string };

const ICON = {
  pass: <CheckCircle2 className="h-5 w-5 text-green-deep" />,
  warn: <CircleAlert className="h-5 w-5 text-yellow-deep" />,
  fail: <CircleX className="h-5 w-5 text-pink-deep" />,
};
const TONE = { pass: "bg-green/30", warn: "bg-yellow/40", fail: "bg-pink/50" };

function Inner() {
  const sp = useSearchParams();
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(
    async (deep: boolean) => {
      setBusy(true);
      setErr(null);
      const q = new URLSearchParams();
      if (sp.get("token")) q.set("token", sp.get("token")!);
      if (deep) q.set("deep", "1");
      try {
        const r = await fetch(`/api/setup-check?${q}`, { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) setErr(j.error ?? "Check failed");
        else setChecks(j.checks);
      } catch {
        setErr("The check endpoint did not respond. Is the site deployed?");
      }
      setBusy(false);
    },
    [sp],
  );

  useEffect(() => {
    run(false);
  }, [run]);

  const groups = [...new Set((checks ?? []).map((c) => c.group))];
  const fails = (checks ?? []).filter((c) => c.status === "fail").length;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Setup check</h1>
        <p className="mt-1 text-sm text-muted">Shows whether every part of Grantly is connected, and exactly what to fix if not. No secret values are shown.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={busy} onClick={() => run(false)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Re-check</button>
        <button className="btn btn-outline" disabled={busy} onClick={() => run(true)}>Deep check (tests AI providers and OCR, ~20 s)</button>
      </div>
      {err && <p className="rounded-[14px] bg-pink p-3 text-sm">{err}</p>}
      {checks && (
        <p className={`rounded-[14px] p-3 text-sm font-semibold ${fails ? "bg-pink" : "bg-green"}`}>
          {fails ? `${fails} required item${fails === 1 ? "" : "s"} need fixing. Work from the top down.` : "All required items pass. Yellow items are optional or worth a look."}
        </p>
      )}
      {groups.map((g) => (
        <section key={g} className="space-y-2">
          <h2 className="text-lg font-semibold">{g}</h2>
          {checks!.filter((c) => c.group === g).map((c) => (
            <div key={c.id} className={`rounded-[16px] p-4 ${TONE[c.status]}`}>
              <div className="flex items-start gap-3">
                {ICON[c.status]}
                <div className="min-w-0">
                  <p className="font-semibold">{c.label}</p>
                  <p className="text-sm text-ink/70">{c.detail}</p>
                  {c.fix && <p className="mt-1 text-sm"><b>Fix:</b> {c.fix}</p>}
                </div>
              </div>
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}

export default function SetupCheck() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
