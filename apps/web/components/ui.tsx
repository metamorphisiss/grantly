import type { Verdict } from "@grantly/core";
import Link from "next/link";
import type { ReactNode } from "react";

export function Circle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <circle cx="50" cy="50" r="50" fill="currentColor" />
    </svg>
  );
}
export function HalfCircle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path d="M0 100 A50 50 0 0 1 100 100 Z" transform="translate(0,-25)" fill="currentColor" />
    </svg>
  );
}
export function Star4({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path d="M50 0 C55 35 65 45 100 50 C65 55 55 65 50 100 C45 65 35 55 0 50 C35 45 45 35 50 0 Z" fill="currentColor" />
    </svg>
  );
}
export function Triangle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path d="M50 4 L98 94 L2 94 Z" fill="currentColor" />
    </svg>
  );
}

export const VERDICT: Record<Verdict, { label: string; bg: string; deep: string; Shape: typeof Circle }> = {
  eligible: { label: "Eligible", bg: "bg-green", deep: "text-green-deep", Shape: Circle },
  almost: { label: "Almost", bg: "bg-yellow", deep: "text-yellow-deep", Shape: HalfCircle },
  need_info: { label: "Need info", bg: "bg-blue", deep: "text-blue-deep", Shape: Star4 },
  not_eligible: { label: "Not eligible", bg: "bg-pink", deep: "text-pink-deep", Shape: Triangle },
};

export function VerdictBadge({ v, size = "md" }: { v: Verdict; size?: "sm" | "md" }) {
  const c = VERDICT[v];
  return (
    <span className={`pill inline-flex items-center gap-1.5 ${c.bg} text-ink font-semibold ${size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs"}`}>
      <c.Shape className={`${size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} text-ink`} />
      {c.label}
    </span>
  );
}

export function VerdictGlyph({ v }: { v: Verdict }) {
  const c = VERDICT[v];
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${c.bg}`}>
      <c.Shape className="h-4 w-4 text-ink" />
    </span>
  );
}

export function DeadlineChip({ days, type, closed }: { days: number | null; type?: string; closed?: boolean }) {
  let text: string;
  let cls = "bg-white text-ink";
  if (closed) {
    text = "Closed";
    cls = "bg-cream-3 text-muted";
  } else if (days === null) text = type === "rolling" ? "Rolling" : "No deadline";
  else if (days === 0) {
    text = "Today";
    cls = "bg-ink text-white";
  } else {
    text = `${days}d left`;
    if (days <= 7) cls = "bg-ink text-white";
  }
  return <span className={`pill px-3 py-1 text-xs font-semibold whitespace-nowrap ${cls}`}>{text}</span>;
}

export function ReadinessBar({ value, total, ready }: { value: number; total: number; ready: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {Array.from({ length: Math.max(total, 1) }).map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < ready ? "bg-ink" : "bg-ink/15"}`} />
        ))}
      </div>
      <span className="text-[11px] font-semibold text-muted whitespace-nowrap">
        {total ? `${ready}/${total} docs` : "No docs listed"}
      </span>
      <span className="sr-only">{Math.round(value * 100)}% ready</span>
    </div>
  );
}

export function StatCard({ title, tone, Shape, children, href }: { title: string; tone: string; Shape: typeof Circle; children: ReactNode; href?: string }) {
  const body = (
    <div className={`card ${tone} p-5 h-full min-h-[170px]`}>
      <Shape className="absolute -right-6 -top-6 h-36 w-36 text-black/10" />
      <h3 className="relative text-lg font-semibold">{title}</h3>
      <div className="relative mt-3">{children}</div>
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

export function Stat({ n, label }: { n: string | number; label: string }) {
  return (
    <div>
      <div className="text-xl font-bold leading-none">{n}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-ink/60">{label}</div>
    </div>
  );
}

export function Bars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-16 items-end gap-1.5">
      {values.map((v, i) => (
        <span key={i} className="w-2.5 rounded-full bg-ink" style={{ height: `${Math.max(8, (v / max) * 100)}%`, opacity: v ? 1 : 0.2 }} />
      ))}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">{children}</h2>
      {right}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card bg-cream-2 p-8 text-center">
      <Star4 className="mx-auto h-10 w-10 text-blue-deep" />
      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
