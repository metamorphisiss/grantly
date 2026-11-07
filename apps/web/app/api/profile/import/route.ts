import { NextResponse } from "next/server";
import { DOC_TYPES } from "@grantly/core";
import { loadScholarships, rankAll, toProfile } from "@/lib/data";
import { cleanProfileInput } from "@/lib/profile-input";
import { userClient, getUser } from "@/lib/supabase";

export async function POST(req: Request) {
  const user = await getUser();
  const userId = user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = cleanProfileInput(await req.json().catch(() => ({})));
  if (error) return NextResponse.json({ error }, { status: 400 });

  const db = (await userClient());
  const { data: existing } = await db.from("profiles").select("id, onboarded_at").maybeSingle();
  const row = {
    ...data,
    id: userId,
    email: user?.email ?? null,
    full_name: data!.full_name ?? ((user?.user_metadata?.full_name as string | undefined) ?? null),
    onboarded_at: existing?.onboarded_at ?? new Date().toISOString(),
  };
  const { data: saved, error: dbErr } = await db.from("profiles").upsert(row).select("*").single();
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  const rows = rankAll(await loadScholarships(), toProfile(saved), []);
  const unlock = new Map<string, number>();
  for (const r of rows) {
    if (r.e.closed || r.e.verdict === "not_eligible") continue;
    for (const d of r.s.required_documents) unlock.set(d, (unlock.get(d) ?? 0) + 1);
  }
  const suggestions = [...unlock.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([doc_type, n]) => ({ doc_type, label: DOC_TYPES[doc_type]?.label ?? doc_type, n }));
  return NextResponse.json({ ok: true, suggestions });
}
