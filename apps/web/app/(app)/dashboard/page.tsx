import Link from "next/link";
import { DOC_TYPES, annualAmountInr, docStatuses, type Verdict } from "@grantly/core";
import { MonthCalendar, type CalEvent } from "@/components/Calendar";
import { MatchPanel } from "@/components/MatchPanel";
import { Bars, Circle, Empty, HalfCircle, SectionTitle, Stat, StatCard, Star4, Triangle } from "@/components/ui";
import { loadApplications, loadDocuments, loadScholarships, rankAll, requireProfile } from "@/lib/data";
import { greeting, inrShort, toPanel, todayIST } from "@/lib/view";

const FIELDS_FOR_COMPLETENESS = ["course_level", "stream", "year_of_study", "marks_value", "family_income_inr", "state", "gender", "category"];

export default async function Dashboard() {
  const { row, profile } = await requireProfile();
  const [list, docs, apps] = await Promise.all([loadScholarships(), loadDocuments(), loadApplications()]);
  const rows = rankAll(list, profile, docs);
  const open = rows.filter((r) => !r.e.closed);
  const counts: Record<Verdict, number> = { eligible: 0, almost: 0, need_info: 0, not_eligible: 0 };
  for (const r of open) counts[r.e.verdict]++;

  const winnable = open.filter((r) => r.e.verdict === "eligible" || r.e.verdict === "almost");
  const potentialIndia = winnable.filter((r) => r.s.scope === "domestic").reduce((a, r) => a + (annualAmountInr(r.s) ?? 0), 0);
  const potentialAbroad = winnable.filter((r) => r.s.scope === "international").reduce((a, r) => a + (annualAmountInr(r.s) ?? 0), 0);
  const fullFunded = winnable.filter((r) => r.s.coverage === "full").length;

  const today = todayIST();
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const docState = docs.map((d) => ({ d, s: docStatuses([d.doc_type], [d], now, in30)[0].state }));
  const docCounts = { ready: docState.filter((x) => x.s === "ready").length, expiring: docState.filter((x) => x.s === "expiring").length, expired: docState.filter((x) => x.s === "expired").length };
  const neededTypes = new Set(winnable.flatMap((r) => r.s.required_documents));
  const missingTypes = [...neededTypes].filter((t) => !docs.some((d) => d.doc_type === t));

  const appCounts = { preparing: 0, applied: 0, awaiting: 0 } as Record<string, number>;
  for (const a of apps) if (a.status in appCounts) appCounts[a.status]++;

  const filled = FIELDS_FOR_COMPLETENESS.filter((f) => row[f] != null).length;
  const completeness = Math.round((filled / FIELDS_FOR_COMPLETENESS.length) * 100);
  const needInfo = open.filter((r) => r.e.verdict === "need_info");
  const missingFieldCounts = new Map<string, number>();
  for (const r of needInfo) for (const c of r.e.results.filter((x) => x.status === "unknown")) missingFieldCounts.set(c.criterion.field, (missingFieldCounts.get(c.criterion.field) ?? 0) + 1);
  const topMissing = [...missingFieldCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const week = open.filter((r) => r.e.verdict !== "not_eligible").slice(0, 5).map(toPanel);
  const closing = open.filter((r) => r.e.daysLeft !== null && r.e.daysLeft <= 30 && r.e.verdict !== "not_eligible").length;
  const expSoon = docState.find((x) => x.s === "expiring" || x.s === "expired");

  const events: CalEvent[] = [
    ...rows.filter((r) => r.s.deadline && r.e.verdict !== "not_eligible").map((r) => ({ date: r.s.deadline!, title: `Deadline: ${r.s.name}`, kind: "deadline" as const, verdict: r.e.verdict, href: `/scholarships/${r.s.slug}` })),
    ...docs.filter((d) => d.valid_until).map((d) => ({ date: d.valid_until!, title: `${DOC_TYPES[d.doc_type]?.label ?? d.doc_type} expires`, kind: "expiry" as const, href: "/vault" })),
    ...apps.filter((a) => a.renewal_due).map((a) => ({ date: a.renewal_due!, title: `Renewal: ${a.scholarships.name}`, kind: "renewal" as const, href: "/applications" })),
  ];
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);

  const name = (row.full_name as string | null)?.split(" ")[0] ?? "there";
  const summary = [
    `You match ${counts.eligible} scholarship${counts.eligible === 1 ? "" : "s"}${potentialIndia ? ` worth up to ${inrShort(potentialIndia)} a year` : ""}.`,
    closing ? `${closing} close in the next 30 days.` : null,
    expSoon ? `Your ${DOC_TYPES[expSoon.d.doc_type]?.label.toLowerCase()} ${expSoon.s === "expired" ? "has expired" : "expires soon"}.` : null,
  ].filter(Boolean).join(" ");

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{greeting()}, {name}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">{summary}</p>
        </div>

        {completeness < 100 && topMissing && (
          <Link href="/profile" className="flex items-center justify-between gap-4 rounded-[18px] border-[1.5px] border-ink px-4 py-3">
            <span className="text-sm"><b>Profile {completeness}%.</b> Add your {topMissing[0].replace(/_/g, " ").replace(" inr", "")} to settle {topMissing[1]} more match{topMissing[1] === 1 ? "" : "es"}.</span>
            <span className="pill bg-ink px-3 py-1 text-xs font-semibold text-white">Complete</span>
          </Link>
        )}

        <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
          <StatCard title="Matches" tone="bg-yellow" Shape={Star4} href="/discover">
            <div className="flex gap-5">
              <Stat n={counts.eligible} label="Eligible" />
              <Stat n={counts.almost} label="Almost" />
              <Stat n={counts.need_info} label="Need info" />
            </div>
            <div className="mt-4"><Bars values={[counts.eligible, counts.almost, counts.need_info, counts.not_eligible]} /></div>
          </StatCard>
          <StatCard title="Potential amount" tone="bg-pink" Shape={Circle} href="/discover?verdict=eligible">
            <div className="flex gap-6">
              <Stat n={potentialIndia ? inrShort(potentialIndia) : "—"} label="India, per year" />
              <Stat n={potentialAbroad ? inrShort(potentialAbroad) : "—"} label="Abroad, approx" />
              <Stat n={fullFunded} label="Fully funded" />
            </div>
            <p className="mt-6 max-w-sm text-xs text-ink/60">Total of scholarships you are eligible or almost eligible for. Foreign amounts use an approximate rate.</p>
          </StatCard>
          <StatCard title="Documents" tone="bg-green" Shape={Triangle} href="/vault">
            <div className="flex gap-5">
              <Stat n={docCounts.ready} label="Ready" />
              <Stat n={docCounts.expiring + docCounts.expired} label="Expiring" />
              <Stat n={missingTypes.length} label="Missing" />
            </div>
          </StatCard>
          <StatCard title="Applications" tone="bg-blue" Shape={HalfCircle} href="/applications">
            <div className="flex gap-6">
              <Stat n={appCounts.preparing} label="Preparing" />
              <Stat n={appCounts.applied} label="Applied" />
              <Stat n={appCounts.awaiting} label="Awaiting" />
            </div>
          </StatCard>
        </div>

        <section>
          <SectionTitle right={<Link href="/discover" className="pill bg-ink px-4 py-1.5 text-xs font-semibold text-white">All matches</Link>}>Start this week</SectionTitle>
          {week.length ? (
            <MatchPanel items={week} />
          ) : (
            <Empty title="No open matches yet" body="Complete your profile or switch on the Abroad track to see more scholarships." action={<Link href="/profile" className="btn btn-primary">Complete profile</Link>} />
          )}
        </section>
      </div>

      <aside className="space-y-6">
        <div className="card bg-cream-2 p-5">
          <MonthCalendar events={events} today={today} />
          <Link href="/calendar" className="btn btn-primary mt-4 w-full">Open calendar</Link>
        </div>
        <div>
          <SectionTitle>Upcoming</SectionTitle>
          <ol className="relative space-y-3 border-l-[1.5px] border-dashed border-line pl-4">
            {upcoming.length === 0 && <li className="text-sm text-muted">Nothing coming up.</li>}
            {upcoming.map((e, i) => (
              <li key={i}>
                <a href={e.href} className={`block rounded-[16px] p-3 ${e.kind === "deadline" ? { eligible: "bg-green", almost: "bg-yellow", need_info: "bg-blue", not_eligible: "bg-pink" }[e.verdict ?? "need_info"] : "bg-cream-2"}`}>
                  <span className="text-[11px] font-semibold text-ink/60">{new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  <span className="block truncate text-sm font-semibold">{e.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}
