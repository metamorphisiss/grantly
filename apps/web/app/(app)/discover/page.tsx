import Link from "next/link";
import type { Verdict } from "@grantly/core";
import { ScholarshipCard } from "@/components/ScholarshipCard";
import { Empty, SectionTitle, VERDICT } from "@/components/ui";
import { loadDocuments, loadScholarships, rankAll, requireProfile } from "@/lib/data";
import { toPanel } from "@/lib/view";

type SP = Promise<{ verdict?: string; scope?: string; q?: string }>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function Discover({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { profile } = await requireProfile();
  const [list, docs] = await Promise.all([loadScholarships(), loadDocuments()]);
  const scope = sp.scope ?? "all";
  const p = { ...profile, scope_pref: scope === "india" ? (["india"] as const) : scope === "abroad" ? (["abroad"] as const) : (["india", "abroad"] as const) };
  let rows = rankAll(list, { ...p, scope_pref: [...p.scope_pref] }, docs);
  if (sp.q) {
    const q = sp.q.toLowerCase();
    rows = rows.filter((r) => `${r.s.name} ${r.s.provider ?? ""}`.toLowerCase().includes(q));
  }
  const open = rows.filter((r) => !r.e.closed);
  const closed = rows.filter((r) => r.e.closed);
  const v = sp.verdict as Verdict | undefined;
  const shown = v ? open.filter((r) => r.e.verdict === v) : open;
  const count = (x: Verdict) => open.filter((r) => r.e.verdict === x).length;

  const href = (k: string, val?: string) => {
    const n = new URLSearchParams({ ...(sp.scope ? { scope: sp.scope } : {}), ...(sp.verdict ? { verdict: sp.verdict } : {}), ...(sp.q ? { q: sp.q } : {}) });
    if (val) n.set(k, val);
    else n.delete(k);
    return `/discover?${n.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Discover</h1>
          <p className="mt-1 text-sm text-muted">{open.length} open scholarships, ranked by fit, amount, urgency and how ready you are.</p>
        </div>
        <div className="flex rounded-full bg-cream-2 p-1">
          {[["all", "All"], ["india", "India"], ["abroad", "Abroad"]].map(([k, l]) => (
            <Link key={k} href={href("scope", k === "all" ? undefined : k)} className={`pill px-4 py-1.5 text-sm font-semibold ${scope === k ? "bg-ink text-white" : ""}`}>{l}</Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={href("verdict")} className={`pill px-4 py-1.5 text-sm font-semibold ${!v ? "bg-ink text-white" : "border-[1.5px] border-line"}`}>All ({open.length})</Link>
        {(["eligible", "almost", "need_info", "not_eligible"] as Verdict[]).map((x) => {
          const C = VERDICT[x];
          return (
            <Link key={x} href={href("verdict", x)} className={`pill inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold ${v === x ? `${C.bg}` : "border-[1.5px] border-line"}`}>
              <C.Shape className="h-3 w-3" />{C.label} ({count(x)})
            </Link>
          );
        })}
        <Link href="/add-link" className="pill ml-auto border-[1.5px] border-dashed border-ink px-4 py-1.5 text-sm font-semibold">Add via link</Link>
      </div>

      {shown.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{shown.map((r) => <ScholarshipCard key={r.s.id} it={toPanel(r)} />)}</div>
      ) : (
        <Empty title="Nothing here yet" body={v === "need_info" ? "Nice, your profile answers everything these scholarships ask." : "Try another filter, or complete your profile to settle more matches."} action={<Link href="/profile" className="btn btn-primary">Edit profile</Link>} />
      )}

      {closed.length > 0 && !v && (
        <section className="pt-4">
          <SectionTitle>Opens soon</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {closed.map((r) => (
              <Link key={r.s.id} href={`/scholarships/${r.s.slug}`} className="rounded-[18px] border-[1.5px] border-dashed border-line p-4">
                <p className="font-semibold">{r.s.name}</p>
                <p className="text-xs text-muted">Closed for this cycle{r.s.reopens_month ? `, usually reopens around ${MONTHS[r.s.reopens_month - 1]}` : ""}.</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
