import { extractAmount, extractCriteria, extractDeadline, extractDocuments, extractOpens, extractSteps, type AmountFound, type Found, type RuleHit } from "./fields";
import { segment, splitSentences, type SectionKey } from "./text";

export * from "./fields";
export * from "./text";
export * from "./scam";
export * from "./url";
export * from "./documents";

export const REQUIRED_FIELDS = ["name", "deadline", "amount", "criteria"] as const;
export type RequiredField = (typeof REQUIRED_FIELDS)[number];

export interface Draft {
  name: Found<string> | null;
  provider: Found<string> | null;
  deadline: Found<string> | null;
  deadline_type: "fixed" | "rolling" | "unknown";
  opens_on: Found<string> | null;
  amount: Found<AmountFound> | null;
  criteria: RuleHit[];
  required_documents: string[];
  other_conditions: string[];
  steps: string[];
  missing: RequiredField[];
  conflicts: RequiredField[];
}

export interface ExtractInput {
  text: string;
  title?: string | null;
  provider?: string | null;
  now?: Date;
}

export function extractScholarship({ text, title, provider, now = new Date() }: ExtractInput): Draft {
  const sec = segment(text);
  const all = text;
  const eligText = sec.eligibility || all;
  const datesText = [sec.dates, sec.other, sec.apply].filter(Boolean).join("\n") || all;

  const deadline = extractDeadline(datesText, now) ?? extractDeadline(all, now);
  const rolling = /rolling (basis|admission|deadline)|applications? (are )?accepted (throughout|all) (the )?year|no deadline/i.test(all);
  const amount = extractAmount(sec.benefits || all) ?? extractAmount(all);
  const { hits, leftovers } = extractCriteria(eligText);
  const docs = extractDocuments(sec.documents || all);
  const name = title ? { value: title.trim(), evidence: title.trim(), confidence: 0.9, method: "rules" as const } : guessName(all);

  const draft: Draft = {
    name,
    provider: provider ? { value: provider, evidence: provider, confidence: 0.9, method: "rules" } : null,
    deadline,
    deadline_type: deadline ? "fixed" : rolling ? "rolling" : "unknown",
    opens_on: extractOpens(datesText, now),
    amount,
    criteria: hits,
    required_documents: docs?.value ?? [],
    other_conditions: leftovers.slice(0, 8),
    steps: sec.apply ? extractSteps(sec.apply) : [],
    missing: [],
    conflicts: [],
  };
  draft.missing = REQUIRED_FIELDS.filter((f) => {
    if (f === "deadline") return !deadline && !rolling;
    if (f === "criteria") return hits.length === 0;
    return !draft[f];
  });
  draft.conflicts = REQUIRED_FIELDS.filter((f) => f === "deadline" && deadline?.conflict);
  return draft;
}

function guessName(text: string): Found<string> | null {
  const line = text.split("\n").map((l) => l.replace(/^#+\s*/, "").trim()).find((l) => /scholarship|fellowship|award|grant|scheme/i.test(l) && l.length < 120);
  return line ? { value: line, evidence: line, confidence: 0.6, method: "rules" } : null;
}

const FIELD_SECTIONS: Record<RequiredField, SectionKey[]> = {
  name: ["other"],
  deadline: ["dates", "apply", "other"],
  amount: ["benefits", "other"],
  criteria: ["eligibility", "other"],
};

const FIELD_WORDS: Record<RequiredField, string[]> = {
  name: ["scholarship", "fellowship", "award", "scheme"],
  deadline: ["date", "deadline", "last", "close", "apply by"],
  amount: ["amount", "₹", "rs", "inr", "lakh", "stipend", "per annum", "tuition", "award"],
  criteria: ["eligib", "must", "should", "income", "marks", "category", "student", "citizen"],
};

export function buildSnippet(text: string, fields: RequiredField[], maxTokens = 600): string {
  const sec = segment(text);
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const f of fields) {
    for (const k of FIELD_SECTIONS[f]) {
      const t = sec[k];
      if (t && k !== "other" && !seen.has(k)) {
        parts.push(t);
        seen.add(k);
      }
    }
  }
  if (!parts.length || fields.includes("name")) {
    const words = fields.flatMap((f) => FIELD_WORDS[f]);
    const scored = splitSentences(text)
      .map((s) => ({ s, n: words.reduce((a, w) => a + (s.toLowerCase().includes(w) ? 1 : 0), 0) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 25)
      .map((x) => x.s);
    parts.push(scored.join("\n"));
  }
  const maxChars = maxTokens * 4;
  return parts.join("\n\n").slice(0, maxChars);
}
