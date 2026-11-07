import { SettingsForm } from "@/components/SettingsForm";
import { requireProfile } from "@/lib/data";

export default async function Settings() {
  const { row } = await requireProfile();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Settings</h1>
      <SettingsForm email={(row.reminder_email as boolean) ?? true} days={(row.reminder_days as number[]) ?? [14, 3, 1]} />
    </div>
  );
}
