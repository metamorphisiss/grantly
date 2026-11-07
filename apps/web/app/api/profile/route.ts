import { NextResponse } from "next/server";
import { cleanProfileInput } from "@/lib/profile-input";
import { userClient, getUser } from "@/lib/supabase";

export async function PUT(req: Request) {
  const user = await getUser();
  const userId = user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { data, error } = cleanProfileInput(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const extra: Record<string, unknown> = {};
  if (typeof body.reminder_email === "boolean") extra.reminder_email = body.reminder_email;
  if (Array.isArray(body.reminder_days)) extra.reminder_days = body.reminder_days.map(Number).filter((n: number) => n > 0 && n < 120).slice(0, 5);
  if (body.field_source && typeof body.field_source === "object") extra.field_source = body.field_source;
  const { error: e } = await (await userClient()).from("profiles").update({ ...data, ...extra }).eq("id", userId);
  if (e) return NextResponse.json({ error: e.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  return NextResponse.json({ error: "Delete your account from Settings." }, { status: 405 });
}
