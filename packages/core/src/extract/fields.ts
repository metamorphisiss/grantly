import * as chrono from "chrono-node";
import { CATEGORIES, COUNTRIES, COURSE_LEVELS, MINORITIES, STATES, STREAMS, matchDocTypes, matchVocab } from "../vocab";
import { sentencesWith, shorten, splitSentences } from "./text";

export interface Found<T> {
  value: T;
  evidence: string;
  confidence: number;
  method: "rules" | "template" | "llm" | "manual";
  conflict?: boolean;
}

const MULT: Record<string, number> = { lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, l: 1e5, crore: 1e7, crores: 1e7, cr: 1e7, k: 1e3, thousand: 1e3, million: 1e6 };
const CUR: Record<string, string> = { "₹": "INR", rs: "INR", "rs.": "INR", inr: "INR", $: "USD", usd: "USD", "£": "GBP", gbp: "GBP", "€": "EUR", eur: "EUR" };

const MONEY_RE = /(₹|rs\.?|inr|\$|usd|£|gbp|€|eur)\s*([\d,]+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|k|thousand|million|l\b)?|([\d,]+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|thousand|million)\b(?:\s*(rupees|inr))?|([\d,]+(?:\.\d+)?)\s*(rupees|inr|usd|gbp|eur)\b/gi;

export interface Money {
  amount: number;
  currency: string;
  index: number;
}

export function findMoney(s: string): Money[] {
  const out: Money[] = [];
  for (const m of s.matchAll(MONEY_RE)) {
    let cur = "INR";
    let num: string;
    let mul: string | undefined;
    if (m[2]) {
      cur = CUR[m[1].toLowerCase()] ?? "INR";
      num = m[2];
      mul = m[3];
    } else if (m[4]) {
      num = m[4];
      mul = m[5];
    } else {
      num = m[7];
      cur = CUR[m[8].toLowerCase()] ?? "INR";
    }
    const n = parseFloat(num.replace(/,/g, ""));
    if (!isFinite(n)) continue;
    const amount = n * (mul ? MULT[mul.toLowerCase()] ?? 1 : 1);
    if (amount < 100) continue;
    out.push({ amount, currency: cur, index: m.index ?? 0 });
  }
  return out;
}

export function extractDeadline(text: string, ref: Date = new Date()): Found<string> | null {
  const sents = sentencesWith(text, ["last date", "deadline", "closing date", "closes on", "apply by", "apply before", "due date", "submission date", "applications close"]);
  const hits: { date: string; sent: string }[] = [];
  for (const s of sents) {
    const parsed = chrono.en.GB.parse(s, ref, { forwardDate: false });
    for (const p of parsed) {
      const d = p.start.date();
      if (!p.start.isCertain("day") || !p.start.isCertain("month")) continue;
      hits.push({ date: iso(d), sent: s });
    }
  }
  if (!hits.length) return null;
  const distinct = [...new Set(hits.map((h) => h.date))];
  const latest = distinct.sort().at(-1)!;
  const ev = hits.find((h) => h.date === latest)!.sent;
  return { value: latest, evidence: shorten(ev), confidence: distinct.length === 1 ? 0.9 : 0.5, method: "rules", conflict: distinct.length > 1 };
}

export function extractOpens(text: string, ref: Date = new Date()): Found<string> | null {
  const sents = sentencesWith(text, ["opens on", "start date", "applications open", "portal opens", "opening date"]);
  for (const s of sents) {
    const p = chrono.en.GB.parse(s, ref)[0];
    if (p && p.start.isCertain("day")) return { value: iso(p.start.date()), evidence: shorten(s), confidence: 0.8, method: "rules" };
  }
  return null;
}

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface AmountFound {
  min: number | null;
  max: number | null;
  currency: string;
  period: "year" | "month" | "one_time" | "total" | null;
  coverage: "full" | "partial" | "fixed" | null;
}

export function extractAmount(text: string): Found<AmountFound> | null {
  const sents = sentencesWith(text, ["amount", "scholarship of", "award", "stipend", "per annum", "per year", "per month", "p.a", "one-time", "one time", "up to", "upto", "worth", "receive", "grant of", "tuition"]);
  for (const s of sents) {
    const l = s.toLowerCase();
    if (/(income|salary|earn)/.test(l) && !/(scholarship|award|stipend)/.test(l)) continue;
    const money = findMoney(s);
    const full = /(full tuition|full funding|fully funded|100% tuition|full fee waiver|complete tuition)/.test(l);
    const partial = /(partial|tuition fee waiver|fee concession|% of tuition)/.test(l);
    if (!money.length && !full && !partial) continue;
    const period = /(per month|monthly|\/month|p\.m\.)/.test(l) ? "month" : /(per annum|per year|annually|p\.a|\/year|a year)/.test(l) ? "year" : /(one[- ]time|lump ?sum)/.test(l) ? "one_time" : null;
    const amounts = money.map((m) => m.amount);
    return {
      value: {
        min: amounts.length ? Math.min(...amounts) : null,
        max: amounts.length ? Math.max(...amounts) : null,
        currency: money[0]?.currency ?? "INR",
        period,
        coverage: full ? "full" : partial && !money.length ? "partial" : money.length ? "fixed" : null,
      },
      evidence: shorten(s),
      confidence: money.length === 1 ? 0.85 : 0.6,
      method: "rules",
    };
  }
  return null;
}

export interface RuleHit {
  field: string;
  op: string;
  value: unknown;
  evidence: string;
  confidence: number;
  group_no: number;
  fixable_by?: string | null;
  sentence: string;
  source_method?: "rules" | "template" | "llm";
}

function opFromPhrase(s: string, kind: "max" | "min"): string {
  const l = s.toLowerCase();
  if (kind === "max") return /(less than|below|under)\b/.test(l) && !/or equal/.test(l) ? "<" : "<=";
  return /(more than|above|greater than|exceed)/.test(l) && !/or equal|at least|minimum/.test(l) ? ">" : ">=";
}

function detect(s: string): RuleHit[] {
  const hits: RuleHit[] = [];
  const l = s.toLowerCase();
  const negated = /\b(not eligible|other than|except|excluding|not be|shall not)\b/.test(l);
  const add = (h: Omit<RuleHit, "evidence" | "group_no" | "sentence">) => hits.push({ ...h, evidence: shorten(s), group_no: 0, sentence: s });

  if (/income/.test(l)) {
    const m = findMoney(s)[0];
    if (m) add({ field: "family_income_inr", op: opFromPhrase(s, "max"), value: m.amount, confidence: 0.85, fixable_by: "income_certificate" });
  }
  const pct = l.match(/(\d{2}(?:\.\d+)?)\s*(%|percent|per cent)/);
  if (pct && /(marks|aggregate|percentage|score|scored|secured|grade)/.test(l)) {
    add({ field: "marks_percent", op: ">=", value: parseFloat(pct[1]), confidence: 0.85, fixable_by: "marksheet" });
  }
  const cg = l.match(/(\d(?:\.\d+)?)\s*(?:\/\s*(\d{1,2}))?\s*(cgpa|cpi|gpa)|(cgpa|cpi|gpa)\s*(?:of|:)?\s*(\d(?:\.\d+)?)(?:\s*(?:\/|out of|on a)\s*(\d{1,2}))?/);
  if (cg) {
    const v = parseFloat(cg[1] ?? cg[5]);
    const scale = parseFloat(cg[2] ?? cg[6] ?? (v > 4 ? "10" : "4"));
    add({ field: "cgpa", op: ">=", value: { min: v, scale }, confidence: 0.75, fixable_by: "marksheet" });
  }
  const cats = matchVocab(s, CATEGORIES).filter((c) => c !== "ST" || /scheduled tribe|\bst\b(?!\.)/i.test(s));
  if (cats.length && /(categor|caste|tribe|belong|reserved|ews|obc|sc\/st|sc |st )/i.test(s)) {
    add({ field: "category", op: negated ? "not_in" : "in", value: cats, confidence: 0.8, fixable_by: "category_certificate" });
  }
  const mins = matchVocab(s, MINORITIES);
  if (mins.length && /(minorit|communit|religion)/.test(l)) add({ field: "minority", op: "in", value: mins, confidence: 0.75 });
  if (/\b(girls?|female|women|woman)\b/.test(l) && !/\b(boys?|male|men)\b/.test(l.replace(/female|women/g, ""))) {
    add({ field: "gender", op: "in", value: ["female"], confidence: 0.85 });
  }
  if (/(disabilit|differently[- ]abled|divyang|pwd|handicap)/.test(l)) add({ field: "disability", op: "is_true", value: true, confidence: 0.8, fixable_by: "disability_certificate" });
  const states = matchVocab(s, STATES);
  if (states.length && /(domicile|resident|native|belong|state of|permanent)/.test(l)) {
    add({ field: "state", op: negated ? "not_in" : "in", value: states, confidence: 0.8, fixable_by: "domicile_certificate" });
  }
  const levels = matchVocab(s, COURSE_LEVELS);
  if (levels.length && !/(secured|scored|passed|marks|percentage)/.test(l) && /(pursuing|enrolled|studying|admitted|course|degree|programme|program|student|year)/.test(l)) {
    add({ field: "course_level", op: "in", value: levels, confidence: 0.7 });
  }
  const streams = matchVocab(s, STREAMS);
  if (streams.length && /(pursuing|enrolled|studying|course|degree|stream|discipline|field)/.test(l)) add({ field: "stream", op: "in", value: streams, confidence: 0.6 });
  const yr = l.match(/\b(first|1st|second|2nd|third|3rd|fourth|4th|final)[- ]year\b/);
  if (yr && /(only|students in|studying in|pursuing)/.test(l)) {
    const map: Record<string, number> = { first: 1, "1st": 1, second: 2, "2nd": 2, third: 3, "3rd": 3, fourth: 4, "4th": 4 };
    if (map[yr[1]]) add({ field: "year_of_study", op: "=", value: map[yr[1]], confidence: 0.7 });
  }
  const countries = matchVocab(s, COUNTRIES);
  if (countries.length && /(citizen|national)/.test(l)) add({ field: "nationality", op: "in", value: countries, confidence: 0.8 });
  const exp = l.match(/(\d+)\s*(?:\+\s*)?years?\s*(?:of\s*)?(?:full[- ]time\s*)?(?:work|professional|relevant)?\s*experience/);
  if (exp) add({ field: "work_experience_years", op: ">=", value: parseInt(exp[1]), confidence: 0.75 });
  const ielts = l.match(/ielts[^\d]{0,20}(\d(?:\.\d)?)/);
  if (ielts) add({ field: "english_test_score", op: ">=", value: parseFloat(ielts[1]), confidence: 0.7, fixable_by: "test_score" });
  return hits;
}

export function extractCriteria(eligibility: string): { hits: RuleHit[]; leftovers: string[] } {
  const sents = splitSentences(eligibility);
  const hits: RuleHit[] = [];
  const used = new Set<string>();
  let orParts: RuleHit[][] | null = null;

  for (const s of sents) {
    const parts = s.split(/\s+or\s+|\beither\b/i).map((p) => p.trim()).filter(Boolean);
    if (!orParts && parts.length >= 2) {
      const per = parts.map((p) => detect(p));
      const sets = per.map((h) => [...new Set(h.map((x) => x.field))].sort().join(","));
      if (per.filter((h) => h.length).length >= 2 && new Set(sets.filter(Boolean)).size >= 2) {
        orParts = per.filter((h) => h.length).map((h) => h.map((x) => ({ ...x, evidence: shorten(s), sentence: s })));
        used.add(s);
        continue;
      }
    }
    const h = detect(s);
    if (h.length) {
      used.add(s);
      hits.push(...h);
    }
  }

  let out = hits;
  if (orParts) {
    out = [];
    orParts.forEach((alt, g) => {
      for (const a of alt) out.push({ ...a, group_no: g });
      for (const r of hits) out.push({ ...r, group_no: g });
    });
  }
  const leftovers = sents.filter((s) => !used.has(s) && s.length > 15 && !/^(eligibility|criteria)/i.test(s));
  return { hits: out, leftovers };
}

export function extractDocuments(text: string): Found<string[]> | null {
  const docs = matchDocTypes(text);
  if (!docs.length) return null;
  return { value: docs, evidence: shorten(text.split("\n").find((l) => matchDocTypes(l).length) ?? text), confidence: 0.8, method: "rules" };
}

export function extractSteps(text: string): string[] {
  return splitSentences(text)
    .filter((s) => s.length > 8 && s.length < 220)
    .slice(0, 8);
}
