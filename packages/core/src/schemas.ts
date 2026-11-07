import { z } from "zod";

export const CriterionField = z.enum([
  "course_level",
  "stream",
  "year_of_study",
  "marks_percent",
  "cgpa",
  "family_income_inr",
  "state",
  "gender",
  "category",
  "minority",
  "disability",
  "nationality",
  "target_countries",
  "english_test_score",
  "work_experience_years",
]);
export type CriterionField = z.infer<typeof CriterionField>;

export const CriterionOp = z.enum(["<=", ">=", "<", ">", "=", "in", "not_in", "is_true"]);
export type CriterionOp = z.infer<typeof CriterionOp>;

export const SourceMethod = z.enum(["template", "rules", "llm", "manual"]);

export const Criterion = z.object({
  id: z.string().optional(),
  field: CriterionField,
  op: CriterionOp,
  value: z.any(),
  kind: z.enum(["hard", "soft"]).default("hard"),
  fixable_by: z.string().nullable().optional(),
  evidence: z.string().nullable().optional(),
  group_no: z.number().int().default(0),
  source_method: SourceMethod.default("manual"),
  confidence: z.number().min(0).max(1).default(1),
});
export type Criterion = z.infer<typeof Criterion>;

export const Scholarship = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  provider: z.string().nullable().optional(),
  provider_type: z.enum(["government", "private", "institution", "international"]).nullable().optional(),
  scope: z.enum(["domestic", "international"]).default("domestic"),
  destinations: z.array(z.string()).nullable().optional(),
  source_url: z.string().nullable().optional(),
  apply_url: z.string().nullable().optional(),
  amount_min: z.number().nullable().optional(),
  amount_max: z.number().nullable().optional(),
  amount_currency: z.string().default("INR"),
  amount_period: z.enum(["year", "month", "one_time", "total"]).nullable().optional(),
  coverage: z.enum(["full", "partial", "fixed"]).nullable().optional(),
  renewable: z.boolean().nullable().optional(),
  opens_on: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  deadline_type: z.enum(["fixed", "rolling", "unknown"]).default("fixed"),
  reopens_month: z.number().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  visibility: z.enum(["public", "private"]).default("public"),
  track_only: z.boolean().default(false),
  exclusive_group: z.string().nullable().optional(),
  last_verified: z.string().nullable().optional(),
  other_conditions: z.array(z.string()).default([]),
  summary: z.string().nullable().optional(),
  trust: z.any().optional(),
  criteria: z.array(Criterion).default([]),
  required_documents: z.array(z.string()).default([]),
  steps: z.array(z.object({ title: z.string(), detail: z.string().nullable().optional() })).default([]),
});
export type Scholarship = z.infer<typeof Scholarship>;

export const Profile = z.object({
  id: z.string().optional(),
  full_name: z.string().nullable().optional(),
  scope_pref: z.array(z.enum(["india", "abroad"])).default(["india"]),
  course_level: z.string().nullable().optional(),
  stream: z.string().nullable().optional(),
  course_name: z.string().nullable().optional(),
  year_of_study: z.number().int().nullable().optional(),
  marks_value: z.number().nullable().optional(),
  marks_system: z.enum(["percent", "cgpa"]).nullable().optional(),
  cgpa_scale: z.number().nullable().optional(),
  family_income_inr: z.number().nullable().optional(),
  state: z.string().nullable().optional(),
  gender: z.enum(["female", "male", "other", "undisclosed"]).nullable().optional(),
  category: z.string().nullable().optional(),
  minority: z.string().nullable().optional(),
  disability: z.boolean().nullable().optional(),
  nationality: z.string().nullable().optional(),
  target_countries: z.array(z.string()).nullable().optional(),
  english_test_score: z.number().nullable().optional(),
  work_experience_years: z.number().nullable().optional(),
});
export type Profile = z.infer<typeof Profile>;

export const UserDocument = z.object({
  id: z.string(),
  doc_type: z.string(),
  issued_on: z.string().nullable().optional(),
  valid_until: z.string().nullable().optional(),
  confirmed: z.boolean().default(false),
});
export type UserDocument = z.infer<typeof UserDocument>;

export const OnboardingAnswers = Profile.omit({ id: true });
export type OnboardingAnswers = z.infer<typeof OnboardingAnswers>;
