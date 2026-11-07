import Link from "next/link";
import type { PanelItem } from "./MatchPanel";
import { DeadlineChip, ReadinessBar, VERDICT, VerdictBadge } from "./ui";

export function ScholarshipCard({ it }: { it: PanelItem }) {
  const V = VERDICT[it.verdict];
  return (
    <Link href={`/scholarships/${it.slug}`} className="card flex flex-col gap-3 bg-cream-2 p-5 transition hover:bg-cream-3">
      <V.Shape className={`absolute -right-5 -top-5 h-20 w-20 ${V.deep} opacity-40`} />
      <div className="relative flex items-center gap-2">
        <VerdictBadge v={it.verdict} size="sm" />
        {it.tight && <span className="pill bg-ink px-2.5 py-0.5 text-[11px] font-semibold text-white">Tight timeline</span>}
      </div>
      <div className="relative">
        <h3 className="font-semibold leading-snug">{it.name}</h3>
        <p className="text-xs text-muted">{it.provider}</p>
      </div>
      <p className="relative line-clamp-2 text-sm text-ink/80">{it.reason}</p>
      <div className="relative mt-auto flex items-center justify-between gap-2">
        <span className="text-sm font-bold">{it.amount}</span>
        <DeadlineChip days={it.daysLeft} type={it.deadlineType} closed={it.closed} />
      </div>
      <ReadinessBar value={it.readiness} ready={it.docsReady} total={it.docsTotal} />
    </Link>
  );
}
