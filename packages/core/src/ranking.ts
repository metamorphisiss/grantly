import type { Evaluation } from "./matcher";
import type { Scholarship } from "./schemas";

export const APPROX_INR: Record<string, number> = { INR: 1, USD: 84, GBP: 107, EUR: 91, AUD: 55, CAD: 61, JPY: 0.56, SGD: 63 };

export function annualAmountInr(s: Scholarship): number | null {
  const v = s.amount_max ?? s.amount_min;
  if (v == null) return null;
  const rate = APPROX_INR[s.amount_currency] ?? 1;
  const mult = s.amount_period === "month" ? 12 : 1;
  return v * rate * mult;
}

const FIT: Record<string, number> = { eligible: 1, almost: 0.6, need_info: 0.4, not_eligible: 0 };

export interface Ranked {
  score: number;
  tight: boolean;
}

export function priority(s: Scholarship, e: Evaluation, minPrepDays = 7): Ranked {
  if (e.closed || e.verdict === "not_eligible") return { score: 0, tight: false };
  const fit = FIT[e.verdict];
  const amt = annualAmountInr(s);
  const amountTerm = amt ? Math.log10(1 + amt) : s.coverage === "full" ? 6 : 3;
  const d = e.daysLeft;
  const urgency = d === null ? 0.3 : Math.min(1, 1 / Math.sqrt(Math.max(d, 1)) * 3);
  const readiness = 0.4 + 0.6 * e.readiness;
  const tight = d !== null && d < minPrepDays && e.readiness < 0.6;
  const score = fit * amountTerm * (tight ? 0.3 : urgency) * readiness;
  return { score: +score.toFixed(4), tight };
}

export function formatAmount(s: Scholarship): string {
  if (s.amount_min == null && s.amount_max == null) {
    if (s.coverage === "full") return "Full funding";
    if (s.coverage === "partial") return "Partial funding";
    return "Amount varies";
  }
  const sym: Record<string, string> = { INR: "₹", USD: "$", GBP: "£", EUR: "€", AUD: "A$", CAD: "C$" };
  const c = sym[s.amount_currency] ?? s.amount_currency + " ";
  const f = (n: number) => (s.amount_currency === "INR" ? n.toLocaleString("en-IN") : n.toLocaleString("en-US"));
  const per = s.amount_period === "year" ? " / year" : s.amount_period === "month" ? " / month" : "";
  if (s.amount_min != null && s.amount_max != null && s.amount_min !== s.amount_max) return `${c}${f(s.amount_min)}–${f(s.amount_max)}${per}`;
  return `${c}${f((s.amount_max ?? s.amount_min)!)}${per}`;
}
