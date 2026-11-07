"use client";
import type { Verdict } from "@grantly/core";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";

export interface CalEvent {
  date: string;
  title: string;
  kind: "deadline" | "expiry" | "renewal";
  verdict?: Verdict;
  href?: string;
}

const DOT: Record<string, string> = { eligible: "bg-green", almost: "bg-yellow", need_info: "bg-blue", not_eligible: "bg-pink" };

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function MonthCalendar({ events, today }: { events: CalEvent[]; today: string }) {
  const t = new Date(today);
  const [cursor, setCursor] = useState(new Date(t.getFullYear(), t.getMonth(), 1));
  const [selected, setSelected] = useState<string>(today);
  const first = new Date(cursor);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: offset + days }, (_, i) => (i < offset ? null : new Date(cursor.getFullYear(), cursor.getMonth(), i - offset + 1)));
  const byDay = new Map<string, CalEvent[]>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const month = cursor.toLocaleString("en-IN", { month: "long", year: "numeric" });
  const sel = byDay.get(selected) ?? [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button aria-label="Previous month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ArrowLeft className="h-5 w-5" /></button>
        <span className="pill bg-pink px-4 py-1 text-sm font-semibold">{month}</span>
        <button aria-label="Next month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ArrowRight className="h-5 w-5" /></button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
        {["MO", "TU", "WE", "TH", "FR", "SA", "SU"].map((d) => (
          <span key={d} className="pb-2 font-semibold text-muted">{d}</span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const k = ymd(d);
          const ev = byDay.get(k) ?? [];
          const isToday = k === today;
          const isSel = k === selected;
          const weekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <button key={i} onClick={() => setSelected(k)} className={`relative mx-auto grid h-9 w-9 place-items-center rounded-full text-sm ${isToday ? "bg-pink font-bold" : isSel ? "border-[1.5px] border-ink" : ""} ${weekend && !isToday ? "text-muted" : ""}`}>
              {d.getDate()}
              {ev.length > 0 && (
                <span className="absolute bottom-0.5 flex gap-0.5">
                  {ev.slice(0, 3).map((e, j) => (
                    <span key={j} className={`h-1.5 w-1.5 rounded-full ${e.kind === "deadline" ? DOT[e.verdict ?? "need_info"] : "bg-ink"}`} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 min-h-10 space-y-1 text-sm">
        {sel.length === 0 ? <p className="text-xs text-muted">Nothing on this day.</p> : sel.map((e, i) => (
          <a key={i} href={e.href} className="block truncate rounded-lg bg-white px-3 py-1.5 text-xs font-medium">{e.title}</a>
        ))}
      </div>
    </div>
  );
}
