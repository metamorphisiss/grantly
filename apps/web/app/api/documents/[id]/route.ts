import { NextResponse } from "next/server";
import { cleanProfileInput } from "@/lib/profile-input";
import { getUser, userClient } from "@/lib/supabase";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  const db = await userClient();
  const { data } = await db.from("documents").select("id, doc_type, extract_status, extracted, issued_on, valid_until, confirmed, created_at").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (data.extract_status === "pending" && Date.now() - new Date(data.created_at).getTime() > 2 * 60000) {
    await db.from("documents").update({ extract_status: "failed" }).eq("id", id);
    data.extract_status = "failed";
  }
  return NextResponse.json(data);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const db = await userClient();
  const { data: doc } = await db.from("documents").select("id, extracted").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const { data: fields } = cleanProfileInput(b.fields ?? {});
  const extracted = { ...((doc.extracted as Record<string, unknown>) ?? {}) };
  for (const [k, v] of Object.entries(fields ?? {})) extracted[k] = { value: v, confidence: 1 };
  await db.from("documents").update({ confirmed: true, issued_on: date(b.issued_on), valid_until: date(b.valid_until), extracted }).eq("id", id);

  if (fields && Object.keys(fields).length) {
    const { data: prof } = await db.from("profiles").select("field_source").eq("id", user.id).maybeSingle();
    const fs = { ...((prof?.field_source as Record<string, unknown>) ?? {}) };
    for (const k of Object.keys(fields)) fs[k] = { from: "document", document_id: id };
    await db.from("profiles").update({ ...fields, field_source: fs }).eq("id", user.id);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const { id } = await params;
  const db = await userClient();
  const { data: doc } = await db.from("documents").select("id").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  const folder = `${user.id}/${id}`;
  const { data: files } = await db.storage.from("documents").list(folder);
  if (files?.length) await db.storage.from("documents").remove(files.map((f) => `${folder}/${f.name}`));
  await db.from("documents").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
