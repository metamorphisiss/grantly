import { NextResponse } from "next/server";
import { Profile, formatAmount, type Verdict } from "@grantly/core";
import { loadScholarships, rankAll } from "@/lib/data";
import { cleanProfileInput } from "@/lib/profile-input";

export async function POST(req: Request) {
  const { data, error } = cleanProfileInput(await req.json().catch(() => ({})));
  if (error) return NextResponse.json({ error }, { status: 400 });
  const profile = Profile.parse(data);
  const rows = rankAll(await loadScholarships(false), profile, []);
  const counts: Record<Verdict, number> = { eligible: 0, almost: 0, need_info: 0, not_eligible: 0 };
  for (const r of rows) if (!r.e.closed) counts[r.e.verdict]++;
  const top = rows
    .filter((r) => !r.e.closed && r.e.verdict !== "not_eligible")
    .slice(0, 3)
    .map((r) => ({ slug: r.s.slug, name: r.s.name, provider: r.s.provider ?? null, amount: formatAmount(r.s), verdict: r.e.verdict, reason: r.e.reason, daysLeft: r.e.daysLeft }));
  return NextResponse.json({ counts, top });
}
