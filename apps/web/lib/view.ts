import { DOC_TYPES, formatAmount } from "@grantly/core";
import type { PanelItem } from "@/components/MatchPanel";
import type { Row } from "./data";

export function toPanel(r: Row): PanelItem {
  const ready = r.e.docs.filter((d) => d.state === "ready" || d.state === "expiring").length;
  return {
    slug: r.s.slug,
    name: r.s.name,
    provider: r.s.provider ?? null,
    amount: formatAmount(r.s),
    verdict: r.e.verdict,
    reason: r.e.reason,
    daysLeft: r.e.daysLeft,
    deadlineType: r.s.deadline_type,
    closed: r.e.closed,
    tight: r.tight,
    readiness: r.e.readiness,
    docsReady: ready,
    docsTotal: r.e.docs.length,
    missingDocs: r.e.docs.filter((d) => d.state === "missing" || d.state === "expired").map((d) => DOC_TYPES[d.doc_type]?.label ?? d.doc_type),
    other: r.s.other_conditions,
  };
}

export function todayIST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function inrShort(n: number) {
  if (n >= 1e7) return `₹${+(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${+(n / 1e5).toFixed(1)}L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
