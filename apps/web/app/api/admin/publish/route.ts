import { NextResponse } from "next/server";
import { Criterion, DOC_TYPES, normalizeName } from "@grantly/core";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin";
import { adminClient } from "@/lib/supabase";

const Body = z.object({
  id: z.string().uuid(),
  action: z.enum(["publish", "save", "archive"]),
  fields: z.object({
    name: z.string().min(2),
    provider: z.string().nullable(),
    provider_type: z.enum(["government", "private", "institution", "international"]).nullable(),
    scope: z.enum(["domestic", "international"]),
    amount_min: z.number().nullable(),
    amount_max: z.number().nullable(),
    amount_currency: z.string().length(3),
    amount_period: z.enum(["year", "month", "one_time", "total"]).nullable(),
    coverage: z.enum(["full", "partial", "fixed"]).nullable(),
    deadline: z.string().nullable(),
    deadline_type: z.enum(["fixed", "rolling", "unknown"]),
    apply_url: z.string().nullable(),
    other_conditions: z.array(z.string()),
    exclusive_group: z.string().nullable(),
  }),
  criteria: z.array(Criterion),
  documents: z.array(z.string()),
});

export async function POST(req: Request) {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { id, action, fields, criteria, documents } = parsed.data;
  const db = adminClient();

  const status = action === "publish" ? "published" : action === "archive" ? "archived" : undefined;
  const upd: Record<string, unknown> = { ...fields, name_key: normalizeName(fields.name) };
  if (status) upd.status = status;
  if (action === "publish") {
    upd.visibility = "public";
    upd.owner_id = null;
    upd.last_verified = new Date().toISOString().slice(0, 10);
  }
  if (action === "publish") {
    const { data: cur } = await db.from("scholarships").select("field_meta").eq("id", id).single();
    upd.field_meta = { ...((cur?.field_meta as object) ?? {}), needs_review: false, proposed: null };
  }
  const { error } = await db.from("scholarships").update(upd).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("scholarship_criteria").delete().eq("scholarship_id", id);
  if (criteria.length) {
    await db.from("scholarship_criteria").insert(criteria.map(({ id: _drop, ...c }) => ({ ...c, scholarship_id: id })));
  }
  await db.from("scholarship_documents").delete().eq("scholarship_id", id);
  const docs = documents.filter((d) => DOC_TYPES[d]);
  if (docs.length) await db.from("scholarship_documents").insert(docs.map((d) => ({ scholarship_id: id, doc_type: d })));
  return NextResponse.json({ ok: true });
}
