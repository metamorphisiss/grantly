import { describe, expect, it } from "vitest";
import {
  evaluate,
  extractScholarship,
  priority,
  trustReport,
  normalizeUrl,
  isPrivateIp,
  validateLlm,
  extractFromDocument,
  buildSnippet,
  type Profile,
  type Scholarship,
} from "../src";

const now = new Date("2026-11-07T10:00:00+05:30");

const base: Scholarship = {
  id: "s1",
  slug: "demo",
  name: "Demo Merit Scholarship",
  scope: "domestic",
  amount_currency: "INR",
  amount_min: 50000,
  amount_max: 50000,
  amount_period: "year",
  deadline: "2026-12-15",
  deadline_type: "fixed",
  status: "published",
  visibility: "public",
  track_only: false,
  other_conditions: [],
  required_documents: ["income_certificate", "marksheet"],
  steps: [],
  criteria: [
    { field: "family_income_inr", op: "<=", value: 800000, kind: "hard", fixable_by: "income_certificate", group_no: 0, source_method: "manual", confidence: 1 },
    { field: "marks_percent", op: ">=", value: 60, kind: "hard", group_no: 0, source_method: "manual", confidence: 1 },
    { field: "state", op: "in", value: ["MH"], kind: "hard", group_no: 0, source_method: "manual", confidence: 1 },
  ],
};

const priya: Profile = { scope_pref: ["india"], family_income_inr: 620000, marks_value: 72, marks_system: "percent", state: "MH" };

describe("matcher", () => {
  it("eligible when all pass", () => {
    const e = evaluate(base, priya, [], now);
    expect(e.verdict).toBe("eligible");
    expect(e.daysLeft).toBeGreaterThan(30);
  });

  it("need_info when field missing, never not_eligible", () => {
    const e = evaluate(base, { ...priya, state: null }, [], now);
    expect(e.verdict).toBe("need_info");
  });

  it("near-miss marks is not_eligible with close note", () => {
    const e = evaluate(base, { ...priya, marks_value: 58 }, [], now);
    expect(e.verdict).toBe("not_eligible");
    expect(e.reason).toMatch(/2\.0% short/);
  });

  it("almost when proving document expired", () => {
    const e = evaluate(base, priya, [{ id: "d", doc_type: "income_certificate", valid_until: "2026-10-01", confirmed: true }], now);
    expect(e.verdict).toBe("almost");
  });

  it("percent vs cgpa gives need_info", () => {
    const e = evaluate(base, { ...priya, marks_system: "cgpa", marks_value: 8.1, cgpa_scale: 10 }, [], now);
    expect(e.verdict).toBe("need_info");
    expect(e.reason).toMatch(/percentage/);
  });

  it("OR groups: any passing group wins", () => {
    const s: Scholarship = {
      ...base,
      criteria: [
        { field: "category", op: "in", value: ["SC", "ST"], kind: "hard", group_no: 0, source_method: "manual", confidence: 1 },
        { field: "family_income_inr", op: "<=", value: 250000, kind: "hard", group_no: 1, source_method: "manual", confidence: 1 },
      ],
    };
    expect(evaluate(s, { scope_pref: ["india"], category: "GEN", family_income_inr: 200000 }, [], now).verdict).toBe("eligible");
    expect(evaluate(s, { scope_pref: ["india"], category: "GEN", family_income_inr: 900000 }, [], now).verdict).toBe("not_eligible");
  });

  it("readiness and ranking", () => {
    const e = evaluate(base, priya, [{ id: "d", doc_type: "marksheet", confirmed: true }], now);
    expect(e.readiness).toBe(0.5);
    expect(priority(base, e).score).toBeGreaterThan(0);
  });
});

const PAGE = `# Example Foundation Merit Scholarship 2026-27

## Eligibility
Applicants must be pursuing an undergraduate engineering degree.
Annual family income should not exceed Rs 6 lakh.
Students must have secured at least 65% marks in Class 12.
Only girls who are residents of Maharashtra may apply.
Selection will be made by an interview panel.

## Benefits
The scholarship amount is ₹40,000 per annum.

## Documents Required
- Income certificate
- Class 12 marksheet
- Bonafide certificate

## Important Dates
Last date to apply: 15/12/2026
`;

describe("rule extractor", () => {
  const d = extractScholarship({ text: PAGE, now });
  it("gets required fields without LLM", () => {
    expect(d.missing).toEqual([]);
    expect(d.deadline?.value).toBe("2026-12-15");
    expect(d.amount?.value.max).toBe(40000);
    expect(d.amount?.value.period).toBe("year");
  });
  it("gets criteria", () => {
    const f = Object.fromEntries(d.criteria.map((c) => [c.field, c.value]));
    expect(f.family_income_inr).toBe(600000);
    expect(f.marks_percent).toBe(65);
    expect(f.state).toEqual(["MH"]);
    expect(f.gender).toEqual(["female"]);
    expect(f.course_level).toContain("ug");
  });
  it("keeps unparsed conditions", () => {
    expect(d.other_conditions.join(" ")).toMatch(/interview panel/);
  });
  it("gets documents", () => {
    expect(d.required_documents).toEqual(expect.arrayContaining(["income_certificate", "marksheet", "bonafide_certificate"]));
  });
  it("flags missing deadline", () => {
    const d2 = extractScholarship({ text: PAGE.replace(/Last date.*\n/, ""), now });
    expect(d2.missing).toContain("deadline");
    expect(buildSnippet(PAGE, ["deadline"]).length).toBeGreaterThan(0);
  });
});

describe("llm validation", () => {
  const snippet = "Applications close on 20 January 2027. Award of Rs 2 lakh.";
  it("accepts grounded output", () => {
    const v = validateLlm({ deadline: { value: "2027-01-20", evidence: "Applications close on 20 January 2027" } }, snippet, ["deadline"], now);
    expect(v.deadline).toBeTruthy();
  });
  it("rejects invented evidence", () => {
    const v = validateLlm({ deadline: { value: "2027-01-20", evidence: "Deadline is 20 Jan" } }, snippet, ["deadline"], now);
    expect(v.deadline).toBeUndefined();
  });
  it("rejects value not in evidence", () => {
    const v = validateLlm({ amount: { min: null, max: 500000, currency: "INR", period: null, evidence: "Award of Rs 2 lakh" } }, snippet, ["amount"], now);
    expect(v.amount).toBeUndefined();
  });
});

describe("trust, urls, ssrf, docs", () => {
  it("flags fee scams", () => {
    expect(trustReport("https://free-scholarship.xyz", "Pay registration fee of Rs 500 and share OTP").level).toBe("warning");
    expect(trustReport("https://scholarships.gov.in/x", "Eligibility").level).toBe("trusted");
  });
  it("normalizes urls", () => {
    expect(normalizeUrl("https://www.Example.org/a/?utm_source=x&b=1#top")).toBe("https://example.org/a?b=1");
  });
  it("blocks private ips", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("192.168.1.4")).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
  });
  it("reads income certificate", () => {
    const r = extractFromDocument("income_certificate", "INCOME CERTIFICATE\nDate: 12/03/2026\nAnnual income of the family is Rs. 3,40,000");
    expect(r.fields.family_income_inr.value).toBe(340000);
    expect(r.valid_until).toBe("2027-03-12");
  });
});

describe("regressions", () => {
  it("does not split on Rs. and finds amount", () => {
    const d = extractScholarship({ text: "## Benefits\nSelected students receive Rs. 50,000 per annum for up to four years.", now });
    expect(d.amount?.value.max).toBe(50000);
  });
  it("B.Tech or undergraduate is not an OR condition", () => {
    const d = extractScholarship({ text: "## Eligibility\nStudents pursuing a B.Tech or other undergraduate degree in engineering.\nAnnual family income must be below Rs 5 lakh.", now });
    expect(new Set(d.criteria.map((c) => c.group_no))).toEqual(new Set([0]));
  });
  it("real OR across different fields becomes groups", () => {
    const d = extractScholarship({ text: "## Eligibility\nStudents belonging to SC/ST category or students whose family income is below Rs 2.5 lakh.\nMust be pursuing an undergraduate course.", now });
    const groups = new Set(d.criteria.map((c) => c.group_no));
    expect(groups.size).toBe(2);
    expect(d.criteria.filter((c) => c.field === "course_level").length).toBe(2);
  });
});
