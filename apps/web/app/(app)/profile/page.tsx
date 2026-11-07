import { ProfileForm } from "@/components/ProfileForm";
import { requireProfile } from "@/lib/data";

export default async function ProfilePage() {
  const { row } = await requireProfile();
  const { field_source, ...rest } = row as Record<string, unknown>;
  const initial: Record<string, unknown> = {};
  for (const k of ["full_name", "scope_pref", "course_level", "stream", "year_of_study", "marks_value", "marks_system", "cgpa_scale", "family_income_inr", "state", "gender", "category", "minority", "disability", "target_countries", "english_test_score", "work_experience_years"]) {
    const v = rest[k];
    initial[k] = typeof v === "string" && /^\d+(\.\d+)?$/.test(v) && k !== "state" ? Number(v) : v;
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Profile</h1>
        <p className="mt-1 text-sm text-muted">Every field is optional. Changing anything recalculates your matches straight away.</p>
      </div>
      <ProfileForm initial={initial} sources={(field_source as Record<string, { from: string }>) ?? {}} />
    </div>
  );
}
