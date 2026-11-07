import type { Criterion, Profile, Scholarship, UserDocument } from "./schemas";
import { DOC_TYPES } from "./vocab";

export type CriterionStatus = "pass" | "fail" | "unknown" | "expired";
export type Verdict = "eligible" | "almost" | "need_info" | "not_eligible";

export interface CriterionResult {
  criterion: Criterion;
  status: CriterionStatus;
  yours: string | null;
  required: string;
  hint: string | null;
  close: boolean;
}

export interface DocStatus {
  doc_type: string;
  label: string;
  state: "ready" | "expiring" | "expired" | "missing";
}

export interface Evaluation {
  verdict: Verdict;
  reason: string;
  results: CriterionResult[];
  docs: DocStatus[];
  readiness: number;
  closed: boolean;
  daysLeft: number | null;
}

const FIELD_LABEL: Record<string, string> = {
  course_level: "Course level",
  stream: "Stream",
  year_of_study: "Year of study",
  marks_percent: "Marks",
  cgpa: "CGPA",
  family_income_inr: "Family income",
  state: "State of domicile",
  gender: "Gender",
  category: "Category",
  minority: "Minority community",
  disability: "Disability",
  nationality: "Nationality",
  target_countries: "Study destination",
  english_test_score: "English test score",
  work_experience_years: "Work experience",
};

export function fieldLabel(f: string) {
  return FIELD_LABEL[f] ?? f;
}

function fmtInr(n: number) {
  if (n >= 100000) return `₹${+(n / 100000).toFixed(2)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtValue(field: string, v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return v.map((x) => fmtValue(field, x)).join(", ");
  if (field === "family_income_inr" && typeof v === "number") return fmtInr(v);
  if (field === "marks_percent" && typeof v === "number") return `${v}%`;
  if (field === "work_experience_years" && typeof v === "number") return `${v} yrs`;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") {
    const o = v as { min?: number; scale?: number };
    if (o.min !== undefined) return `${o.min}${o.scale ? ` / ${o.scale}` : ""}`;
  }
  return String(v);
}

function opText(op: string, field: string, value: unknown) {
  const v = fmtValue(field, value);
  switch (op) {
    case "<=": return `at most ${v}`;
    case "<": return `below ${v}`;
    case ">=": return `at least ${v}`;
    case ">": return `above ${v}`;
    case "=": return v;
    case "in": return v;
    case "not_in": return `not ${v}`;
    case "is_true": return "Required";
    default: return v;
  }
}

function profileValue(p: Profile, field: string): unknown {
  switch (field) {
    case "marks_percent":
      return p.marks_system === "percent" ? p.marks_value : p.marks_system === "cgpa" ? "__wrong_system" : null;
    case "cgpa":
      return p.marks_system === "cgpa" ? { value: p.marks_value, scale: p.cgpa_scale } : p.marks_system === "percent" ? "__wrong_system" : null;
    default:
      return (p as Record<string, unknown>)[field] ?? null;
  }
}

function compare(op: string, a: number, b: number) {
  switch (op) {
    case "<=": return a <= b;
    case "<": return a < b;
    case ">=": return a >= b;
    case ">": return a > b;
    case "=": return a === b;
    default: return false;
  }
}

function isClose(field: string, op: string, have: number, need: number) {
  if (!["<=", "<", ">=", ">"].includes(op)) return false;
  const gap = Math.abs(have - need);
  if (field === "marks_percent") return gap <= 3;
  if (field === "family_income_inr") return gap <= need * 0.1;
  if (field === "english_test_score") return gap <= 0.5;
  return false;
}

export function evaluateCriterion(c: Criterion, p: Profile, docs: UserDocument[], refDate: Date): CriterionResult {
  const raw = profileValue(p, c.field);
  const base = { criterion: c, required: opText(c.op, c.field, c.value), close: false };

  if (raw === "__wrong_system") {
    const want = c.field === "cgpa" ? "CGPA" : "percentage";
    return { ...base, status: "unknown", yours: null, hint: `This scholarship uses ${want}. Add it from your marksheet.` };
  }
  if (raw === null || raw === undefined || (Array.isArray(raw) && raw.length === 0)) {
    return { ...base, status: "unknown", yours: null, hint: `Add your ${fieldLabel(c.field).toLowerCase()}` };
  }

  let pass = false;
  let close = false;
  let yours: string;

  if (c.field === "cgpa") {
    const r = raw as { value: number | null; scale: number | null };
    const need = c.value as { min: number; scale: number };
    yours = `${r.value} / ${r.scale}`;
    if (r.value == null || r.scale == null) return { ...base, status: "unknown", yours: null, hint: "Add your CGPA and its scale" };
    if (r.scale !== need.scale) {
      return { ...base, status: "unknown", yours, hint: `Requires CGPA on a ${need.scale}-point scale. Check your marksheet for the official conversion.` };
    }
    pass = r.value >= need.min;
  } else if (c.op === "in" || c.op === "not_in") {
    const allowed = (Array.isArray(c.value) ? c.value : [c.value]).map((x: unknown) => String(x).toLowerCase());
    const have = (Array.isArray(raw) ? raw : [raw]).map((x) => String(x).toLowerCase());
    const hit = have.some((h) => allowed.includes(h));
    pass = c.op === "in" ? hit : !hit;
    yours = fmtValue(c.field, raw);
  } else if (c.op === "is_true") {
    pass = raw === true;
    yours = fmtValue(c.field, raw);
  } else {
    const a = Number(raw);
    const b = Number(c.value);
    pass = compare(c.op, a, b);
    if (!pass) close = isClose(c.field, c.op, a, b);
    yours = fmtValue(c.field, raw);
  }

  if (!pass) {
    let hint: string | null = null;
    if (close && c.field === "marks_percent") hint = `Close: ${Math.abs(Number(raw) - Number(c.value)).toFixed(1)}% short`;
    else if (close) hint = "Close to the limit";
    return { ...base, status: "fail", yours, hint, close };
  }

  if (c.fixable_by) {
    const doc = docs.find((d) => d.doc_type === c.fixable_by);
    if (doc?.valid_until && new Date(doc.valid_until) < refDate) {
      const label = DOC_TYPES[c.fixable_by]?.label ?? c.fixable_by;
      return { ...base, status: "expired", yours, hint: `Your ${label.toLowerCase()} has expired. Get a current one.`, close: false };
    }
  }
  return { ...base, status: "pass", yours, hint: null };
}

const RANK: Record<Verdict, number> = { eligible: 0, almost: 1, need_info: 2, not_eligible: 3 };

function groupVerdict(rs: CriterionResult[]): Verdict {
  const hard = rs.filter((r) => r.criterion.kind !== "soft");
  if (hard.some((r) => r.status === "fail")) return "not_eligible";
  if (hard.some((r) => r.status === "unknown")) return "need_info";
  if (hard.some((r) => r.status === "expired")) return "almost";
  return "eligible";
}

export function docStatuses(required: string[], docs: UserDocument[], refDate: Date, deadline: Date | null): DocStatus[] {
  return required.map((t) => {
    const label = DOC_TYPES[t]?.label ?? t;
    const d = docs.find((x) => x.doc_type === t);
    if (!d) return { doc_type: t, label, state: "missing" as const };
    if (d.valid_until) {
      const vu = new Date(d.valid_until);
      if (vu < refDate) return { doc_type: t, label, state: "expired" as const };
      if (deadline && vu < deadline) return { doc_type: t, label, state: "expiring" as const };
    }
    return { doc_type: t, label, state: "ready" as const };
  });
}

export function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
}

export function evaluate(s: Scholarship, p: Profile, docs: UserDocument[] = [], now: Date = new Date()): Evaluation {
  const deadline = s.deadline ? new Date(s.deadline + "T23:59:59+05:30") : null;
  const daysLeft = deadline ? daysBetween(now, deadline) : null;
  const closed = daysLeft !== null && daysLeft < 0;
  const docsState = docStatuses(s.required_documents, docs, now, deadline);
  const ready = docsState.filter((d) => d.state === "ready" || d.state === "expiring").length;
  const readiness = docsState.length ? ready / docsState.length : 1;

  if (s.track_only || s.criteria.length === 0) {
    return { verdict: "need_info", reason: s.track_only ? "Tracking only. Eligibility couldn't be read from the source." : "No eligibility rules recorded yet", results: [], docs: docsState, readiness, closed, daysLeft };
  }

  const groups = new Map<number, CriterionResult[]>();
  for (const c of s.criteria) {
    const r = evaluateCriterion(c, p, docs, now);
    const g = c.group_no ?? 0;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(r);
  }

  let best: { v: Verdict; rs: CriterionResult[] } | null = null;
  for (const rs of groups.values()) {
    const v = groupVerdict(rs);
    if (!best || RANK[v] < RANK[best.v] || (RANK[v] === RANK[best.v] && countBad(rs) < countBad(best.rs))) best = { v, rs };
  }
  const { v, rs } = best!;
  return { verdict: v, reason: reasonFor(v, rs, s), results: rs, docs: docsState, readiness, closed, daysLeft };
}

function countBad(rs: CriterionResult[]) {
  return rs.filter((r) => r.status !== "pass").length;
}

function reasonFor(v: Verdict, rs: CriterionResult[], s: Scholarship): string {
  if (v === "eligible") {
    const matched = rs.slice(0, 3).map((r) => fieldLabel(r.criterion.field).toLowerCase()).join(", ");
    return s.other_conditions.length ? `Matches ${matched}. Subject to further conditions.` : `Matches ${matched}`;
  }
  if (v === "almost") return rs.find((r) => r.status === "expired")?.hint ?? "One document needs renewing";
  if (v === "need_info") {
    const missing = rs.filter((r) => r.status === "unknown");
    return missing[0]?.hint ?? `Add ${missing.map((r) => fieldLabel(r.criterion.field).toLowerCase()).join(", ")}`;
  }
  const f = rs.find((r) => r.status === "fail")!;
  const head = `Requires ${fieldLabel(f.criterion.field).toLowerCase()} ${f.required}`;
  return f.close && f.hint ? `${head}. ${f.hint}` : `${head}, you have ${f.yours}`;
}
