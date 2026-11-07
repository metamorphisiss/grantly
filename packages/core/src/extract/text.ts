export type SectionKey = "eligibility" | "benefits" | "documents" | "dates" | "apply" | "other";

const SECTION_WORDS: Record<Exclude<SectionKey, "other">, string[]> = {
  eligibility: ["eligibility", "eligible", "who can apply", "criteria", "requirements", "qualification"],
  benefits: ["benefit", "amount", "award", "stipend", "scholarship value", "financial assistance", "what you get", "funding", "coverage"],
  documents: ["documents", "document required", "checklist", "attachments", "supporting documents"],
  dates: ["important dates", "deadline", "last date", "timeline", "key dates", "dates"],
  apply: ["how to apply", "application process", "procedure", "steps to apply", "selection process"],
};

export function splitSentences(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/\n+|(?<!\b(?:Rs|rs|RS|No|no|Dr|Mr|Mrs|Ms|St|Prof|Govt|govt|approx|viz|etc|e\.g|i\.e|[A-Z])\.)(?<=[.;!?])\s+(?=[A-Z0-9(•\-*])/)
    .map((s) => s.replace(/^[\s•\-*#>|]+/, "").replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 2);
}

function headingKey(line: string): SectionKey | null {
  const l = line.toLowerCase().replace(/[#*:|]/g, "").trim();
  if (l.length > 60) return null;
  for (const [k, words] of Object.entries(SECTION_WORDS)) {
    if (words.some((w) => l.includes(w))) return k as SectionKey;
  }
  return null;
}

function looksLikeHeading(line: string) {
  const t = line.trim();
  if (!t) return false;
  if (/^#{1,6}\s/.test(t)) return true;
  if (t.length <= 60 && /:$/.test(t)) return true;
  if (t.length <= 50 && t === t.toUpperCase() && /[A-Z]/.test(t)) return true;
  if (/^\*\*[^*]+\*\*$/.test(t) && t.length <= 64) return true;
  return false;
}

export function segment(text: string): Record<SectionKey, string> {
  const out: Record<SectionKey, string[]> = { eligibility: [], benefits: [], documents: [], dates: [], apply: [], other: [] };
  let cur: SectionKey = "other";
  for (const line of text.split("\n")) {
    if (looksLikeHeading(line)) {
      const k = headingKey(line);
      cur = k ?? "other";
      continue;
    }
    out[cur].push(line);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.join("\n").trim()])) as Record<SectionKey, string>;
}

export function sentencesWith(text: string, words: string[]): string[] {
  return splitSentences(text).filter((s) => {
    const l = s.toLowerCase();
    return words.some((w) => l.includes(w));
  });
}

export function shorten(s: string, words = 15) {
  const parts = s.split(/\s+/);
  return parts.length <= words ? s : parts.slice(0, words).join(" ") + "…";
}

export function stripHidden(html: string) {
  return html
    .replace(/<([a-z0-9]+)[^>]*(display\s*:\s*none|visibility\s*:\s*hidden|aria-hidden="true"|font-size\s*:\s*0)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|noscript|template)[^>]*>[\s\S]*?<\/\1>/gi, "");
}
