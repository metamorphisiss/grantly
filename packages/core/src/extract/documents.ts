import * as chrono from "chrono-node";
import { CATEGORIES, STATES, matchVocab } from "../vocab";
import { findMoney } from "./fields";

export interface DocExtract {
  fields: Record<string, { value: unknown; confidence: number }>;
  issued_on: string | null;
  valid_until: string | null;
}

function firstDate(text: string, words: string[]): string | null {
  const lines = text.split("\n").filter((l) => words.some((w) => l.toLowerCase().includes(w)));
  for (const l of lines) {
    const p = chrono.en.GB.parse(l)[0];
    if (p && p.start.isCertain("day")) {
      const d = p.start.date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }
  return null;
}

function addMonths(isoDate: string, m: number) {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + m);
  return d.toISOString().slice(0, 10);
}

export function extractFromDocument(docType: string, ocrText: string): DocExtract {
  const text = ocrText.replace(/[|]/g, " ");
  const l = text.toLowerCase();
  const fields: DocExtract["fields"] = {};
  const issued = firstDate(text, ["date", "issued", "dated", "दिनांक"]);
  let valid: string | null = firstDate(text, ["valid till", "valid upto", "valid up to", "validity", "valid until"]);

  if (docType === "marksheet") {
    const pct = l.match(/(percentage|%|aggregate)[^\d]{0,15}(\d{2}(?:\.\d{1,2})?)/) ?? l.match(/(\d{2}(?:\.\d{1,2})?)\s*%/);
    if (pct) fields.marks_value = { value: parseFloat(pct[2] ?? pct[1]), confidence: 0.7 };
    if (pct) fields.marks_system = { value: "percent", confidence: 0.7 };
    const cg = l.match(/(cgpa|sgpa|cpi|gpa)[^\d]{0,10}(\d{1,2}\.\d{1,2})/);
    if (cg && !pct) {
      const v = parseFloat(cg[2]);
      fields.marks_value = { value: v, confidence: 0.7 };
      fields.marks_system = { value: "cgpa", confidence: 0.7 };
      fields.cgpa_scale = { value: v > 4.0 ? 10 : 4, confidence: 0.5 };
    }
  }

  if (docType === "income_certificate") {
    const line = text.split("\n").find((x) => /income|उत्पन्न|आय/i.test(x)) ?? text;
    const money = findMoney(line)[0] ?? findMoney(text)[0];
    if (money) fields.family_income_inr = { value: money.amount, confidence: 0.65 };
    if (!valid && issued) valid = addMonths(issued, 12);
  }

  if (docType === "category_certificate") {
    const cats = matchVocab(text, CATEGORIES);
    if (cats.length === 1) fields.category = { value: cats[0], confidence: 0.7 };
  }

  if (docType === "domicile_certificate") {
    const st = matchVocab(text, STATES);
    if (st.length === 1) fields.state = { value: st[0], confidence: 0.7 };
  }

  if (docType === "bonafide_certificate" && !valid && issued) valid = addMonths(issued, 12);

  return { fields, issued_on: issued, valid_until: valid };
}

export function redactIds(text: string) {
  return text
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[redacted]")
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[redacted]");
}
