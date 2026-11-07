import { NextResponse } from "next/server";
import { syncApplicationReminders } from "@/lib/reminders";
import { userClient, getUser } from "@/lib/supabase";

const STATUSES = ["saved", "preparing", "applied", "awaiting", "disbursed", "renewal_due"];
const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function POST(req: Request) {
  const user = await getUser();
  const userId = user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!STATUSES.includes(b.status) || typeof b.scholarship_id !== "string") return NextResponse.json({ error: "bad input" }, { status: 400 });
  const { data, error } = await (await userClient())
    .from("applications")
    .upsert({ user_id: userId, scholarship_id: b.scholarship_id, status: b.status }, { onConflict: "user_id,scholarship_id" })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await syncApplicationReminders(userId, data.id);
  return NextResponse.json({ id: data.id });
}

export async function PATCH(req: Request) {
  const user = await getUser();
  const userId = user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (typeof b.id !== "string") return NextResponse.json({ error: "bad input" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return NextResponse.json({ error: "bad status" }, { status: 400 });
    patch.status = b.status;
    if (b.status === "applied" && !b.applied_on) patch.applied_on = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  }
  if (b.notes !== undefined) patch.notes = String(b.notes).slice(0, 2000);
  if (b.applied_on !== undefined) patch.applied_on = isDate(b.applied_on) ? b.applied_on : null;
  if (b.renewal_due !== undefined) patch.renewal_due = isDate(b.renewal_due) ? b.renewal_due : null;
  const { error } = await (await userClient()).from("applications").update(patch).eq("id", b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await syncApplicationReminders(userId, b.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "bad input" }, { status: 400 });
  await (await userClient()).from("applications").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
