import { Profile } from "@grantly/core";

const EDITABLE = [
  "full_name", "scope_pref", "course_level", "stream", "course_name", "year_of_study", "marks_value", "marks_system", "cgpa_scale",
  "family_income_inr", "state", "gender", "category", "minority", "disability", "nationality", "target_countries",
  "english_test_score", "work_experience_years",
] as const;

export function cleanProfileInput(body: unknown) {
  const parsed = Profile.partial().safeParse(body);
  if (!parsed.success) return { error: parsed.error.flatten() };
  const out: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in parsed.data) out[k] = (parsed.data as Record<string, unknown>)[k] ?? null;
  if (out.minority === "none") out.minority = null;
  if (out.marks_system === "percent") out.cgpa_scale = null;
  if (out.marks_system === "cgpa" && !out.cgpa_scale) out.cgpa_scale = 10;
  return { data: out };
}
