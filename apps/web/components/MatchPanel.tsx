"use client";
import type { Verdict } from "@grantly/core";
import Link from "next/link";
import { useState } from "react";
import { DeadlineChip, ReadinessBar, VerdictBadge, VerdictGlyph } from "./ui";

export interface PanelItem {
  slug: string;
  name: string;
  provider: string | null;
  amount: string;
  verdict: Verdict;
  reason: string;
  daysLeft: number | null;
  deadlineType: string;
  closed: boolean;
  tight: boolean;
  readiness: number;
  docsReady: number;
  docsTotal: number;
  missingDocs: string[];
  other: string[];
}

const TONE: Record<Verdict, string> = { eligible: "bg-green", almost: "bg-yellow", need_info: "bg-blue", not_eligible: "bg-pink" };

export function MatchPanel({ items }: { items: PanelItem[] }) {
  const [sel, setSel] = useState(0);
  const cur = items[sel];
  if (!cur) return null;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={it.slug}>
            <button onClick={() => setSel(i)} className={`flex w-full items-center gap-3 rounded-[18px] p-3 text-left transition ${i === sel ? TONE[it.verdict] : "bg-cream-2 hover:bg-cream-3"}`}>
              <span className={i === sel ? "rounded-full bg-white" : ""}><VerdictGlyph v={it.verdict} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{it.name}</span>
                <span className="block truncate text-xs text-ink/60">{it.provider}</span>
              </span>
              <DeadlineChip days={it.daysLeft} type={it.deadlineType} closed={it.closed} />
            </button>
          </li>
        ))}
      </ul>
      <div className={`card ${TONE[cur.verdict]} p-5`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/scholarships/${cur.slug}`} className="block text-lg font-semibold underline-offset-4 hover:underline">{cur.name}</Link>
            <p className="text-sm text-ink/70">{cur.provider}</p>
          </div>
          <span className="pill shrink-0 bg-white px-3 py-1 text-xs font-semibold">{cur.amount}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <VerdictBadge v={cur.verdict} />
          {cur.tight && <span className="pill bg-ink px-3 py-1 text-xs font-semibold text-white">Tight timeline</span>}
        </div>
        <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-3 text-sm">
          <dt className="text-ink/60">Why</dt>
          <dd className="font-medium">{cur.reason}</dd>
          <dt className="text-ink/60">Documents</dt>
          <dd><ReadinessBar value={cur.readiness} ready={cur.docsReady} total={cur.docsTotal} /></dd>
          {cur.missingDocs.length > 0 && (
            <>
              <dt className="text-ink/60">Still needed</dt>
              <dd className="flex flex-wrap gap-1.5">{cur.missingDocs.map((d) => <span key={d} className="pill bg-white/70 px-2.5 py-0.5 text-xs">{d}</span>)}</dd>
            </>
          )}
          {cur.other.length > 0 && (
            <>
              <dt className="text-ink/60">Also note</dt>
              <dd className="text-ink/80">{cur.other[0]}</dd>
            </>
          )}
        </dl>
        <div className="mt-5 flex gap-2">
          <Link href={`/scholarships/${cur.slug}`} className="btn btn-primary">View details</Link>
        </div>
      </div>
    </div>
  );
}
