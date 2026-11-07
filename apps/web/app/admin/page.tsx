import Link from "next/link";
import { AddSource, JobButton } from "@/components/AdminActions";
import { Stat, StatCard, Star4, Circle, Triangle } from "@/components/ui";
import { adminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Admin() {
  const db = adminClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: jobs }, { data: drafts }, { data: usage }, { data: crit }, { data: sources }, { data: pending }] = await Promise.all([
    db.from("jobs").select("id, type, status, error, llm_used, created_at, user_id, result").order("created_at", { ascending: false }).limit(25),
    db.from("scholarships").select("id, name, provider, created_at, owner_id").eq("status", "draft").order("created_at", { ascending: false }),
    db.from("llm_usage").select("*").eq("day", today),
    db.from("scholarship_criteria").select("source_method"),
    db.from("sources").select("*").order("created_at", { ascending: false }).limit(20),
    db.from("scholarships").select("id, name, owner_id").eq("visibility", "private").eq("track_only", false).eq("status", "published").limit(20),
  ]);
  const { data: runs } = await db.from("system_runs").select("*").order("name");
  const { data: provState } = await db.from("llm_provider_state").select("*");
  const calls = (usage ?? []).reduce((a, u) => a + u.calls, 0);
  const tokens = (usage ?? []).reduce((a, u) => a + u.tokens_in + u.tokens_out, 0);
  const fails = (usage ?? []).reduce((a, u) => a + u.failures, 0);
  const { data: flagged } = await db.from("scholarships").select("id, name, owner_id").eq("field_meta->>needs_review", "true").limit(20);
  const methods = { template: 0, rules: 0, llm: 0, manual: 0 } as Record<string, number>;
  for (const c of crit ?? []) methods[c.source_method] = (methods[c.source_method] ?? 0) + 1;
  const total = Object.values(methods).reduce((a, b) => a + b, 0) || 1;
  const pct = (k: string) => `${Math.round((methods[k] / total) * 100)}%`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Fields by method" tone="bg-green" Shape={Circle}>
          <div className="flex gap-4">
            <Stat n={pct("rules")} label="Rules" />
            <Stat n={pct("template")} label="Template" />
            <Stat n={pct("llm")} label="LLM" />
            <Stat n={pct("manual")} label="Manual" />
          </div>
        </StatCard>
        <StatCard title="LLM today" tone="bg-yellow" Shape={Star4}>
          <div className="flex gap-5">
            <Stat n={calls} label="Calls" />
            <Stat n={tokens} label="Tokens" />
            <Stat n={fails} label="Failed" />
          </div>
        </StatCard>
        <StatCard title="Review queue" tone="bg-pink" Shape={Triangle}>
          <div className="flex gap-5">
            <Stat n={drafts?.length ?? 0} label="Drafts" />
            <Stat n={pending?.length ?? 0} label="Student links" />
            <Stat n={flagged?.length ?? 0} label="Changed" />
          </div>
        </StatCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="card bg-cream-2 p-5">
            <h2 className="mb-3 text-lg font-semibold">Add a source</h2>
            <AddSource />
          </div>
          <div className="card bg-cream-2 p-5">
            <h2 className="mb-3 text-lg font-semibold">Sources</h2>
            <ul className="space-y-2 text-sm">
              {(sources ?? []).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.provider ?? s.url}</span>
                    <span className="block truncate text-xs text-muted">{s.kind} · tier {s.tier} · {s.last_fetched_at ? `checked ${new Date(s.last_fetched_at).toLocaleDateString("en-IN")}` : "never checked"}{s.last_error ? ` · ${s.last_error}` : ""}</span>
                  </span>
                  <JobButton body={{ action: "recheck", source_id: s.id }} label="Re-check" />
                </li>
              ))}
            </ul>
            <div className="mt-4"><JobButton body={{ action: "reminders" }} label="Queue reminders" /></div>
          </div>
          <div className="card bg-cream-2 p-5">
            <h2 className="mb-3 text-lg font-semibold">Background runs</h2>
            {(runs ?? []).length === 0 && <p className="text-sm text-muted">No GitHub Actions run recorded yet.</p>}
            <ul className="space-y-1 text-sm">
              {(runs ?? []).map((r) => (
                <li key={r.name} className="flex justify-between gap-2"><span>{r.name}</span><span className={r.ok ? "" : "text-pink-deep"}>{new Date(r.last_run_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span></li>
              ))}
            </ul>
            <h3 className="mb-2 mt-4 text-sm font-semibold">LLM providers today</h3>
            <ul className="space-y-1 text-sm">
              {(usage ?? []).map((u) => <li key={u.provider} className="flex justify-between"><span>{u.provider}</span><span>{u.calls} calls · {u.failures} failed · {u.tokens_in + u.tokens_out} tokens</span></li>)}
              {(provState ?? []).filter((p) => p.cooldown_until && new Date(p.cooldown_until) > new Date()).map((p) => <li key={p.provider} className="text-pink-deep">{p.provider} cooling down: {p.last_error?.slice(0, 60)}</li>)}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card bg-cream-2 p-5">
            <h2 className="mb-3 text-lg font-semibold">Drafts to review</h2>
            {(drafts ?? []).length === 0 && <p className="text-sm text-muted">Nothing to review.</p>}
            <ul className="space-y-2">
              {[...(drafts ?? []), ...(pending ?? []), ...(flagged ?? [])].map((d) => (
                <li key={d.id}>
                  <Link href={`/admin/review/${d.id}`} className="flex items-center justify-between rounded-[14px] bg-white px-4 py-3">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-xs text-muted">{d.owner_id ? "Student link" : flagged?.some((f) => f.id === d.id) ? "Changed on re-check" : "Ingested"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="card bg-cream-2 p-5">
            <h2 className="mb-3 text-lg font-semibold">Recent jobs</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted"><tr><th className="py-1">Type</th><th>Status</th><th>LLM</th><th>When</th><th>Note</th></tr></thead>
                <tbody>
                  {(jobs ?? []).map((j) => (
                    <tr key={j.id} className="border-t border-line">
                      <td className="py-2">{j.type}</td>
                      <td>{j.status}</td>
                      <td>{j.llm_used ? "yes" : "no"}</td>
                      <td className="whitespace-nowrap">{new Date(j.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td className="max-w-xs truncate text-xs text-muted">{j.error ?? (j.result as { note?: string } | null)?.note ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
