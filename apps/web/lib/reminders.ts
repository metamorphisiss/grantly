import "server-only";
import { adminClient } from "./supabase";

function minusDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00+05:30");
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export async function syncApplicationReminders(userId: string, applicationId: string) {
  const db = adminClient();
  const { data: app } = await db.from("applications").select("status, renewal_due, scholarships(deadline, scope)").eq("id", applicationId).single();
  const { data: prof } = await db.from("profiles").select("reminder_days").eq("id", userId).single();
  if (!app) return;
  await db.from("reminders").delete().eq("application_id", applicationId).is("sent_at", null);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const s = app.scholarships as unknown as { deadline: string | null; scope: string } | null;
  const rows: Record<string, unknown>[] = [];
  if (["saved", "preparing"].includes(app.status) && s?.deadline) {
    const days: number[] = prof?.reminder_days ?? [14, 3, 1];
    for (const d of days) rows.push({ user_id: userId, application_id: applicationId, type: "deadline", fire_on: minusDays(s.deadline, d) });
    if (s.scope === "international") rows.push({ user_id: userId, application_id: applicationId, type: "start_preparing", fire_on: minusDays(s.deadline, 60) });
  }
  if (["disbursed", "renewal_due"].includes(app.status) && app.renewal_due) {
    rows.push({ user_id: userId, application_id: applicationId, type: "renewal", fire_on: minusDays(app.renewal_due, 14) });
  }
  const future = rows.filter((r) => (r.fire_on as string) >= today);
  if (future.length) await db.from("reminders").upsert(future, { onConflict: "user_id,application_id,document_id,type,fire_on", ignoreDuplicates: true });
}
