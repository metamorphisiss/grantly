import { DOC_TYPES } from "@grantly/core";
import { MonthCalendar, type CalEvent } from "@/components/Calendar";
import { SectionTitle } from "@/components/ui";
import { loadApplications, loadDocuments, loadScholarships, rankAll, requireProfile } from "@/lib/data";
import { todayIST } from "@/lib/view";

const TONE: Record<string, string> = { eligible: "bg-green", almost: "bg-yellow", need_info: "bg-blue", not_eligible: "bg-pink" };

export default async function CalendarPage() {
  const { profile } = await requireProfile();
  const [list, docs, apps] = await Promise.all([loadScholarships(), loadDocuments(), loadApplications()]);
  const rows = rankAll(list, profile, docs);
  const today = todayIST();
  const events: CalEvent[] = [
    ...rows.filter((r) => r.s.deadline && r.e.verdict !== "not_eligible").map((r) => ({ date: r.s.deadline!, title: `Deadline: ${r.s.name}`, kind: "deadline" as const, verdict: r.e.verdict, href: `/scholarships/${r.s.slug}` })),
    ...docs.filter((d) => d.valid_until).map((d) => ({ date: d.valid_until!, title: `${DOC_TYPES[d.doc_type]?.label ?? d.doc_type} expires`, kind: "expiry" as const, href: "/vault" })),
    ...apps.filter((a) => a.renewal_due).map((a) => ({ date: a.renewal_due!, title: `Renewal: ${a.scholarships.name}`, kind: "renewal" as const, href: "/applications" })),
  ];
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <div className="card h-fit bg-cream-2 p-5"><MonthCalendar events={events} today={today} /></div>
      <div>
        <SectionTitle>Timeline</SectionTitle>
        <ol className="relative space-y-3 border-l-[1.5px] border-dashed border-line pl-5">
          {upcoming.length === 0 && <li className="text-sm text-muted">Nothing coming up.</li>}
          {upcoming.map((e, i) => (
            <li key={i}>
              <a href={e.href} className={`flex items-center justify-between gap-3 rounded-[16px] p-4 ${e.kind === "deadline" ? TONE[e.verdict ?? "need_info"] : "bg-cream-2"}`}>
                <span className="font-semibold">{e.title}</span>
                <span className="pill bg-white px-3 py-1 text-xs font-semibold">{new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
