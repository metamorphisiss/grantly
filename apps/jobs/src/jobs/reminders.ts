import { Resend } from "resend";
import { DOC_TYPES } from "@grantly/core";
import { db } from "../db";
import { env } from "../env";

const resend = env.resendKey ? new Resend(env.resendKey) : null;

function todayIST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function queueDocumentExpiry(today: string) {
  const horizon = addDays(today, 14);
  const { data: docs } = await db.from("documents").select("id, user_id, valid_until").gte("valid_until", today).lte("valid_until", horizon);
  for (const d of docs ?? []) {
    await db.from("reminders").upsert(
      { user_id: d.user_id, document_id: d.id, type: "document_expiring", fire_on: addDays(d.valid_until, -14) < today ? today : addDays(d.valid_until, -14) },
      { onConflict: "user_id,application_id,document_id,type,fire_on", ignoreDuplicates: true },
    );
  }
}

export async function sendReminders() {
  const today = todayIST();
  await queueDocumentExpiry(today);
  const { data: due } = await db
    .from("reminders")
    .select("id, user_id, type, fire_on, application_id, document_id, applications(status, scholarships(name, slug, deadline)), documents(doc_type, valid_until)")
    .is("sent_at", null)
    .lte("fire_on", today);
  if (!due?.length) return { note: "Nothing due" };

  const byUser = new Map<string, typeof due>();
  for (const r of due) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);

  let sent = 0;
  for (const [userId, items] of byUser) {
    const { data: prof } = await db.from("profiles").select("email, full_name, reminder_email").eq("id", userId).single();
    const lines: string[] = [];
    for (const r of items) {
      const app = r.applications as unknown as { status: string; scholarships: { name: string; slug: string; deadline: string | null } } | null;
      const doc = r.documents as unknown as { doc_type: string; valid_until: string } | null;
      if (r.type === "deadline" && app && ["saved", "preparing"].includes(app.status) && app.scholarships.deadline && app.scholarships.deadline >= today) {
        lines.push(`<li><a href="${env.appUrl}/scholarships/${app.scholarships.slug}">${app.scholarships.name}</a> closes on ${app.scholarships.deadline}</li>`);
      } else if (r.type === "start_preparing" && app) {
        lines.push(`<li>Start preparing for <a href="${env.appUrl}/scholarships/${app.scholarships.slug}">${app.scholarships.name}</a></li>`);
      } else if (r.type === "renewal" && app) {
        lines.push(`<li>Renewal coming up for ${app.scholarships.name}</li>`);
      } else if (r.type === "document_expiring" && doc) {
        lines.push(`<li>Your ${DOC_TYPES[doc.doc_type]?.label.toLowerCase() ?? "document"} expires on ${doc.valid_until}. <a href="${env.appUrl}/vault">Replace it</a></li>`);
      }
    }
    const ids = items.map((i) => i.id);
    if (lines.length && prof?.email && prof.reminder_email && resend) {
      const { error } = await resend.emails.send({
        from: env.reminderFrom,
        to: prof.email,
        subject: `Grantly: ${lines.length} thing${lines.length === 1 ? "" : "s"} need${lines.length === 1 ? "s" : ""} your attention`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:520px"><p>Hi ${prof.full_name?.split(" ")[0] ?? "there"},</p><ul>${lines.join("")}</ul><p><a href="${env.appUrl}/dashboard">Open your dashboard</a></p><p style="color:#6f695e;font-size:12px">You can turn these emails off in Settings.</p></div>`,
      });
      if (error) continue;
      sent++;
    }
    await db.from("reminders").update({ sent_at: new Date().toISOString() }).in("id", ids);
  }
  return { note: `Sent ${sent} digest${sent === 1 ? "" : "s"}${resend ? "" : " (RESEND_API_KEY not set, marked as sent without emailing)"}` };
}
